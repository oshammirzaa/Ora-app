/** Encrypted PDF copies. Never writes message rows. Failures leave the transcript in place. */

import { decryptIdentityBytes, encryptIdentityBytes } from "./ora-identity-crypto.ts";
import type { TransactionSql } from "./ora-admin-transactions.ts";
import { durationLabel, loadTranscriptForPdf } from "./ora-private-readings.ts";
import { buildReadingPdf, type ReadingReport } from "./ora-reading-pdf.ts";

export function reportFromTranscript(
  detail: NonNullable<Awaited<ReturnType<typeof loadTranscriptForPdf>>>,
  generatedAt: string,
): ReadingReport {
  const reading = detail.reading;
  return {
    id: reading.id,
    customerName: reading.clientName,
    customerId: reading.clientId,
    advisorName: reading.advisorName,
    advisorId: reading.advisorId,
    startedAt: reading.startedAt,
    endedAt: reading.endedAt,
    duration: durationLabel(reading.seconds),
    freeTime: durationLabel(reading.freeSeconds),
    paidTime: durationLabel(reading.paidSeconds),
    coins: reading.coins,
    status: reading.statusLabel,
    endReason: reading.endReason,
    messages: detail.messages.map((message) => ({
      senderName: message.senderName,
      senderRole: message.senderRole,
      body: message.body,
      createdAt: message.createdAt,
      recalled: message.recalled,
      attachment: message.attachment,
      tipGift: message.tipGift,
    })),
    truncated: detail.truncated,
    generatedAt,
  };
}

export async function storeReadingArchive(
  sql: TransactionSql,
  input: {
    readingId: string;
    ciphertext: string;
    iv: string;
    byteLength: number;
    messageCount: number;
    generatedBy: string;
  },
) {
  await sql`
    insert into ora_reading_archives (
      reading_id, ciphertext, iv, byte_length, message_count, generated_at, generated_by
    ) values (
      ${input.readingId}, ${input.ciphertext}, ${input.iv}, ${input.byteLength},
      ${input.messageCount}, now(), ${input.generatedBy}
    )
    on conflict (reading_id) do update set
      ciphertext = excluded.ciphertext,
      iv = excluded.iv,
      byte_length = excluded.byte_length,
      message_count = excluded.message_count,
      generated_at = now(),
      generated_by = excluded.generated_by
  `;
}

export async function readReadingArchive(sql: TransactionSql, readingId: string) {
  const [row] = await sql<{
    ciphertext: string;
    iv: string;
    byte_length: number;
    message_count: number;
    generated_at: string;
    generated_by: string;
  }>`
    select ciphertext, iv, byte_length, message_count, generated_at::text as generated_at, generated_by
    from ora_reading_archives
    where reading_id = ${readingId}
  `;
  return row ?? null;
}

export async function generateReadingArchive(sql: TransactionSql, readingId: string, generatedBy: string) {
  const detail = await loadTranscriptForPdf(sql, readingId);
  if (!detail) throw new Error("That reading was not found.");
  const generatedAt = new Date().toISOString();
  const pdf = await buildReadingPdf(reportFromTranscript(detail, generatedAt));
  const encrypted = encryptIdentityBytes(Buffer.from(pdf));
  await storeReadingArchive(sql, {
    readingId,
    ciphertext: encrypted.body,
    iv: encrypted.iv,
    byteLength: pdf.byteLength,
    messageCount: detail.messages.length,
    generatedBy: generatedBy.slice(0, 128),
  });
  return { pdf, generatedAt, messageCount: detail.messages.length };
}

export async function readingPdfBytes(sql: TransactionSql, readingId: string, regenerate: boolean, generatedBy: string) {
  if (!regenerate) {
    const stored = await readReadingArchive(sql, readingId).catch(() => null);
    if (stored?.ciphertext && stored.iv) {
      try {
        return {
          bytes: decryptIdentityBytes(stored.ciphertext, stored.iv),
          generatedAt: String(stored.generated_at || ""),
          regenerated: false,
        };
      } catch (err) {
        console.error("[ora] reading archive decrypt", err);
      }
    }
  }
  const made = await generateReadingArchive(sql, readingId, generatedBy);
  return { bytes: Buffer.from(made.pdf), generatedAt: made.generatedAt, regenerated: true };
}

/** Called after a live reading ends. Never throws, and never changes billing. */
export async function archiveEndedReading(readingId: string) {
  try {
    const { getSql } = await import("./db.ts");
    const { ensureArchiveTables } = await import("./ora-private-readings.ts");
    const sql = await getSql();
    await ensureArchiveTables(sql);
    await generateReadingArchive(sql, readingId, "system");
  } catch (err) {
    console.error("[ora] reading archive", err);
  }
}

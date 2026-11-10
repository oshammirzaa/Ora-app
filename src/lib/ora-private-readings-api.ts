import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { auditLog, requireAdmin, rid } from "@/lib/ora";
import {
  PRIVATE_READINGS_PERMISSION,
  filterPrivateReadings,
  loadMessageImage,
  loadPrivateReadings,
  loadReadingAccess,
  loadTranscriptPage,
  paginatePrivateReadings,
  readingPdfFilename,
  recordReadingAccess,
  summarizePrivateReadings,
  type PrivateReadingFilters,
} from "@/lib/ora-private-readings";

function filtersFrom(input?: Partial<PrivateReadingFilters> & { page?: number }) {
  const type = input?.type;
  const status = input?.status;
  return {
    client: String(input?.client || "").trim().slice(0, 80),
    advisor: String(input?.advisor || "").trim().slice(0, 80),
    clientId: String(input?.clientId || "").trim().slice(0, 128),
    from: String(input?.from || "").slice(0, 10),
    to: String(input?.to || "").slice(0, 10),
    type: type === "free" || type === "paid" || type === "mixed" ? type : "all",
    status:
      status === "live" || status === "completed" || status === "cancelled" || status === "historical"
        ? status
        : "all",
    page: Math.max(1, Math.floor(Number(input?.page) || 1)),
  } satisfies PrivateReadingFilters & { page: number };
}

async function noteAccess(
  sql: Awaited<ReturnType<typeof getSql>>,
  adminId: string,
  reading: { id: string; clientId: string; advisorId: string },
  action: string,
) {
  await recordReadingAccess(sql, {
    id: rid("acc"),
    adminId,
    readingId: reading.id,
    customerId: reading.clientId,
    advisorId: reading.advisorId,
    action,
  });
  await auditLog(adminId, `private_reading_${action}`, "reading", reading.id, reading.clientId);
}

export const adminPrivateReadings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(filtersFrom)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, PRIVATE_READINGS_PERMISSION);
    const sql = await getSql();
    const rows = filterPrivateReadings(await loadPrivateReadings(sql), data);
    const stats = summarizePrivateReadings(rows);
    const page = paginatePrivateReadings(rows, data.page, 25);
    return { ...page, stats };
  });

export const adminPrivateTranscript = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { readingId?: string; offset?: number; limit?: number }) => ({
    readingId: String(input?.readingId || "").trim().slice(0, 80),
    offset: Math.max(0, Math.floor(Number(input?.offset) || 0)),
    limit: Math.min(100, Math.max(1, Math.floor(Number(input?.limit) || 40))),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, PRIVATE_READINGS_PERMISSION);
    if (!data.readingId) throw new Error("Choose a reading.");
    const sql = await getSql();
    const transcript = await loadTranscriptPage(sql, data.readingId, data.offset, data.limit);
    if (!transcript) throw new Error("That reading was not found.");
    if (data.offset === 0) await noteAccess(sql, context.userId, transcript.reading, "view");
    const access = data.offset === 0 ? await loadReadingAccess(sql, data.readingId) : [];
    return { ...transcript, access };
  });

export const adminPrivateReadingImage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { readingId?: string; messageId?: string }) => ({
    readingId: String(input?.readingId || "").trim().slice(0, 80),
    messageId: String(input?.messageId || "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, PRIVATE_READINGS_PERMISSION);
    if (!data.readingId || !data.messageId) throw new Error("Choose a message.");
    const sql = await getSql();
    const image = await loadMessageImage(sql, data.readingId, data.messageId);
    if (!image) throw new Error("That photo was not found.");
    return image;
  });

export const adminPrivateReadingPdf = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input?: { readingId?: string; regenerate?: boolean }) => ({
    readingId: String(input?.readingId || "").trim().slice(0, 80),
    regenerate: Boolean(input?.regenerate),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, PRIVATE_READINGS_PERMISSION);
    if (!data.readingId) throw new Error("Choose a reading.");
    const sql = await getSql();
    const existing = await loadTranscriptPage(sql, data.readingId, 0, 1);
    if (!existing) throw new Error("That reading was not found.");
    try {
      const { readingPdfBytes } = await import("@/lib/ora-reading-archive");
      const file = await readingPdfBytes(sql, data.readingId, data.regenerate, context.userId);
      await noteAccess(sql, context.userId, existing.reading, data.regenerate ? "regenerate" : "download");
      return {
        filename: readingPdfFilename(existing.reading),
        pdfBase64: Buffer.from(file.bytes).toString("base64"),
        generatedAt: file.generatedAt,
        regenerated: file.regenerated,
      };
    } catch (err) {
      console.error("[ora] reading pdf", err);
      throw new Error("The transcript is unchanged. The PDF could not be created. Try again.");
    }
  });

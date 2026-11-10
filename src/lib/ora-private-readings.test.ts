import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { decryptIdentityBytes } from "./ora-identity-crypto.ts";
import { generateReadingArchive } from "./ora-reading-archive.ts";
import { buildReadingPdf, pdfSafe, readingReportLines } from "./ora-reading-pdf.ts";
import {
  filterPrivateReadings,
  loadTranscriptPage,
  privateReadingGate,
  type PrivateReading,
} from "./ora-private-readings.ts";
import type { TransactionSql } from "./ora-admin-transactions.ts";

function sqlFor(db: PGlite): TransactionSql {
  const run = async <T>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows;
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] || "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as TransactionSql;
  sql.query = run;
  return sql;
}

function reading(partial: Partial<PrivateReading> & Pick<PrivateReading, "id" | "clientId">): PrivateReading {
  return {
    clientName: "Sarah",
    advisorId: "adv-1",
    advisorName: "Mira",
    startedAt: "2026-11-10T05:00:00.000Z",
    endedAt: "2026-11-10T05:03:00.000Z",
    seconds: 180,
    freeSeconds: 180,
    paidSeconds: 0,
    coins: 0,
    status: "ended",
    statusLabel: "Completed",
    chatType: "free",
    chatTypeLabel: "Free",
    endReason: "",
    messageCount: 1,
    archived: false,
    ...partial,
  };
}

const SCHEMA = `
create table ora_profiles (user_id text primary key, display_name text not null default '');
create table ora_advisors (id text primary key, name text not null);
create table ora_readings (
  id text primary key,
  client_id text not null,
  advisor_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds integer not null default 0,
  coins_spent integer not null default 0,
  bonus_used integer not null default 0,
  weekly_used integer not null default 0,
  status text not null,
  rate_coins integer not null default 0
);
create table ora_messages (
  id text primary key,
  reading_id text not null,
  role text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  image_url text,
  tip_gift text,
  recalled_at timestamptz
);
`;

describe("private reading access", () => {
  it("refuses customers and support staff, and allows an owner", () => {
    assert.equal(privateReadingGate({ signedIn: true, admin: null }).ok, false);
    assert.equal(
      privateReadingGate({ signedIn: true, admin: { role: "admin", permissions: "overview,support" } }).ok,
      false,
    );
    const owner = privateReadingGate({ signedIn: true, admin: { role: "owner", permissions: "*" } });
    assert.equal(owner.ok, true);
    const scoped = privateReadingGate({ signedIn: true, admin: { role: "admin", permissions: "private_readings" } });
    assert.equal(scoped.ok, true);
  });

  it("keeps one customer's readings off another customer's filter", () => {
    const rows = [
      reading({ id: "r1", clientId: "cust-a", clientName: "Ada" }),
      reading({ id: "r2", clientId: "cust-b", clientName: "Bea", coins: 40, chatType: "paid", chatTypeLabel: "Paid", freeSeconds: 0, paidSeconds: 180 }),
    ];
    const onlyAda = filterPrivateReadings(rows, { clientId: "cust-a" });
    assert.deepEqual(onlyAda.map((row) => row.id), ["r1"]);
    assert.equal(onlyAda[0]?.coins, 0);
  });

  it("builds a report from the messages it is given and no others", async () => {
    const lines = readingReportLines({
      id: "r1",
      customerName: "Ada",
      customerId: "cust-a",
      advisorName: "Mira",
      advisorId: "adv-1",
      startedAt: "2026-11-10T05:00:00.000Z",
      endedAt: "2026-11-10T05:03:00.000Z",
      duration: "3 min",
      freeTime: "3 min",
      paidTime: "0 sec",
      coins: 0,
      status: "Completed",
      endReason: "",
      truncated: false,
      generatedAt: "2026-11-10T06:00:00.000Z",
      messages: [
        {
          senderName: "Ada",
          senderRole: "Customer",
          body: "Is the timing right?",
          createdAt: "2026-11-10T05:01:00.000Z",
          recalled: false,
          attachment: "",
          tipGift: "",
        },
      ],
    });
    assert.equal(lines.includes("Is the timing right?"), true);
    assert.equal(lines.some((line) => line.includes("invented reply")), false);
    assert.equal(lines[0], "ORA PSYCHIC");
    assert.match(pdfSafe("Hello ✨"), /^Hello /);
    const pdf = await buildReadingPdf({
      id: "r1",
      customerName: "Ada",
      customerId: "cust-a",
      advisorName: "Mira",
      advisorId: "adv-1",
      startedAt: "2026-11-10T05:00:00.000Z",
      endedAt: "",
      duration: "3 min",
      freeTime: "3 min",
      paidTime: "0 sec",
      coins: 0,
      status: "Completed",
      endReason: "",
      truncated: false,
      generatedAt: "2026-11-10T06:00:00.000Z",
      messages: [],
    });
    assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
  });
});

describe("private reading storage", () => {
  it("archives a PDF without changing the stored messages", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(`
      insert into ora_profiles (user_id, display_name) values ('cust-a', 'Ada'), ('cust-b', 'Bea');
      insert into ora_advisors (id, name) values ('adv-1', 'Mira');
      insert into ora_readings (id, client_id, advisor_id, started_at, ended_at, seconds, coins_spent, bonus_used, weekly_used, status)
      values
        ('r-free', 'cust-a', 'adv-1', '2026-11-10T05:00:00Z', '2026-11-10T05:03:00Z', 180, 0, 180, 0, 'ended'),
        ('r-paid', 'cust-b', 'adv-1', '2026-11-10T06:00:00Z', '2026-11-10T06:04:00Z', 240, 40, 0, 0, 'ended'),
        ('r-live', 'cust-a', 'adv-1', '2026-11-10T07:00:00Z', null, 30, 0, 0, 0, 'live');
      insert into ora_messages (id, reading_id, role, body, created_at) values
        ('m1', 'r-free', 'client', 'Is the timing right?', '2026-11-10T05:01:00Z'),
        ('m2', 'r-free', 'advisor', 'Look at March.', '2026-11-10T05:02:00Z');
    `);
    const sql = sqlFor(db);
    const page = await loadTranscriptPage(sql, "r-free", 0, 20);
    assert.equal(page?.messages.length, 2);
    assert.equal(page?.messages[0]?.body, "Is the timing right?");
    assert.equal(page?.messages[0]?.senderRole, "Customer");
    assert.equal(page?.messages[1]?.senderRole, "Advisor");
    assert.equal(page?.reading.coins, 0);
    assert.equal(page?.reading.chatType, "free");
    const before = await db.query<{ body: string }>(`select body from ora_messages where reading_id = 'r-free' order by id`);
    const made = await generateReadingArchive(sql, "r-free", "admin-1");
    const after = await db.query<{ body: string }>(`select body from ora_messages where reading_id = 'r-free' order by id`);
    assert.deepEqual(after.rows, before.rows);
    const stored = await db.query<{ ciphertext: string; iv: string }>(`select ciphertext, iv from ora_reading_archives where reading_id = 'r-free'`);
    assert.equal(stored.rows.length, 1);
    assert.notEqual(stored.rows[0]?.ciphertext.includes("Is the timing right?"), true);
    const opened = decryptIdentityBytes(stored.rows[0]!.ciphertext, stored.rows[0]!.iv);
    assert.equal(opened.subarray(0, 5).toString(), "%PDF-");
    assert.equal(made.messageCount, 2);
    const other = await loadTranscriptPage(sql, "r-paid", 0, 10);
    assert.equal(other?.messages.length, 0);
    assert.equal(other?.reading.clientId, "cust-b");
    assert.equal(other?.reading.coins, 40);
  });
});

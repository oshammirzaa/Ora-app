import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  buildChatTransaction,
  classifyChat,
  durationLabel,
  filterTransactions,
  loadAdminTransactionDetail,
  loadAdminTransactions,
  paginateTransactions,
  summarizeTransactions,
  transactionsCsv,
  type AdminTransaction,
  type TransactionSql,
} from "./ora-admin-transactions.ts";

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
  advisor_earned integer not null default 0,
  platform_fee integer not null default 0,
  status text not null,
  rate_coins integer not null default 20
);
create table ora_paid_messages (
  id text primary key,
  customer_id text not null,
  advisor_id text not null,
  coins integer not null,
  advisor_share_coins integer not null,
  ora_share_coins integer not null,
  credited boolean not null default true,
  created_at timestamptz not null default now()
);
create table ora_chat_requests (
  id text primary key,
  client_id text not null,
  advisor_id text not null,
  reading_id text not null default '',
  status text not null,
  created_at timestamptz not null default now()
);
create table ora_adjustments (
  id text primary key,
  user_id text not null,
  reading_id text not null default '',
  coins integer not null,
  kind text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create table ora_earnings (
  id text primary key,
  reading_id text not null,
  status text not null,
  gross_coins integer not null,
  commission_coins integer not null,
  net_coins integer not null
);
create table ora_ledger (
  id text primary key,
  user_id text not null,
  kind text not null,
  amount_coins integer not null,
  note text not null default '',
  ref_id text not null default '',
  created_at timestamptz not null default now()
);
`;

describe("admin transaction classification", () => {
  it("keeps a free three-minute chat with zero coins", () => {
    const bill = classifyChat({ seconds: 180, bonusUsed: 180, weeklyUsed: 0, coinsSpent: 0 });
    assert.equal(bill.chatType, "free");
    assert.equal(bill.freeSeconds, 180);
    assert.equal(bill.paidSeconds, 0);
    assert.equal(bill.coins, 0);
    assert.equal(durationLabel(180), "3 min");
    const row = buildChatTransaction({
      id: "read_sarah",
      clientId: "user_sarah",
      clientName: "Sarah",
      advisorId: "adv_misbah",
      advisorName: "Light of Misbah",
      at: "2026-11-10T08:00:00.000Z",
      endedAt: "2026-11-10T08:03:00.000Z",
      seconds: 180,
      bonusUsed: 180,
      coinsSpent: 0,
      advisorEarnings: 0,
      platformFee: 0,
      status: "ended",
      rateCoins: 22,
    });
    assert.equal(row.clientName, "Sarah");
    assert.notEqual(row.clientName, row.id);
    assert.equal(row.coins, 0);
    assert.notEqual(row.coins, 22 * 3);
  });

  it("splits mixed time without changing the stored coin charge", () => {
    const bill = classifyChat({ seconds: 300, bonusUsed: 180, weeklyUsed: 0, coinsSpent: 40 });
    assert.equal(bill.chatType, "mixed");
    assert.equal(bill.freeSeconds, 180);
    assert.equal(bill.paidSeconds, 120);
    assert.equal(bill.coins, 40);
    assert.equal(classifyChat({ seconds: 120, bonusUsed: 0, weeklyUsed: 0, coinsSpent: 40 }).chatType, "paid");
  });

  it("counts free and paid chats once and leaves paid-message coins out of the chat total", () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const free = buildChatTransaction({
      id: "free",
      clientId: "user_sarah",
      clientName: "Sarah",
      advisorId: "adv",
      advisorName: "Light of Misbah",
      at: "2026-11-10T08:00:00.000Z",
      seconds: 180,
      bonusUsed: 180,
      coinsSpent: 0,
      status: "ended",
    });
    const paid = buildChatTransaction({
      id: "paid",
      clientId: "user_sarah",
      clientName: "Sarah",
      advisorId: "adv",
      advisorName: "Light of Misbah",
      at: "2026-11-10T09:00:00.000Z",
      seconds: 120,
      coinsSpent: 40,
      advisorEarnings: 8,
      platformFee: 32,
      status: "ended",
    });
    const mixed = buildChatTransaction({
      id: "mixed",
      clientId: "user_sarah",
      clientName: "Sarah",
      advisorId: "adv",
      advisorName: "Light of Misbah",
      at: "2026-11-10T10:00:00.000Z",
      seconds: 300,
      bonusUsed: 180,
      coinsSpent: 20,
      advisorEarnings: 4,
      platformFee: 16,
      status: "live",
    });
    const rows = filterTransactions([free, paid, mixed, free], { client: "Sarah" });
    assert.deepEqual(rows.map((row) => row.id), ["free", "paid", "mixed"]);
    const stats = summarizeTransactions(rows, now);
    assert.equal(stats.chatsToday, 3);
    assert.equal(stats.freeToday, 1);
    assert.equal(stats.paidToday, 2);
    assert.equal(stats.active, 1);
    assert.equal(stats.coins, 60);
    assert.equal(stats.advisorEarnings, 12);
    assert.equal(stats.platformFee, 48);
    assert.equal(stats.chatSeconds, 600);
    const csv = transactionsCsv(rows);
    assert.match(csv, /Sarah,user_sarah/);
    assert.match(csv, /Free,3 min,180,0,0/);
  });
});

describe("admin transaction database", () => {
  it("lists stored free chats, skips a request that already has a reading, and does not change earnings", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(`insert into ora_profiles (user_id, display_name) values ('user_sarah', 'Sarah')`);
    await db.exec(`insert into ora_advisors (id, name) values ('adv_misbah', 'Light of Misbah')`);
    await db.exec(`
      insert into ora_readings (
        id, client_id, advisor_id, started_at, ended_at, seconds, coins_spent, bonus_used, weekly_used,
        advisor_earned, platform_fee, status, rate_coins
      ) values
      ('read_free', 'user_sarah', 'adv_misbah', '2026-11-10T08:00:00Z', '2026-11-10T08:03:00Z', 180, 0, 180, 0, 0, 0, 'ended', 22),
      ('read_paid', 'user_sarah', 'adv_misbah', '2026-11-10T09:00:00Z', '2026-11-10T09:02:00Z', 120, 44, 0, 0, 8, 36, 'ended', 22)
    `);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, reading_id, status) values ('req_linked', 'user_sarah', 'adv_misbah', 'read_free', 'expired')`);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, reading_id, status) values ('req_drop', 'user_sarah', 'adv_misbah', '', 'declined')`);
    await db.exec(`insert into ora_paid_messages (id, customer_id, advisor_id, coins, advisor_share_coins, ora_share_coins) values ('msg_1', 'user_sarah', 'adv_misbah', 2, 1, 1)`);
    await db.exec(`insert into ora_adjustments (id, user_id, reading_id, coins, kind, note) values ('adj_1', 'user_sarah', 'read_paid', -4, 'refund', 'Partial refund')`);
    const sql = sqlFor(db);
    const rows = await loadAdminTransactions(sql);
    const ids = rows.map((row) => row.id);
    assert.ok(ids.includes("read_free"));
    assert.ok(ids.includes("read_paid"));
    assert.ok(ids.includes("req_drop"));
    assert.ok(ids.includes("msg_1"));
    assert.equal(ids.includes("req_linked"), false);
    const free = rows.find((row) => row.id === "read_free") as AdminTransaction;
    assert.equal(free.clientName, "Sarah");
    assert.equal(free.chatType, "free");
    assert.equal(free.coins, 0);
    const stats = summarizeTransactions(rows, new Date("2026-11-10T12:00:00.000Z"));
    assert.equal(stats.coins, 44);
    assert.equal(stats.paidMessageCoins, 2);
    assert.equal(stats.advisorEarnings, 8);
    const detail = await loadAdminTransactionDetail(sql, "chat", "read_paid");
    assert.equal(detail?.adjustments[0]?.note, "Partial refund");
    const stored = await db.query<{ advisor_earned: number; coins_spent: number }>(
      "select advisor_earned, coins_spent from ora_readings where id = 'read_free'",
    );
    assert.equal(Number(stored.rows[0]?.advisor_earned), 0);
    assert.equal(Number(stored.rows[0]?.coins_spent), 0);
    const page = paginateTransactions(rows, 1, 2);
    assert.equal(page.rows.length, 2);
    assert.equal(page.total, rows.length);
  });
});

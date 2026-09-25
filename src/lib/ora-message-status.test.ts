import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  MARK_INBOX_DELIVERED_FOR_ADVISOR,
  MARK_INBOX_DELIVERED_FOR_CUSTOMER,
  MARK_INBOX_SEEN_FOR_ADVISOR,
  MARK_INBOX_SEEN_FOR_CUSTOMER,
  MARK_READING_DELIVERED_FOR_ADVISOR,
  MARK_READING_SEEN,
  messageReceipt,
  receiptSqlChangesMoney,
  viewerMayMarkSeen,
} from "./ora-message-status.ts";

const SCHEMA = `
create table ora_wallets (user_id text primary key, coins integer not null);
create table ora_advisors (id text primary key, user_id text not null);
create table ora_readings (id text primary key, advisor_id text not null, client_id text not null, status text not null);
create table ora_messages (
  id text primary key,
  reading_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  seen_at timestamptz
);
create table ora_advisor_inbox_messages (
  id text primary key,
  thread_id text not null,
  advisor_id text not null,
  customer_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  seen_at timestamptz
);
`;

async function setup() {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`
    insert into ora_wallets values ('cust', 40), ('adv_user', 10);
    insert into ora_advisors values ('adv', 'adv_user');
    insert into ora_readings values ('read_1', 'adv', 'cust', 'live');
    insert into ora_messages (id, reading_id, role, body) values
      ('m_c', 'read_1', 'client', 'hello'),
      ('m_a', 'read_1', 'advisor', 'welcome');
    insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body) values
      ('i_c', 'thr', 'adv', 'cust', 'customer', 'inbox hi'),
      ('i_a', 'thr', 'adv', 'cust', 'advisor', 'inbox reply');
  `);
  const query = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows as Array<Record<string, unknown>>;
  return { query };
}

describe("message receipts", () => {
  it("moves customer to advisor from sent to delivered to seen without charging", async () => {
    const { query } = await setup();
    const before = await query(`select id, delivered_at, seen_at from ora_messages where id = 'm_c'`);
    assert.equal(messageReceipt({ deliveredAt: before[0]?.delivered_at as string, seenAt: before[0]?.seen_at as string }), "sent");
    assert.equal(viewerMayMarkSeen({ viewerId: "adv_user", customerId: "cust", advisorUserId: "adv_user", adminView: false }), true);
    assert.equal(receiptSqlChangesMoney(MARK_READING_DELIVERED_FOR_ADVISOR), false);
    assert.equal(receiptSqlChangesMoney(MARK_READING_SEEN), false);
    await query(MARK_READING_DELIVERED_FOR_ADVISOR, ["adv_user"]);
    const delivered = await query(`select delivered_at, seen_at from ora_messages where id = 'm_c'`);
    assert.equal(messageReceipt({ deliveredAt: String(delivered[0]?.delivered_at || ""), seenAt: delivered[0]?.seen_at as string }), "delivered");
    assert.equal(delivered[0]?.seen_at, null);
    await query(MARK_READING_SEEN, ["read_1", "client"]);
    const seen = await query(`select delivered_at, seen_at from ora_messages where id = 'm_c'`);
    assert.equal(messageReceipt({ deliveredAt: String(seen[0]?.delivered_at), seenAt: String(seen[0]?.seen_at) }), "seen");
    const wallet = await query(`select coins from ora_wallets where user_id = 'cust'`);
    const count = await query(`select count(*)::int as n from ora_messages`);
    assert.equal(Number(wallet[0]?.coins), 40);
    assert.equal(Number(count[0]?.n), 2);
  });

  it("moves advisor to customer the same way and ignores an admin", async () => {
    const { query } = await setup();
    assert.equal(viewerMayMarkSeen({ viewerId: "admin", customerId: "cust", advisorUserId: "adv_user", adminView: true }), false);
    await query(MARK_INBOX_DELIVERED_FOR_CUSTOMER, ["someone-else"]);
    const untouched = await query(`select delivered_at, seen_at from ora_advisor_inbox_messages where id = 'i_a'`);
    assert.equal(messageReceipt({ deliveredAt: untouched[0]?.delivered_at as string, seenAt: untouched[0]?.seen_at as string }), "sent");
    await query(MARK_INBOX_DELIVERED_FOR_CUSTOMER, ["cust"]);
    const delivered = await query(`select delivered_at, seen_at from ora_advisor_inbox_messages where id = 'i_a'`);
    assert.equal(messageReceipt({ deliveredAt: String(delivered[0]?.delivered_at), seenAt: delivered[0]?.seen_at as string }), "delivered");
    await query(MARK_INBOX_SEEN_FOR_CUSTOMER, ["thr", "cust"]);
    const seen = await query(`select seen_at from ora_advisor_inbox_messages where id = 'i_a'`);
    assert.ok(seen[0]?.seen_at);
    const customerStill = await query(`select seen_at from ora_advisor_inbox_messages where id = 'i_c'`);
    assert.equal(customerStill[0]?.seen_at, null);
    await query(MARK_INBOX_DELIVERED_FOR_ADVISOR, ["adv_user"]);
    await query(MARK_INBOX_SEEN_FOR_ADVISOR, ["adv_user", "thr"]);
    const customerSeen = await query(`select seen_at from ora_advisor_inbox_messages where id = 'i_c'`);
    assert.ok(customerSeen[0]?.seen_at);
    const coins = await query(`select sum(coins)::int as n from ora_wallets`);
    const messages = await query(`select count(*)::int as n from ora_advisor_inbox_messages`);
    assert.equal(Number(coins[0]?.n), 50);
    assert.equal(Number(messages[0]?.n), 2);
  });

  it("does not let admin chat or the AI report viewer mark seen", () => {
    const adminChat = readFileSync(new URL("./ora-admin-advisor-ops.ts", import.meta.url), "utf8");
    const reports = readFileSync(new URL("./ora-compliance-api.ts", import.meta.url), "utf8");
    const chatFn = adminChat.slice(adminChat.indexOf("export const adminAdvisorChat"));
    const reportFn = reports.slice(reports.indexOf("export const adminAiReportThread"));
    assert.equal(chatFn.includes("seen_at"), false);
    assert.equal(reportFn.includes("seen_at"), false);
    assert.equal(chatFn.includes("delivered_at"), false);
    assert.equal(viewerMayMarkSeen({ viewerId: "admin", customerId: "cust", advisorUserId: "adv_user", adminView: true }), false);
  });
});

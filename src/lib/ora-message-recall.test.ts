import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  RECALL_INBOX_SQL,
  RECALL_READING_SQL,
  RECALLED_THREAD_PREVIEW,
  REFRESH_INBOX_PREVIEW_SQL,
  publicMessageContent,
  applyLocalRecalls,
  recallSqlChangesMoneyOrAlerts,
} from "./ora-message-recall-rules.ts";

const SCHEMA = `
create table ora_wallets (user_id text primary key, coins integer not null);
create table ora_advisors (id text primary key, user_id text not null);
create table ora_readings (
  id text primary key,
  advisor_id text not null,
  client_id text not null,
  status text not null,
  seconds integer not null default 0
);
create table ora_messages (
  id text primary key,
  reading_id text not null,
  role text not null,
  body text not null,
  image_url text,
  tip_gift text,
  created_at timestamptz not null default now(),
  recalled_at timestamptz
);
create table ora_advisor_inbox (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  last_body text not null default '',
  last_role text not null default '',
  last_at timestamptz not null default now(),
  unread_advisor integer not null default 0,
  unread_customer integer not null default 0
);
create table ora_advisor_inbox_messages (
  id text primary key,
  thread_id text not null,
  advisor_id text not null,
  customer_id text not null,
  role text not null,
  body text not null,
  kind text not null default 'message',
  image_url text,
  tip_gift text,
  created_at timestamptz not null default now(),
  recalled_at timestamptz
);
create table ora_paid_messages (message_id text primary key, coins integer not null);
create table ora_customer_alerts (id text primary key, body text not null);
`;

async function setup() {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`
    insert into ora_wallets values ('cust', 40), ('adv_user', 12);
    insert into ora_advisors values ('adv', 'adv_user');
    insert into ora_readings values ('read_1', 'adv', 'cust', 'live', 95);
    insert into ora_messages (id, reading_id, role, body, image_url) values
      ('m_c', 'read_1', 'client', 'secret from client', 'pic'),
      ('m_a', 'read_1', 'advisor', 'secret from advisor', '');
    insert into ora_messages (id, reading_id, role, body, tip_gift) values
      ('m_tip', 'read_1', 'client', 'A rose', 'rose');
    insert into ora_advisor_inbox values
      ('thr', 'adv', 'cust', 'newest secret', 'customer', now(), 2, 1);
    insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body, kind, created_at) values
      ('i_old', 'thr', 'adv', 'cust', 'customer', 'keep me', 'message', now() - interval '3 minutes'),
      ('i_new', 'thr', 'adv', 'cust', 'customer', 'newest secret', 'message', now() - interval '2 minutes'),
      ('i_tip', 'thr', 'adv', 'cust', 'customer', 'Crystal', 'tip', now() - interval '1 minute'),
      ('i_adv', 'thr', 'adv', 'cust', 'advisor', 'advisor note', 'followup', now());
    update ora_advisor_inbox_messages set tip_gift = 'crystal' where id = 'i_tip';
    insert into ora_paid_messages values ('i_new', 2);
    insert into ora_customer_alerts values ('alrt', 'newest secret');
  `);
  const query = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows as Array<Record<string, unknown>>;
  return { query };
}

async function recallInbox(query: (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>, id: string, userId: string) {
  const rows = await query(RECALL_INBOX_SQL, [id, userId]);
  if (rows.length) await query(REFRESH_INBOX_PREVIEW_SQL, [rows[0]?.thread_id, RECALLED_THREAD_PREVIEW, rows[0]?.id]);
  return rows;
}

describe("message recall", () => {
  it("does not touch wallets, billing, alerts, unread, or timers", () => {
    assert.equal(recallSqlChangesMoneyOrAlerts(RECALL_INBOX_SQL), false);
    assert.equal(recallSqlChangesMoneyOrAlerts(RECALL_READING_SQL), false);
    assert.equal(recallSqlChangesMoneyOrAlerts(REFRESH_INBOX_PREVIEW_SQL), false);
  });

  it("hides recalled text from both people and leaves the stored row for compliance", async () => {
    const { query } = await setup();
    const hidden = publicMessageContent({ body: "secret", image: "pic", recalledAt: "2026-09-26T00:00:00Z" });
    assert.equal(hidden.recalled, true);
    assert.equal(hidden.body, "");
    assert.equal(hidden.image, "");
    assert.equal(publicMessageContent({ body: "still here", image: "pic", recalledAt: null }).body, "still here");
    const kept = applyLocalRecalls(
      [{ id: "a", body: "hi", image: "pic" }, { id: "b", body: "stay" }],
      new Set(["a"]),
    );
    assert.equal(kept[0]?.body, "");
    assert.equal(kept[0]?.image, "");
    assert.equal(kept[0]?.recalled, true);
    assert.equal(kept[1]?.body, "stay");

    const recalled = await recallInbox(query, "i_new", "cust");
    assert.equal(recalled.length, 1);
    const row = await query(`select body, recalled_at from ora_advisor_inbox_messages where id = 'i_new'`);
    assert.equal(row[0]?.body, "newest secret");
    assert.ok(row[0]?.recalled_at);
    const shown = publicMessageContent({ body: row[0]?.body, image: "", recalledAt: row[0]?.recalled_at });
    assert.equal(shown.body, "");

    const again = await recallInbox(query, "i_new", "cust");
    assert.equal(again.length, 0);
    const stranger = await recallInbox(query, "i_old", "someone-else");
    assert.equal(stranger.length, 0);
    const advisorCant = await recallInbox(query, "i_old", "adv_user");
    assert.equal(advisorCant.length, 0);
    const tip = await recallInbox(query, "i_tip", "cust");
    assert.equal(tip.length, 0);

    const preview = await query(`select last_body, unread_advisor, unread_customer from ora_advisor_inbox where id = 'thr'`);
    assert.equal(preview[0]?.last_body, "newest secret");
    assert.equal(Number(preview[0]?.unread_advisor), 2);
    assert.equal(Number(preview[0]?.unread_customer), 1);

    const follow = await recallInbox(query, "i_adv", "adv_user");
    assert.equal(follow.length, 1);
    const after = await query(`select last_body, unread_advisor, unread_customer, last_role from ora_advisor_inbox where id = 'thr'`);
    assert.equal(after[0]?.last_body, RECALLED_THREAD_PREVIEW);
    assert.equal(Number(after[0]?.unread_advisor), 2);
    assert.equal(Number(after[0]?.unread_customer), 1);
    const stillThere = await query(`select count(*)::int as n from ora_advisor_inbox_messages where id = 'i_adv'`);
    assert.equal(Number(stillThere[0]?.n), 1);

    const coins = await query(`select sum(coins)::int as n from ora_wallets`);
    const paid = await query(`select coins from ora_paid_messages where message_id = 'i_new'`);
    const alert = await query(`select body from ora_customer_alerts where id = 'alrt'`);
    assert.equal(Number(coins[0]?.n), 52);
    assert.equal(Number(paid[0]?.coins), 2);
    assert.equal(alert[0]?.body, "newest secret");
  });

  it("lets each live-chat sender recall only their own message", async () => {
    const { query } = await setup();
    const notTheirs = await query(RECALL_READING_SQL, ["m_a", "cust"]);
    assert.equal(notTheirs.length, 0);
    const tip = await query(RECALL_READING_SQL, ["m_tip", "cust"]);
    assert.equal(tip.length, 0);
    const own = await query(RECALL_READING_SQL, ["m_c", "cust"]);
    assert.equal(own.length, 1);
    const advisor = await query(RECALL_READING_SQL, ["m_a", "adv_user"]);
    assert.equal(advisor.length, 1);
    const stored = await query(`select id, body from ora_messages where id in ('m_c', 'm_a') order by id`);
    assert.equal(stored[0]?.body, "secret from advisor");
    assert.equal(stored[1]?.body, "secret from client");
    const reading = await query(`select seconds, status from ora_readings where id = 'read_1'`);
    assert.equal(Number(reading[0]?.seconds), 95);
    assert.equal(reading[0]?.status, "live");
    const coins = await query(`select sum(coins)::int as n from ora_wallets`);
    assert.equal(Number(coins[0]?.n), 52);
  });
});

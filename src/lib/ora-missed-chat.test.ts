import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { INCOMING_REQUEST_TTL_MS, incomingSecondsLeft, isIncomingRequestFresh } from "./ora-advisor-desk-stats.ts";
import {
  MISSED_CHAT_PENALTY_COINS,
  PRESENCE_OFFLINE_GRACE_MS,
  isMissedLiveRequest,
  missedChatPenalty,
  missedChatPenaltyNote,
  onlineAfterPresenceCheck,
  presenceHeartbeatStale,
  shouldChargeMissedChat,
} from "./ora-missed-chat.ts";
import {
  noteAdvisorHeartbeatWith,
  resetMissedChatTablesForTests,
  settleMissedChatsWith,
  sweepDisconnectedAdvisorsWith,
  type MissedChatSql,
} from "./ora-missed-chat-api.ts";

const SCHEMA = `
create table ora_advisors (
  id text primary key,
  user_id text not null,
  online boolean not null default false,
  busy boolean not null default false,
  payout_coins integer not null default 0,
  status text not null default 'live',
  last_offline_at timestamptz,
  current_presence_id text not null default ''
);
create table ora_chat_requests (
  id text primary key,
  client_id text not null,
  advisor_id text not null,
  status text not null,
  created_at timestamptz not null default now()
);
create table ora_readings (
  id text primary key,
  advisor_id text not null,
  client_id text not null default '',
  status text not null
);
create table ora_advisor_presence (
  id text primary key,
  advisor_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds integer not null default 0,
  last_seen_at timestamptz,
  source text not null default 'toggle'
);
create table ora_ledger (
  id text primary key,
  user_id text not null,
  kind text not null,
  amount_coins integer not null default 0,
  seconds integer not null default 0,
  note text not null default '',
  ref_id text not null default '',
  created_at timestamptz not null default now()
);
create unique index ora_ledger_kind_ref_idx on ora_ledger (kind, ref_id) where ref_id <> '';
`;

function sqlFor(db: PGlite): MissedChatSql {
  return {
    query: async <T>(text: string, params?: unknown[]) => (await db.query(text, params)).rows as T[],
  };
}

async function seedAdvisor(db: PGlite, coins = 20, userId = "adv_user") {
  await db.exec(`insert into ora_advisors (id, user_id, online, busy, payout_coins) values ('adv_a', '${userId}', true, false, ${coins})`);
  await db.exec(`insert into ora_advisor_presence (id, advisor_id, last_seen_at) values ('on_a', 'adv_a', now())`);
}

describe("missed chat penalty rules", () => {
  it("charges 5 only for a timed-out pending request and never goes negative", () => {
    assert.equal(MISSED_CHAT_PENALTY_COINS, 5);
    assert.equal(INCOMING_REQUEST_TTL_MS, 60_000);
    assert.equal(shouldChargeMissedChat("timeout"), true);
    assert.equal(shouldChargeMissedChat("accept"), false);
    assert.equal(shouldChargeMissedChat("decline"), false);
    assert.equal(shouldChargeMissedChat("cancel"), false);
    assert.equal(shouldChargeMissedChat("disconnect"), false);
    assert.equal(isMissedLiveRequest({ status: "pending", ageMs: 59_000 }), false);
    assert.equal(isMissedLiveRequest({ status: "pending", ageMs: 60_000 }), true);
    assert.equal(isMissedLiveRequest({ status: "pending", ageMs: INCOMING_REQUEST_TTL_MS - 1 }), false);
    assert.equal(isMissedLiveRequest({ status: "accepted", ageMs: INCOMING_REQUEST_TTL_MS + 5_000 }), false);
    assert.equal(isMissedLiveRequest({ status: "declined", ageMs: INCOMING_REQUEST_TTL_MS + 5_000 }), false);
    assert.equal(isMissedLiveRequest({ status: "expired", ageMs: 60_000 }), false);
    const now = Date.parse("2026-09-28T12:00:00.000Z");
    assert.equal(isIncomingRequestFresh(new Date(now - 59_000).toISOString(), now), true);
    assert.equal(isIncomingRequestFresh(new Date(now - 60_000).toISOString(), now), false);
    assert.equal(incomingSecondsLeft(new Date(now - 59_000).toISOString(), now), 1);
    assert.equal(incomingSecondsLeft(new Date(now - 60_000).toISOString(), now), 0);
    assert.deepEqual(missedChatPenalty(20), { penalty: 5, charged: 5, unpaid: 0, nextBalance: 15 });
    assert.deepEqual(missedChatPenalty(2), { penalty: 5, charged: 2, unpaid: 3, nextBalance: 0 });
    assert.deepEqual(missedChatPenalty(0), { penalty: 5, charged: 0, unpaid: 5, nextBalance: 0 });
    assert.equal(missedChatPenalty(-4).nextBalance, 0);
    assert.equal(missedChatPenaltyNote(5, 0), "Missed chat penalty -5 coins");
    assert.equal(missedChatPenaltyNote(0, 5), "Missed chat penalty -5 coins (unpaid)");
    assert.equal(missedChatPenaltyNote(2, 3), "Missed chat penalty -5 coins (2 charged, 3 unpaid)");
  });

  it("keeps a short disconnect online and a lost connection offline until Go Online", () => {
    const now = Date.now();
    assert.equal(presenceHeartbeatStale(new Date(now - 10_000).toISOString(), now), false);
    assert.equal(presenceHeartbeatStale(new Date(now - PRESENCE_OFFLINE_GRACE_MS - 1).toISOString(), now), true);
    assert.equal(presenceHeartbeatStale(null, now), false);
    assert.equal(onlineAfterPresenceCheck({ online: true, lastSeenAt: new Date(now - 10_000).toISOString(), now }), true);
    assert.equal(
      onlineAfterPresenceCheck({ online: true, lastSeenAt: new Date(now - PRESENCE_OFFLINE_GRACE_MS - 5).toISOString(), now }),
      false,
    );
    assert.equal(onlineAfterPresenceCheck({ online: false, lastSeenAt: new Date(now).toISOString(), now }), false);
    assert.equal(onlineAfterPresenceCheck({ online: false, manualGoOnline: true, now }), true);
  });
});

describe("missed chat database", () => {
  it("penalizes a timeout once, ignores accept decline and cancel, and stays offline", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    const sql = sqlFor(db);
    resetMissedChatTablesForTests();
    await seedAdvisor(db, 20);

    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_ok', 'c1', 'adv_a', 'accepted', now() - interval '10 minutes')`);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_no', 'c2', 'adv_a', 'declined', now() - interval '10 minutes')`);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_cancel', 'c3', 'adv_a', 'expired', now() - interval '1 minutes')`);
    assert.equal((await settleMissedChatsWith(sql, { advisorId: "adv_a" })).length, 0);
    const before = await db.query<{ payout_coins: number; online: boolean }>("select payout_coins, online from ora_advisors");
    assert.equal(Number(before.rows[0].payout_coins), 20);
    assert.equal(before.rows[0].online, true);

    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_miss', 'c4', 'adv_a', 'pending', now() - interval '4 minutes')`);
    const first = await settleMissedChatsWith(sql, { advisorId: "adv_a" });
    assert.equal(first.length, 1);
    assert.equal(Number(first[0].charged_coins), 5);
    assert.equal(Number(first[0].unpaid_coins), 0);
    const again = await settleMissedChatsWith(sql, { advisorId: "adv_a" });
    assert.equal(again.length, 0);
    const after = await db.query<{ payout_coins: number; online: boolean; status: string }>(
      `select a.payout_coins, a.online, r.status
       from ora_advisors a, ora_chat_requests r
       where r.id = 'req_miss'`,
    );
    assert.equal(Number(after.rows[0].payout_coins), 15);
    assert.equal(after.rows[0].online, false);
    assert.equal(after.rows[0].status, "expired");
    const ledger = await db.query<{ n: number; note: string; amount_coins: number }>(
      "select count(*)::int as n, min(note) as note, min(amount_coins)::int as amount_coins from ora_ledger where kind = 'missed_chat'",
    );
    assert.equal(Number(ledger.rows[0].n), 1);
    assert.equal(ledger.rows[0].note, missedChatPenaltyNote(5, 0));
    assert.equal(Number(ledger.rows[0].amount_coins), -5);
    const penalties = await db.query<{ n: number }>("select count(*)::int as n from ora_missed_chat_penalties");
    assert.equal(Number(penalties.rows[0].n), 1);

    const beat = await noteAdvisorHeartbeatWith(sql, "adv_a");
    assert.equal(beat, false);
    const stayed = await db.query<{ online: boolean }>("select online from ora_advisors");
    assert.equal(stayed.rows[0].online, false);
  });

  it("limits the charge when earnings are short and does not charge a disconnect", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    const sql = sqlFor(db);
    resetMissedChatTablesForTests();
    await seedAdvisor(db, 2);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_low', 'c1', 'adv_a', 'pending', now() - interval '4 minutes')`);
    const settled = await settleMissedChatsWith(sql, { requestId: "req_low" });
    assert.equal(Number(settled[0].charged_coins), 2);
    assert.equal(Number(settled[0].unpaid_coins), 3);
    const row = await db.query<{ payout_coins: number; note: string }>(
      `select a.payout_coins, l.note
       from ora_advisors a
       join ora_ledger l on l.user_id = a.user_id and l.kind = 'missed_chat'`,
    );
    assert.equal(Number(row.rows[0].payout_coins), 0);
    assert.equal(row.rows[0].note, missedChatPenaltyNote(2, 3));

    await db.exec(`update ora_advisors set online = true, payout_coins = 9 where id = 'adv_a'`);
    await db.exec(`update ora_advisor_presence set ended_at = null, last_seen_at = now() - interval '10 seconds' where id = 'on_a'`);
    assert.equal(await noteAdvisorHeartbeatWith(sql, "adv_a"), true);
    const brief = await db.query<{ online: boolean; payout_coins: number }>("select online, payout_coins from ora_advisors");
    assert.equal(brief.rows[0].online, true);
    assert.equal(Number(brief.rows[0].payout_coins), 9);

    await db.exec(`update ora_advisor_presence set last_seen_at = now() - interval '5 minutes' where id = 'on_a'`);
    const dropped = await sweepDisconnectedAdvisorsWith(sql, true);
    assert.equal(dropped, 1);
    const offline = await db.query<{ online: boolean; payout_coins: number; n: number }>(
      `select a.online, a.payout_coins, (select count(*)::int from ora_missed_chat_penalties) as n from ora_advisors a`,
    );
    assert.equal(offline.rows[0].online, false);
    assert.equal(Number(offline.rows[0].payout_coins), 9);
    assert.equal(Number(offline.rows[0].n), 1);
    assert.equal(await noteAdvisorHeartbeatWith(sql, "adv_a"), false);
  });

  it("keeps busy during a live reading and does not penalize a house advisor", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    const sql = sqlFor(db);
    resetMissedChatTablesForTests();
    await seedAdvisor(db, 30);
    await db.exec(`update ora_advisors set busy = true where id = 'adv_a'`);
    await db.exec(`insert into ora_readings (id, advisor_id, client_id, status) values ('read_1', 'adv_a', 'c1', 'live')`);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_live', 'c9', 'adv_a', 'pending', now() - interval '4 minutes')`);
    await settleMissedChatsWith(sql, { advisorId: "adv_a" });
    const live = await db.query<{ online: boolean; busy: boolean }>("select online, busy from ora_advisors");
    assert.equal(live.rows[0].online, false);
    assert.equal(live.rows[0].busy, true);

    await db.exec(`insert into ora_advisors (id, user_id, online, payout_coins) values ('seed_a', 'seed:house', true, 40)`);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_seed', 'c1', 'seed_a', 'pending', now() - interval '4 minutes')`);
    await settleMissedChatsWith(sql, { advisorId: "seed_a" });
    const seed = await db.query<{ online: boolean; payout_coins: number; status: string }>(
      `select a.online, a.payout_coins, r.status from ora_advisors a join ora_chat_requests r on r.advisor_id = a.id where a.id = 'seed_a'`,
    );
    assert.equal(seed.rows[0].online, true);
    assert.equal(Number(seed.rows[0].payout_coins), 40);
    assert.equal(seed.rows[0].status, "expired");
  });

  it("charges at 60 seconds and not at 59, and only once", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    const sql = sqlFor(db);
    resetMissedChatTablesForTests();
    await seedAdvisor(db, 20);
    await db.exec(
      `insert into ora_chat_requests (id, client_id, advisor_id, status, created_at) values ('req_edge', 'c1', 'adv_a', 'pending', now() - interval '59 seconds')`,
    );
    assert.equal((await settleMissedChatsWith(sql, { advisorId: "adv_a" })).length, 0);
    const early = await db.query<{ online: boolean; payout_coins: number; status: string }>(
      `select a.online, a.payout_coins, r.status from ora_advisors a, ora_chat_requests r where r.id = 'req_edge'`,
    );
    assert.equal(early.rows[0].online, true);
    assert.equal(Number(early.rows[0].payout_coins), 20);
    assert.equal(early.rows[0].status, "pending");

    await db.exec(`update ora_chat_requests set created_at = now() - interval '60 seconds' where id = 'req_edge'`);
    const hit = await settleMissedChatsWith(sql, { requestId: "req_edge" });
    assert.equal(hit.length, 1);
    assert.equal(Number(hit[0].charged_coins), 5);
    const after = await db.query<{ online: boolean; payout_coins: number; status: string; n: number }>(
      `select a.online, a.payout_coins, r.status, (select count(*)::int from ora_ledger where kind = 'missed_chat') as n
       from ora_advisors a, ora_chat_requests r where r.id = 'req_edge'`,
    );
    assert.equal(after.rows[0].online, false);
    assert.equal(Number(after.rows[0].payout_coins), 15);
    assert.equal(after.rows[0].status, "expired");
    assert.equal(Number(after.rows[0].n), 1);
    assert.equal((await settleMissedChatsWith(sql, { requestId: "req_edge" })).length, 0);
    const still = await db.query<{ payout_coins: number; n: number }>(
      `select payout_coins, (select count(*)::int from ora_missed_chat_penalties) as n from ora_advisors`,
    );
    assert.equal(Number(still.rows[0].payout_coins), 15);
    assert.equal(Number(still.rows[0].n), 1);
  });

  it("wires the server paths and only slightly enlarges loyalty symbols", () => {
    const ora = readFileSync(new URL("./ora.ts", import.meta.url), "utf8");
    const api = readFileSync(new URL("./ora-missed-chat-api.ts", import.meta.url), "utf8");
    const badge = readFileSync(new URL("../components/loyalty-badge.tsx", import.meta.url), "utf8");
    const loyalty = readFileSync(new URL("./ora-loyalty.ts", import.meta.url), "utf8");
    assert.match(ora, /settleMissedChats/);
    assert.match(ora, /noteAdvisorHeartbeat/);
    assert.match(ora, /sweepDisconnectedAdvisors/);
    assert.match(ora, /INCOMING_REQUEST_TTL_MS/);
    assert.doesNotMatch(ora, /interval '3 minutes'/);
    assert.match(api, /created_at <= now\(\)/);
    assert.doesNotMatch(api, /navigator\.onLine/);
    assert.doesNotMatch(ora, /navigator\.onLine/);
    assert.match(badge, /size-4/);
    assert.doesNotMatch(badge, /size-3\.5|size-6|size-8/);
    assert.match(badge, /silver/);
    assert.match(badge, /gold/);
    assert.match(badge, /diamond/);
    assert.match(badge, /king/);
    assert.match(badge, /queen/);
    assert.match(loyalty, /LOYALTY_SILVER_CENTS = 5_000/);
    assert.match(loyalty, /LOYALTY_GOLD_CENTS = 20_000/);
    assert.match(loyalty, /LOYALTY_DIAMOND_CENTS = 50_000/);
    assert.match(loyalty, /LOYALTY_ROYAL_CENTS = 200_000/);
    const home = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
    const alert = readFileSync(new URL("../components/incoming-request-alert.tsx", import.meta.url), "utf8");
    assert.match(home, /experience === "website"/);
    assert.match(home, /CustomerHomeBody/);
    assert.match(alert, /incomingSecondsLeft/);
  });
});

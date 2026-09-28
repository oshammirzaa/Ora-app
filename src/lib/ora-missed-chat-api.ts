import { INCOMING_REQUEST_TTL_MS } from "./ora-advisor-desk-stats.ts";
import {
  MISSED_CHAT_KIND,
  MISSED_CHAT_PENALTY_COINS,
  MISSED_CHAT_REASON,
  PRESENCE_OFFLINE_GRACE_MS,
  missedChatPenaltyNote,
  presenceHeartbeatStale,
} from "./ora-missed-chat.ts";

export type MissedChatSql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const PENALTY_TABLE_SQL = `
create table if not exists ora_missed_chat_penalties (
  id text primary key,
  advisor_id text not null,
  request_id text not null unique,
  penalty_coins integer not null,
  charged_coins integer not null,
  unpaid_coins integer not null,
  reason text not null,
  created_at timestamptz not null default now()
)`;

function rid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

let tablesReady: Promise<void> | null = null;

export function resetMissedChatTablesForTests() {
  tablesReady = null;
}

export async function ensureMissedChatTables(sql: MissedChatSql) {
  if (tablesReady) return tablesReady;
  const run = (async () => {
    const statements = [
      PENALTY_TABLE_SQL,
      "create index if not exists ora_missed_chat_penalties_advisor_idx on ora_missed_chat_penalties (advisor_id, created_at desc)",
      "alter table ora_advisors add column if not exists last_offline_at timestamptz",
      "alter table ora_advisors add column if not exists current_presence_id text not null default ''",
      `create table if not exists ora_advisor_presence (
        id text primary key,
        advisor_id text not null,
        started_at timestamptz not null default now(),
        ended_at timestamptz,
        seconds integer not null default 0,
        source text not null default 'toggle',
        last_seen_at timestamptz
      )`,
      "alter table ora_advisor_presence add column if not exists last_seen_at timestamptz",
      "create unique index if not exists ora_ledger_kind_ref_idx on ora_ledger (kind, ref_id) where ref_id <> ''",
    ];
    for (const text of statements) {
      try {
        await sql.query(text);
      } catch (err) {
        console.error("[ora] missed-chat schema", err);
      }
    }
  })();
  tablesReady = run;
  await run;
}

const SETTLED_REQUEST_SQL = `
with expired as (
  update ora_chat_requests
  set status = 'expired'
  where id = $1 and status = 'pending' and created_at <= now() - ($2::int * interval '1 millisecond')
  returning id, advisor_id
),
locked as (
  select a.id, a.user_id, greatest(coalesce(a.payout_coins, 0), 0)::int as balance
  from ora_advisors a
  join expired e on e.advisor_id = a.id
  where a.user_id not like 'seed:%'
  for update
),
claim as (
  insert into ora_missed_chat_penalties (
    id, advisor_id, request_id, penalty_coins, charged_coins, unpaid_coins, reason, created_at
  )
  select $3, locked.id, expired.id, $4,
         least($4, locked.balance),
         $4 - least($4, locked.balance),
         $5, now()
  from locked
  join expired on expired.advisor_id = locked.id
  on conflict (request_id) do nothing
  returning advisor_id, charged_coins, unpaid_coins, request_id
),
deduct as (
  update ora_advisors a
  set payout_coins = greatest(0, coalesce(a.payout_coins, 0) - claim.charged_coins),
      online = false,
      busy = case
        when exists (select 1 from ora_readings r where r.advisor_id = a.id and r.status = 'live') then a.busy
        else false
      end,
      last_offline_at = now(),
      current_presence_id = ''
  from claim
  where a.id = claim.advisor_id
  returning a.id as advisor_id, a.user_id, a.payout_coins, claim.charged_coins, claim.unpaid_coins, claim.request_id
),
led as (
  insert into ora_ledger (id, user_id, kind, amount_coins, seconds, note, ref_id)
  select $6, deduct.user_id, $7, -deduct.charged_coins, 0,
    case
      when deduct.unpaid_coins = 0 then 'Missed chat penalty -' || $4::text || ' coins'
      when deduct.charged_coins = 0 then 'Missed chat penalty -' || $4::text || ' coins (unpaid)'
      else 'Missed chat penalty -' || $4::text || ' coins (' || deduct.charged_coins::text || ' charged, ' || deduct.unpaid_coins::text || ' unpaid)'
    end,
    deduct.request_id
  from deduct
  on conflict (kind, ref_id) where ref_id <> '' do nothing
  returning id
),
closed as (
  update ora_advisor_presence p
  set ended_at = now(),
      seconds = greatest(0, floor(extract(epoch from (now() - p.started_at)))::int)
  from deduct d
  where p.advisor_id = d.advisor_id and p.ended_at is null
  returning p.id
)
select e.id as request_id,
       coalesce(d.charged_coins, 0)::int as charged_coins,
       coalesce(d.unpaid_coins, 0)::int as unpaid_coins,
       (select count(*) from led)::int as ledger_n,
       (select count(*) from closed)::int as closed_n
from expired e
left join deduct d on d.request_id = e.id
`;

async function settleOne(sql: MissedChatSql, requestId: string) {
  const rows = await sql.query<{
    request_id: string;
    charged_coins: number;
    unpaid_coins: number;
  }>(SETTLED_REQUEST_SQL, [
    requestId,
    INCOMING_REQUEST_TTL_MS,
    rid("pen"),
    MISSED_CHAT_PENALTY_COINS,
    MISSED_CHAT_REASON,
    rid("led"),
    MISSED_CHAT_KIND,
  ]);
  return rows[0] || null;
}

export async function settleMissedChatsWith(sql: MissedChatSql, opts: { advisorId?: string; requestId?: string } = {}) {
  await ensureMissedChatTables(sql);
  const advisorId = String(opts.advisorId || "");
  const requestId = String(opts.requestId || "");
  const pending = await sql.query<{ id: string }>(
    `select id from ora_chat_requests
     where status = 'pending'
       and created_at <= now() - ($1::int * interval '1 millisecond')
       and ($2::text = '' or advisor_id = $2)
       and ($3::text = '' or id = $3)
     order by created_at asc`,
    [INCOMING_REQUEST_TTL_MS, advisorId, requestId],
  );
  const settled = [];
  for (const row of pending) {
    const result = await settleOne(sql, row.id);
    if (result) settled.push(result);
  }
  return settled;
}

export async function markAdvisorOfflineWith(sql: MissedChatSql, advisorId: string) {
  await ensureMissedChatTables(sql);
  const updated = await sql.query<{ id: string }>(
    `update ora_advisors a
     set online = false,
         busy = case
           when exists (select 1 from ora_readings r where r.advisor_id = a.id and r.status = 'live') then a.busy
           else false
         end,
         last_offline_at = now(),
         current_presence_id = ''
     where a.id = $1 and a.online = true and a.user_id not like 'seed:%'
     returning a.id`,
    [advisorId],
  );
  if (!updated.length) return false;
  await sql
    .query(
      `update ora_advisor_presence
       set ended_at = now(),
           seconds = greatest(0, floor(extract(epoch from (now() - started_at)))::int)
       where advisor_id = $1 and ended_at is null`,
      [advisorId],
    )
    .catch(() => []);
  return true;
}

export async function noteAdvisorHeartbeatWith(sql: MissedChatSql, advisorId: string) {
  await ensureMissedChatTables(sql);
  const [adv] = await sql.query<{ online: boolean; user_id: string }>(
    `select online, user_id from ora_advisors where id = $1`,
    [advisorId],
  );
  if (!adv?.online || String(adv.user_id || "").startsWith("seed:")) return Boolean(adv?.online);
  const [open] = await sql.query<{ last_seen_at: string | null }>(
    `select last_seen_at from ora_advisor_presence
     where advisor_id = $1 and ended_at is null
     order by started_at desc
     limit 1`,
    [advisorId],
  );
  if (open && presenceHeartbeatStale(open.last_seen_at)) {
    await markAdvisorOfflineWith(sql, advisorId);
    return false;
  }
  if (open) {
    await sql.query(
      `update ora_advisor_presence set last_seen_at = now() where advisor_id = $1 and ended_at is null`,
      [advisorId],
    );
  }
  return true;
}

let lastSweep = 0;

export async function sweepDisconnectedAdvisorsWith(sql: MissedChatSql, force = false) {
  const now = Date.now();
  if (!force && now - lastSweep < 15_000) return 0;
  lastSweep = now;
  await ensureMissedChatTables(sql);
  await sql
    .query(
      `update ora_advisor_presence set last_seen_at = now() where ended_at is null and last_seen_at is null`,
    )
    .catch(() => []);
  const stale = await sql.query<{ id: string }>(
    `select a.id
     from ora_advisors a
     join ora_advisor_presence p on p.advisor_id = a.id and p.ended_at is null
     where a.online = true
       and a.user_id not like 'seed:%'
       and p.last_seen_at is not null
       and p.last_seen_at < now() - ($1::int * interval '1 millisecond')`,
    [PRESENCE_OFFLINE_GRACE_MS],
  );
  let n = 0;
  for (const row of stale) {
    if (await markAdvisorOfflineWith(sql, row.id)) n += 1;
  }
  return n;
}

export function penaltyNoteFor(charged: number, unpaid: number) {
  return missedChatPenaltyNote(charged, unpaid);
}

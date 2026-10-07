/**
 * Advisor account closure. The caller must pass the authenticated session user.
 * A client-supplied user id is ignored. Financial rows are kept.
 */

import { unpaidCents } from "./ora-admin-payouts.ts";
import {
  ACCOUNT_DELETION_PHRASE,
  deletionAttemptLimited,
  deletionCommand,
} from "./ora-account-deletion.ts";

export const ADVISOR_DELETION_PAYOUT_BLOCK =
  "Your account cannot be fully deleted while you have an outstanding payout. Please complete your payout first.";

export const ADVISOR_DELETION_LIVE_BLOCK = "Finish your live reading before deleting your account.";

export const DELETED_ADVISOR_NAME = "Deleted advisor";

type QuerySql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const ENSURE_SQL = [
  `create table if not exists ora_account_deletions (
    id text primary key,
    user_id text not null unique,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists ora_account_deletion_attempts (
    id text primary key,
    user_id text not null,
    created_at timestamptz not null default now()
  )`,
];

export function advisorOwesPayout(input: {
  payoutCoins?: unknown;
  pendingCoins?: unknown;
  openPayoutCoins?: unknown;
  messageRemainderCents?: unknown;
  uncreditedCents?: unknown;
}) {
  if (Number(input.uncreditedCents) > 0) return true;
  return (
    unpaidCents({
      payoutCoins: input.payoutCoins,
      pendingCoins: input.pendingCoins,
      openPayoutCoins: input.openPayoutCoins,
      messageRemainderCents: input.messageRemainderCents,
    }) > 0
  );
}

export function advisorDeletionRefusal(input: {
  payoutCoins?: unknown;
  pendingCoins?: unknown;
  openPayoutCoins?: unknown;
  messageRemainderCents?: unknown;
  uncreditedCents?: unknown;
  liveReadings?: unknown;
}) {
  if (Number(input.liveReadings) > 0) return ADVISOR_DELETION_LIVE_BLOCK;
  if (advisorOwesPayout(input)) return ADVISOR_DELETION_PAYOUT_BLOCK;
  return "";
}

async function ensureAdvisorDeletionTables(sql: QuerySql) {
  for (const statement of ENSURE_SQL) await sql.query(statement);
}

const closing = new Set<string>();

export async function deleteAdvisorAccountWith(
  sql: QuerySql,
  userId: string,
  input: { acknowledged?: unknown; confirmation?: unknown; userId?: unknown },
) {
  const sessionUserId = String(userId || "").trim();
  if (!sessionUserId) throw new Error("Unauthorized");
  if (closing.has(sessionUserId)) throw new Error("Deletion is already in progress.");
  closing.add(sessionUserId);
  try {
    const command = deletionCommand(input);
    await ensureAdvisorDeletionTables(sql);
    const attemptId = `dla_${crypto.randomUUID()}`;
    await sql.query("insert into ora_account_deletion_attempts (id, user_id) values ($1, $2)", [
      attemptId,
      sessionUserId,
    ]);
    const [countRow] = await sql.query<{ n: number | string }>(
      `select count(*)::int as n from ora_account_deletion_attempts
       where user_id = $1 and created_at > now() - interval '1 hour'`,
      [sessionUserId],
    );
    if (deletionAttemptLimited(Number(countRow?.n || 0))) {
      throw new Error("Too many deletion attempts. Try again in an hour.");
    }
    if (!command.acknowledged) throw new Error("Confirm that deletion is permanent.");
    if (command.confirmation !== ACCOUNT_DELETION_PHRASE) throw new Error("Type DELETE to confirm.");

    const [userRow] = await sql.query<{ id: string }>(`select id from "user" where id = $1 for update`, [
      sessionUserId,
    ]);
    if (!userRow) throw new Error("Account not found.");

    const [admin] = await sql.query<{ user_id: string }>(
      "select user_id from ora_admins where user_id = $1",
      [sessionUserId],
    );
    if (admin) throw new Error("This account cannot be deleted here.");

    const [advisor] = await sql.query<{
      id: string;
      status: string;
      payout_coins: number | string;
      pending_coins: number | string;
    }>(
      `select id, status,
              coalesce(payout_coins, 0)::int as payout_coins,
              coalesce(pending_coins, 0)::int as pending_coins
       from ora_advisors where user_id = $1
       for update`,
      [sessionUserId],
    );
    if (!advisor) throw new Error("This account cannot be deleted here.");

    const [closed] = await sql.query<{ user_id: string }>(
      "select user_id from ora_account_deletions where user_id = $1",
      [sessionUserId],
    );
    if (closed || advisor.status === "deleted") return { ok: true as const, already: true };

    const [live] = await sql.query<{ n: number | string }>(
      `select count(*)::int as n from ora_readings
       where advisor_id = $1 and status = 'live'`,
      [advisor.id],
    );
    const [openPay] = await sql.query<{ coins: number | string }>(
      `select coalesce(sum(coins), 0)::int as coins from ora_payouts
       where advisor_id = $1
         and lower(coalesce(status, '')) not in ('paid', 'rejected', 'cancelled', 'failed')`,
      [advisor.id],
    );
    const [remainder] = await sql.query<{ cents: number | string }>(
      `select coalesce(sum(advisor_share_cents), 0)::int as cents from ora_paid_messages
       where advisor_id = $1 and credited = false`,
      [advisor.id],
    );
    const refusal = advisorDeletionRefusal({
      payoutCoins: advisor.payout_coins,
      pendingCoins: advisor.pending_coins,
      openPayoutCoins: openPay?.coins,
      messageRemainderCents: 0,
      uncreditedCents: remainder?.cents,
      liveReadings: live?.n,
    });
    if (refusal) throw new Error(refusal);

    const [profile] = await sql.query<{ email: string }>(
      "select coalesce(email, '') as email from ora_profiles where user_id = $1",
      [sessionUserId],
    );
    const [authEmail] = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [
      sessionUserId,
    ]);
    const email = String(profile?.email || authEmail?.email || "");

    await sql.query(
      `update ora_advisors
       set name = $2,
           bio = '',
           experience = '',
           photo_url = '',
           video_url = '',
           status = 'deleted',
           online = false,
           busy = false,
           email = '',
           phone = '',
           legal_name = '',
           country = '',
           accepts_chat = false,
           away = true,
           gallery_json = '[]',
           headline = '',
           reading_notice = '',
           quick_greeting = '',
           auto_response = '',
           auto_live_greeting = ''
       where user_id = $1`,
      [sessionUserId, DELETED_ADVISOR_NAME],
    );

    await sql.query(
      `update ora_profiles
       set display_name = $2, email = '', gender = '', date_of_birth = '', status = 'deleted'
       where user_id = $1`,
      [sessionUserId, DELETED_ADVISOR_NAME],
    );
    await sql.query(
      `update "user"
       set name = $2, email = $3, image = null, "emailVerified" = false, "updatedAt" = now()
       where id = $1`,
      [sessionUserId, DELETED_ADVISOR_NAME, `deleted+${sessionUserId}@users.invalid`],
    );
    await sql.query(`delete from "session" where "userId" = $1`, [sessionUserId]);
    await sql.query(`delete from "account" where "userId" = $1`, [sessionUserId]);
    if (email) {
      await sql.query(`delete from "verification" where lower(identifier) = lower($1)`, [email]);
    }
    await sql.query("delete from ora_password_resets where user_id = $1", [sessionUserId]);

    await sql.query(
      `update ora_applications
       set name = $2, legal_name = '', email = '', phone = '', country = '', bio = '',
           experience = '', photo_url = '', video_url = '', availability = ''
       where user_id = $1`,
      [sessionUserId, DELETED_ADVISOR_NAME],
    );

    await sql.query(
      `update ora_chat_requests set status = 'cancelled'
       where advisor_id = $1 and status = 'pending'`,
      [advisor.id],
    );

    const auditId = `advdel_${crypto.randomUUID()}`;
    await sql.query("insert into ora_account_deletions (id, user_id) values ($1, $2)", [
      auditId,
      sessionUserId,
    ]);
    await sql.query(
      `insert into ora_owner_log (id, actor_id, act, target_type, target_id, body)
       values ($1, $2, 'advisor_account_deleted', 'advisor', $3, $4)`,
      [
        `${auditId}-log`,
        sessionUserId,
        advisor.id,
        "Advisor account closed. Readings, payouts, and accounting records retained. Personal profile removed.",
      ],
    );

    return { ok: true as const, already: false };
  } finally {
    closing.delete(sessionUserId);
  }
}

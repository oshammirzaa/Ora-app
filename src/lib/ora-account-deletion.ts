/**
 * Customer account deletion.
 * The caller must pass the session user id. This module never accepts a
 * target user id from the client.
 */

export const ACCOUNT_DELETION_PHRASE = "DELETE";
export const DELETION_ATTEMPTS_PER_HOUR = 5;
export const PAYMENT_RETENTION = "7 years";
export const SAFETY_RETENTION = "24 months";
export const DELETED_PROFILE_NAME = "Deleted member";

export const DELETION_REMOVED = [
  "display name, email, password, and Google or X sign-in",
  "gender and date of birth",
  "profile photo",
  "private reading and inbox messages, including uploaded images",
  "saved advisors, blocks, and support messages",
  "advisor-application contact details, when you are not an approved advisor",
  "active sessions",
] as const;

export const DELETION_RETAINED = [
  `Coin, tip, membership, and payment records (amount, date, and payment reference, never the full card number) for ${PAYMENT_RETENTION}, for tax, accounting, and disputes. Unused coins and remaining membership time are forfeited and are not refunded by deletion.`,
  `Safety and fraud records, including report category and sign-in IP or device label when one was stored, for ${SAFETY_RETENTION}. Message text in those records is removed.`,
  "Review text you published on an advisor profile, without your name, email, or photo, so the advisor rating stays accurate.",
] as const;

export function deletionCommand(input: {
  acknowledged?: unknown;
  confirmation?: unknown;
  userId?: unknown;
}) {
  return {
    acknowledged: input.acknowledged === true,
    confirmation: String(input.confirmation ?? "").trim(),
  };
}

export function deletionRequestAllowed(input: { acknowledged: boolean; confirmation: string }) {
  return input.acknowledged && input.confirmation === ACCOUNT_DELETION_PHRASE;
}

export function deletionAttemptLimited(attemptCount: number) {
  return Number(attemptCount) > DELETION_ATTEMPTS_PER_HOUR;
}

export function accountAccessBlock(status: string | null | undefined) {
  if (status === "suspended") return "This account is suspended.";
  if (status === "deleted") return "This account is closed.";
  return "";
}

export function deletionFailure(reason: string) {
  if (reason === "advisor") {
    return "Advisor accounts cannot be deleted here. Contact support so the public profile and payouts are handled separately.";
  }
  if (reason === "admin") return "This account cannot be deleted here.";
  if (reason === "missing") return "Account not found.";
  return "";
}

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
  `create index if not exists ora_account_deletion_attempts_user_idx
    on ora_account_deletion_attempts (user_id, created_at desc)`,
  `alter table ora_wallets add column if not exists membership_active boolean not null default false`,
  `alter table ora_wallets add column if not exists membership_cancel_at_period_end boolean not null default false`,
  `alter table ora_wallets add column if not exists membership_plan text not null default ''`,
  `alter table ora_wallets add column if not exists membership_seconds integer not null default 0`,
];

const DELETE_FUNCTION = `
create or replace function ora_delete_customer_account(p_user_id text, p_audit_id text)
returns text
language plpgsql
as $ora$
declare
  v_role text;
  v_status text;
  v_email text;
begin
  perform 1 from "user" where id = p_user_id for update;
  if not found then
    return 'missing';
  end if;

  select role, status, email into v_role, v_status, v_email
  from ora_profiles where user_id = p_user_id for update;
  if coalesce(v_email, '') = '' then
    select email into v_email from "user" where id = p_user_id;
  end if;

  if exists (select 1 from ora_account_deletions where user_id = p_user_id) or v_status = 'deleted' then
    return 'already';
  end if;
  if exists (select 1 from ora_admins where user_id = p_user_id) then
    return 'admin';
  end if;
  if lower(coalesce(v_role, '')) = 'advisor'
     or exists (select 1 from ora_advisors where user_id = p_user_id) then
    return 'advisor';
  end if;

  update ora_profiles
  set display_name = 'Deleted member',
      email = '',
      gender = '',
      date_of_birth = '',
      status = 'deleted',
      age_confirmed_at = null
  where user_id = p_user_id;
  if not found then
    insert into ora_profiles (user_id, display_name, role, email, gender, date_of_birth, status)
    values (p_user_id, 'Deleted member', 'client', '', '', '', 'deleted');
  end if;

  update "user"
  set name = 'Deleted member',
      email = 'deleted+' || id || '@users.invalid',
      image = null,
      "emailVerified" = false,
      "updatedAt" = now()
  where id = p_user_id;

  delete from "session" where "userId" = p_user_id;
  delete from "account" where "userId" = p_user_id;
  if coalesce(v_email, '') <> '' then
    delete from "verification" where lower(identifier) = lower(v_email);
  end if;
  delete from ora_password_resets where user_id = p_user_id;

  update ora_messages
  set body = '', image_url = ''
  where reading_id in (select id from ora_readings where client_id = p_user_id);
  update ora_advisor_inbox_messages
  set body = '', image_url = ''
  where customer_id = p_user_id;
  update ora_advisor_inbox
  set last_body = ''
  where customer_id = p_user_id;
  update ora_advisor_notes set body = '' where customer_id = p_user_id;
  update ora_advisor_note_entries set body = '' where customer_id = p_user_id;
  update ora_advisor_reminders set note = '' where customer_id = p_user_id;
  update ora_advisor_reports
  set body = ''
  where customer_id = p_user_id or reporter_user_id = p_user_id;

  update ora_applications
  set name = 'Deleted member',
      legal_name = '',
      email = '',
      phone = '',
      country = '',
      bio = '',
      experience = '',
      photo_url = '',
      video_url = '',
      availability = ''
  where user_id = p_user_id;

  delete from ora_favorites where user_id = p_user_id;
  delete from ora_customer_blocks where customer_id = p_user_id;

  update ora_ticket_messages
  set body = ''
  where author_id = p_user_id
     or ticket_id in (select id from ora_tickets where client_id = p_user_id);
  update ora_ticket_notes
  set body = ''
  where author_id = p_user_id
     or ticket_id in (select id from ora_tickets where client_id = p_user_id);

  update ora_ai_reports
  set excerpt = '', context_json = ''
  where customer_id = p_user_id;
  update ora_advisor_login_ips
  set display_name = '', email = ''
  where user_id = p_user_id;

  update ora_wallets
  set subscribed = false,
      membership_active = false,
      membership_cancel_at_period_end = true,
      membership_plan = '',
      membership_seconds = 0
  where user_id = p_user_id;

  update ora_chat_requests
  set status = 'cancelled'
  where client_id = p_user_id and status = 'pending';
  update ora_readings
  set status = 'ended', ended_at = coalesce(ended_at, now())
  where client_id = p_user_id and status = 'live';

  insert into ora_account_deletions (id, user_id) values (p_audit_id, p_user_id);
  insert into ora_owner_log (id, actor_id, act, target_type, target_id, body)
  values (
    p_audit_id || '-log',
    p_user_id,
    'account_deleted',
    'profile',
    p_user_id,
    'Customer personal data removed. Payment records retained 7 years. Safety records retained 24 months.'
  );

  delete from ora_payments where created_at < now() - interval '7 years';
  delete from ora_ledger where created_at < now() - interval '7 years';
  delete from ora_customer_tips where created_at < now() - interval '7 years';
  delete from ora_paid_messages where created_at < now() - interval '7 years';
  delete from ora_ai_reports where created_at < now() - interval '24 months';
  delete from ora_advisor_login_ips where logged_in_at < now() - interval '24 months';
  delete from ora_account_deletions where created_at < now() - interval '24 months';
  delete from ora_account_deletion_attempts where created_at < now() - interval '1 day';

  return 'ok';
end;
$ora$;
`;

async function ensureDeletionSchema(sql: QuerySql) {
  for (const statement of ENSURE_SQL) await sql.query(statement);
  await sql.query(DELETE_FUNCTION);
}

export async function deleteCustomerAccountWith(
  sql: QuerySql,
  userId: string,
  input: { acknowledged?: unknown; confirmation?: unknown; userId?: unknown },
) {
  const sessionUserId = String(userId || "").trim();
  if (!sessionUserId) throw new Error("Unauthorized");
  const command = deletionCommand(input);
  await ensureDeletionSchema(sql);
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

  const auditId = `del_${crypto.randomUUID()}`;
  const [row] = await sql.query<{ ora_delete_customer_account: string }>(
    "select ora_delete_customer_account($1, $2)",
    [sessionUserId, auditId],
  );
  const reason = String(row?.ora_delete_customer_account || "");
  const failure = deletionFailure(reason);
  if (failure) throw new Error(failure);
  if (reason !== "ok" && reason !== "already") throw new Error("Could not delete this account.");
  return { ok: true as const, already: reason === "already" };
}

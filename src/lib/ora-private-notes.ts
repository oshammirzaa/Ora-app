export const PRIVATE_NOTE_MAX = 500;

export const PRIVATE_NOTE_TABLE_SQL = `
create table if not exists ora_advisor_notes (
  advisor_id text not null,
  customer_id text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`;

export const READ_PRIVATE_NOTE_SQL = `
select body
from ora_advisor_notes
where advisor_id = $1 and customer_id = $2
limit 1`;

export const WRITE_PRIVATE_NOTE_SQL = `
insert into ora_advisor_notes (advisor_id, customer_id, body, updated_at)
values ($1, $2, $3, now())
on conflict (advisor_id, customer_id)
do update set body = excluded.body, updated_at = now()`;

/** A note is allowed only when this advisor already has a request, reading, or inbox thread with the client. */
export const MAY_NOTE_CLIENT_SQL = `
select case when
  exists (select 1 from ora_chat_requests where advisor_id = $1 and client_id = $2)
  or exists (select 1 from ora_readings where advisor_id = $1 and client_id = $2)
  or exists (select 1 from ora_advisor_inbox where advisor_id = $1 and customer_id = $2)
then 1 else 0 end as ok`;

export type NoteQuery = (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;

export function normalizePrivateNote(body: unknown) {
  return String(body ?? "").replace(/\r\n/g, "\n").slice(0, PRIVATE_NOTE_MAX);
}

export function privateNoteSaved(body: unknown) {
  return normalizePrivateNote(body).trim().length > 0;
}

export async function readAdvisorPrivateNote(query: NoteQuery, advisorId: string, customerId: string) {
  const rows = await query(READ_PRIVATE_NOTE_SQL, [advisorId, customerId]);
  return normalizePrivateNote(rows[0]?.body);
}

export async function writeAdvisorPrivateNote(query: NoteQuery, advisorId: string, customerId: string, body: unknown) {
  const clean = normalizePrivateNote(body);
  await query(WRITE_PRIVATE_NOTE_SQL, [advisorId, customerId, clean]);
  return clean;
}

export async function advisorMayNoteClient(query: NoteQuery, advisorId: string, customerId: string) {
  if (!advisorId || !customerId) return false;
  const rows = await query(MAY_NOTE_CLIENT_SQL, [advisorId, customerId]);
  return Number(rows[0]?.ok) === 1;
}

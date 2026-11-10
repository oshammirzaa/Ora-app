/** Admin private-reading archive. Reads stored messages. Does not bill or rewrite them. */

import type { AdminGateInput } from "./ora-admin-auth.ts";
import { adminGate } from "./ora-admin-auth.ts";
import {
  classifyChat,
  durationLabel,
  profileName,
  transactionStatusLabel,
  utcDay,
  type ChatType,
  type TransactionSql,
} from "./ora-admin-transactions.ts";
import { displayChatImage } from "./ora-message-media.ts";

export const PRIVATE_READINGS_PERMISSION = "private_readings";
export const PDF_MESSAGE_CAP = 5000;

export function privateReadingGate(input: Omit<AdminGateInput, "permission">) {
  return adminGate({ ...input, permission: PRIVATE_READINGS_PERMISSION });
}

export type PrivateReading = {
  id: string;
  clientId: string;
  clientName: string;
  advisorId: string;
  advisorName: string;
  startedAt: string;
  endedAt: string;
  seconds: number;
  freeSeconds: number;
  paidSeconds: number;
  coins: number;
  status: string;
  statusLabel: string;
  chatType: ChatType;
  chatTypeLabel: string;
  endReason: string;
  messageCount: number;
  archived: boolean;
};

export type PrivateReadingFilters = {
  client?: string;
  advisor?: string;
  clientId?: string;
  from?: string;
  to?: string;
  type?: "all" | ChatType;
  status?: "all" | "live" | "completed" | "cancelled" | "historical";
};

export type TranscriptMessage = {
  id: string;
  role: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
  recalled: boolean;
  hasImage: boolean;
  attachment: string;
  tipGift: string;
};

export function attachmentNote(raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (displayChatImage(value)) return "Photo attached";
  return "Attachment stored";
}

export function senderRole(role: unknown) {
  const name = String(role || "").trim().toLowerCase();
  if (name === "client" || name === "customer") return "Customer";
  if (name === "advisor") return "Advisor";
  return name ? name.slice(0, 1).toUpperCase() + name.slice(1) : "Message";
}

export function buildPrivateReading(input: {
  id: string;
  clientId: string;
  clientName: string;
  advisorId: string;
  advisorName: string;
  startedAt: string;
  endedAt?: string;
  seconds?: unknown;
  bonusUsed?: unknown;
  weeklyUsed?: unknown;
  coinsSpent?: unknown;
  status?: string;
  endReason?: string;
  messageCount?: unknown;
  archived?: unknown;
}): PrivateReading {
  const bill = classifyChat(input);
  const status = String(input.status || "");
  const chatType = bill.chatType;
  return {
    id: input.id,
    clientId: input.clientId,
    clientName: profileName(input.clientName, "Unnamed client"),
    advisorId: input.advisorId,
    advisorName: profileName(input.advisorName, "Unknown advisor"),
    startedAt: String(input.startedAt || ""),
    endedAt: String(input.endedAt || ""),
    seconds: bill.seconds,
    freeSeconds: bill.freeSeconds,
    paidSeconds: bill.paidSeconds,
    coins: bill.coins,
    status,
    statusLabel: transactionStatusLabel("chat", status),
    chatType,
    chatTypeLabel: chatType === "free" ? "Free" : chatType === "paid" ? "Paid" : "Mixed",
    endReason: String(input.endReason || "").trim(),
    messageCount: Math.max(0, Math.floor(Number(input.messageCount) || 0)),
    archived: input.archived === true || input.archived === "t" || input.archived === "true" || input.archived === 1,
  };
}

export function mapTranscriptMessage(
  row: {
    id: string;
    role?: string;
    body?: string;
    created_at?: string;
    image_url?: string | null;
    tip_gift?: string | null;
    recalled_at?: string | null;
  },
  names: { customer: string; advisor: string },
): TranscriptMessage {
  const role = String(row.role || "");
  const who = senderRole(role);
  return {
    id: String(row.id),
    role,
    senderRole: who,
    senderName: who === "Customer" ? names.customer : who === "Advisor" ? names.advisor : who,
    body: String(row.body ?? ""),
    createdAt: String(row.created_at || ""),
    recalled: Boolean(row.recalled_at && String(row.recalled_at).trim()),
    hasImage: Boolean(displayChatImage(row.image_url)),
    attachment: attachmentNote(row.image_url),
    tipGift: String(row.tip_gift || "").trim(),
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function filterPrivateReadings(rows: PrivateReading[], filters: PrivateReadingFilters) {
  const client = String(filters.client || "").trim().toLowerCase();
  const advisor = String(filters.advisor || "").trim().toLowerCase();
  const clientId = String(filters.clientId || "").trim();
  const from = DAY.test(String(filters.from || "")) ? String(filters.from) : "";
  const to = DAY.test(String(filters.to || "")) ? String(filters.to) : "";
  const type = filters.type && filters.type !== "all" ? filters.type : "";
  const status = filters.status && filters.status !== "all" ? filters.status : "";
  return rows.filter((row) => {
    if (clientId && row.clientId !== clientId) return false;
    if (client && !`${row.clientName} ${row.clientId}`.toLowerCase().includes(client)) return false;
    if (advisor && !`${row.advisorName} ${row.advisorId}`.toLowerCase().includes(advisor)) return false;
    const day = utcDay(row.startedAt);
    if (from && (!day || day < from)) return false;
    if (to && (!day || day > to)) return false;
    if (type && row.chatType !== type) return false;
    if (status === "live" && row.statusLabel !== "Live") return false;
    if (status === "completed" && row.statusLabel !== "Completed") return false;
    if (status === "cancelled" && row.statusLabel !== "Cancelled") return false;
    if (status === "historical" && row.statusLabel === "Live") return false;
    return true;
  });
}

export function paginatePrivateReadings<T>(rows: T[], page: number, pageSize = 25) {
  const size = Math.min(100, Math.max(1, Math.floor(pageSize) || 25));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), page: current, pages, total: rows.length, pageSize: size };
}

export function summarizePrivateReadings(rows: PrivateReading[]) {
  return {
    total: rows.length,
    free: rows.filter((row) => row.chatType === "free").length,
    paid: rows.filter((row) => row.chatType === "paid").length,
    mixed: rows.filter((row) => row.chatType === "mixed").length,
    live: rows.filter((row) => row.statusLabel === "Live").length,
    coins: rows.reduce((sum, row) => sum + row.coins, 0),
  };
}

export async function ensureArchiveTables(sql: TransactionSql) {
  await sql.query(
    `create table if not exists ora_reading_archives (
      reading_id text primary key,
      ciphertext text not null,
      iv text not null,
      byte_length integer not null default 0,
      message_count integer not null default 0,
      generated_at timestamptz not null default now(),
      generated_by text not null default ''
    )`,
  );
  await sql.query(
    `create table if not exists ora_reading_access (
      id text primary key,
      admin_id text not null,
      reading_id text not null,
      customer_id text not null default '',
      advisor_id text not null default '',
      action text not null,
      created_at timestamptz not null default now()
    )`,
  );
}

type ReadingRow = {
  id: string;
  client_id: string;
  client_name: string;
  advisor_id: string;
  advisor_name: string;
  started_at: string;
  ended_at: string | null;
  seconds: number;
  bonus_used: number;
  weekly_used: number;
  coins_spent: number;
  status: string;
  end_reason: string;
  message_count: number;
  archived: boolean | string | number;
};

function fromRow(row: ReadingRow) {
  return buildPrivateReading({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    advisorId: row.advisor_id,
    advisorName: row.advisor_name,
    startedAt: String(row.started_at || ""),
    endedAt: row.ended_at ? String(row.ended_at) : "",
    seconds: row.seconds,
    bonusUsed: row.bonus_used,
    weeklyUsed: row.weekly_used,
    coinsSpent: row.coins_spent,
    status: row.status,
    endReason: row.end_reason,
    messageCount: row.message_count,
    archived: row.archived,
  });
}

const READING_SQL = `
  select r.id, r.client_id, coalesce(nullif(p.display_name, ''), '') as client_name,
         r.advisor_id, coalesce(a.name, '') as advisor_name,
         r.started_at::text as started_at, r.ended_at::text as ended_at,
         coalesce(r.seconds, 0)::int as seconds,
         coalesce(r.bonus_used, 0)::int as bonus_used,
         coalesce(r.weekly_used, 0)::int as weekly_used,
         coalesce(r.coins_spent, 0)::int as coins_spent,
         r.status,
         coalesce(e.reason, '') as end_reason,
         coalesce(m.n, 0)::int as message_count,
         case when ar.reading_id is null then false else true end as archived
  from ora_readings r
  left join ora_advisors a on a.id = r.advisor_id
  left join ora_profiles p on p.user_id = r.client_id
  left join ora_reading_ends e on e.reading_id = r.id
  left join ora_reading_archives ar on ar.reading_id = r.id
  left join (
    select reading_id, count(*)::int as n from ora_messages group by reading_id
  ) m on m.reading_id = r.id
`;

export async function loadPrivateReadings(sql: TransactionSql) {
  const { ensureReadingEndTable } = await import("./ora-admin-transactions.ts");
  await ensureReadingEndTable(sql);
  await ensureArchiveTables(sql);
  const rows = await sql.query<ReadingRow>(`${READING_SQL} order by r.started_at desc`);
  return rows.map(fromRow);
}

async function loadOne(sql: TransactionSql, readingId: string) {
  const { ensureReadingEndTable } = await import("./ora-admin-transactions.ts");
  await ensureReadingEndTable(sql);
  await ensureArchiveTables(sql);
  const rows = await sql.query<ReadingRow>(`${READING_SQL} where r.id = $1 limit 1`, [readingId]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function loadTranscriptPage(sql: TransactionSql, readingId: string, offset: number, limit: number) {
  const reading = await loadOne(sql, readingId);
  if (!reading) return null;
  const start = Math.max(0, Math.floor(offset) || 0);
  const size = Math.min(100, Math.max(1, Math.floor(limit) || 40));
  const [count] = await sql<{ n: number }>`
    select count(*)::int as n from ora_messages where reading_id = ${readingId}
  `;
  const messages = await sql<{
    id: string;
    role: string;
    body: string;
    created_at: string;
    image_url: string | null;
    tip_gift: string | null;
    recalled_at: string | null;
  }>`
    select id, role, body, created_at::text as created_at,
           coalesce(image_url, '') as image_url,
           coalesce(tip_gift, '') as tip_gift,
           recalled_at::text as recalled_at
    from ora_messages
    where reading_id = ${readingId}
    order by created_at asc, id asc
    limit ${size} offset ${start}
  `;
  const names = { customer: reading.clientName, advisor: reading.advisorName };
  return {
    reading,
    messages: messages.map((row) => mapTranscriptMessage(row, names)),
    total: Number(count?.n) || 0,
    offset: start,
    limit: size,
  };
}

export async function loadMessageImage(sql: TransactionSql, readingId: string, messageId: string) {
  const [row] = await sql<{ image_url: string | null; recalled_at: string | null }>`
    select coalesce(image_url, '') as image_url, recalled_at::text as recalled_at
    from ora_messages
    where id = ${messageId} and reading_id = ${readingId}
  `;
  if (!row) return null;
  return {
    image: displayChatImage(row.image_url),
    recalled: Boolean(row.recalled_at && String(row.recalled_at).trim()),
  };
}

export async function loadTranscriptForPdf(sql: TransactionSql, readingId: string) {
  const reading = await loadOne(sql, readingId);
  if (!reading) return null;
  const messages = await sql<{
    id: string;
    role: string;
    body: string;
    created_at: string;
    image_url: string | null;
    tip_gift: string | null;
    recalled_at: string | null;
  }>`
    select id, role, body, created_at::text as created_at,
           coalesce(image_url, '') as image_url,
           coalesce(tip_gift, '') as tip_gift,
           recalled_at::text as recalled_at
    from ora_messages
    where reading_id = ${readingId}
    order by created_at asc, id asc
    limit ${PDF_MESSAGE_CAP + 1}
  `;
  const names = { customer: reading.clientName, advisor: reading.advisorName };
  const truncated = messages.length > PDF_MESSAGE_CAP;
  const page = truncated ? messages.slice(0, PDF_MESSAGE_CAP) : messages;
  return {
    reading,
    truncated,
    messages: page.map((row) => mapTranscriptMessage(row, names)),
  };
}

export async function recordReadingAccess(
  sql: TransactionSql,
  input: { id: string; adminId: string; readingId: string; customerId: string; advisorId: string; action: string },
) {
  await ensureArchiveTables(sql);
  const action = String(input.action || "").slice(0, 32);
  if (!action) throw new Error("Missing access action.");
  await sql`
    insert into ora_reading_access (id, admin_id, reading_id, customer_id, advisor_id, action)
    values (${input.id}, ${input.adminId}, ${input.readingId}, ${input.customerId}, ${input.advisorId}, ${action})
  `;
}

export async function loadReadingAccess(sql: TransactionSql, readingId: string) {
  await ensureArchiveTables(sql);
  const rows = await sql<{
    id: string;
    admin_id: string;
    admin_name: string;
    action: string;
    created_at: string;
  }>`
    select a.id, a.admin_id, coalesce(p.display_name, '') as admin_name, a.action, a.created_at::text as created_at
    from ora_reading_access a
    left join ora_profiles p on p.user_id = a.admin_id
    where a.reading_id = ${readingId}
    order by a.created_at desc
    limit 20
  `;
  return rows.map((row) => ({
    id: row.id,
    adminId: row.admin_id,
    adminName: String(row.admin_name || "").trim() || row.admin_id,
    action: row.action,
    at: String(row.created_at || ""),
  }));
}

export function readingPdfFilename(reading: { id: string; clientName: string }) {
  const slug = reading.clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `ora-private-reading-${slug || "client"}-${reading.id.slice(0, 18)}.pdf`;
}

export { durationLabel };

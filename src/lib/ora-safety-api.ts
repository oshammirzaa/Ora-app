import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureAccount, rid } from "@/lib/ora";
import {
  canCreateSafetyReport,
  DAILY_SAFETY_REPORT_LIMIT,
  pairIsBlockedFlags,
  parseSafetyReportKind,
  parseSafetyReportReason,
  parseSafetyReportStatus,
  SAFETY_REPORT_NOTE_MAX,
  type SafetyReporterRole,
} from "@/lib/ora-safety";

export const CUSTOMER_BLOCK_SQL = `
create table if not exists ora_customer_blocks (
  customer_id text not null,
  advisor_id text not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, advisor_id)
)`;

const REPORT_ALTERS = [
  `create table if not exists ora_advisor_blocks (
  advisor_id text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`,
  CUSTOMER_BLOCK_SQL,
  "create index if not exists ora_customer_blocks_adv_idx on ora_customer_blocks (advisor_id, created_at desc)",
  "alter table ora_advisor_reports add column if not exists reporter_user_id text not null default ''",
  "alter table ora_advisor_reports add column if not exists reported_user_id text not null default ''",
  "alter table ora_advisor_reports add column if not exists reporter_role text not null default 'advisor'",
  "alter table ora_advisor_reports add column if not exists reading_id text not null default ''",
  "alter table ora_advisor_reports add column if not exists admin_note text not null default ''",
  "alter table ora_advisor_reports add column if not exists reviewed_at timestamptz",
  "alter table ora_advisor_reports add column if not exists resolved_at timestamptz",
  "alter table ora_advisor_reports add column if not exists resolved_by text not null default ''",
  "create index if not exists ora_advisor_reports_reporter_idx on ora_advisor_reports (reporter_user_id, created_at desc)",
];

let ready = false;

export async function ensureSafetyTables() {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ora_advisor_reports (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  kind text not null,
  reason text not null,
  body text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now()
)`).catch(() => {});
  for (const stmt of REPORT_ALTERS) {
    await sql.query(stmt).catch(() => {});
  }
  ready = true;
}

export async function pairBlockFlags(advisorId: string, customerId: string) {
  await ensureSafetyTables();
  const sql = await getSql();
  const [advisorRow] = await sql<{ n: number }>`
    select 1 as n from ora_advisor_blocks
    where advisor_id = ${advisorId} and customer_id = ${customerId}
    limit 1
  `.catch(() => []);
  const [customerRow] = await sql<{ n: number }>`
    select 1 as n from ora_customer_blocks
    where advisor_id = ${advisorId} and customer_id = ${customerId}
    limit 1
  `.catch(() => []);
  return {
    advisorBlockedCustomer: Boolean(advisorRow),
    customerBlockedAdvisor: Boolean(customerRow),
  };
}

export async function pairIsBlocked(advisorId: string, customerId: string) {
  return pairIsBlockedFlags(await pairBlockFlags(advisorId, customerId));
}

async function loadAdvisorRow(id: string) {
  const sql = await getSql();
  const [row] = await sql<{ id: string; user_id: string; name: string; slug: string }>`
    select id, user_id, name, slug from ora_advisors
    where (id = ${id} or slug = ${id}) and status = 'live'
  `;
  return row || null;
}

async function reportsToday(userId: string) {
  const sql = await getSql();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await sql<{ n: number }>`
    select count(*)::int as n from ora_advisor_reports
    where reporter_user_id = ${userId} and created_at >= ${start.toISOString()}::timestamptz
  `.catch(() => [{ n: 0 }]);
  return Number(row?.n) || 0;
}

async function insertSafetyReport(input: {
  advisorId: string;
  customerId: string;
  reporterUserId: string;
  reportedUserId: string;
  reporterRole: SafetyReporterRole;
  kind: string;
  reason: string;
  body: string;
  readingId?: string;
}) {
  const allowed = canCreateSafetyReport({
    reporterUserId: input.reporterUserId,
    reportedUserId: input.reportedUserId,
    reportsToday: await reportsToday(input.reporterUserId),
  });
  if (!allowed.ok) throw new Error(allowed.reason);
  const sql = await getSql();
  const id = rid("rpt");
  await sql`
    insert into ora_advisor_reports (
      id, advisor_id, customer_id, kind, reason, body, status, created_at,
      reporter_user_id, reported_user_id, reporter_role, reading_id
    )
    values (
      ${id}, ${input.advisorId}, ${input.customerId}, ${input.kind}, ${input.reason},
      ${input.body.slice(0, SAFETY_REPORT_NOTE_MAX)}, 'open', now(),
      ${input.reporterUserId}, ${input.reportedUserId}, ${input.reporterRole}, ${input.readingId || ""}
    )
  `;
  return id;
}

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export const getPairSafety = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: clip(input.advisorId, 80) }))
  .handler(async ({ context, data }) => {
    await ensureSafetyTables();
    const advisor = await loadAdvisorRow(data.advisorId);
    if (!advisor) throw new Error("Advisor not available.");
    const flags = await pairBlockFlags(advisor.id, context.userId);
    return {
      advisorId: advisor.id,
      advisorName: advisor.name,
      blockedByMe: flags.customerBlockedAdvisor,
      blocked: pairIsBlockedFlags(flags),
    };
  });

export const setCustomerBlock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string; blocked: boolean }) => ({
    advisorId: clip(input.advisorId, 80),
    blocked: Boolean(input.blocked),
  }))
  .handler(async ({ context, data }) => {
    await ensureAccount(context.userId, "");
    await ensureSafetyTables();
    const advisor = await loadAdvisorRow(data.advisorId);
    if (!advisor) throw new Error("Advisor not available.");
    if (advisor.user_id === context.userId) throw new Error("You cannot block your own account.");
    const sql = await getSql();
    if (data.blocked) {
      await sql`
        insert into ora_customer_blocks (customer_id, advisor_id, created_at)
        values (${context.userId}, ${advisor.id}, now())
        on conflict (customer_id, advisor_id) do nothing
      `;
      await sql`
        update ora_chat_requests
        set status = 'expired'
        where advisor_id = ${advisor.id} and client_id = ${context.userId} and status = 'pending'
      `.catch(() => {});
    } else {
      await sql`
        delete from ora_customer_blocks
        where customer_id = ${context.userId} and advisor_id = ${advisor.id}
      `;
    }
    const flags = await pairBlockFlags(advisor.id, context.userId);
    return {
      ok: true as const,
      blocked: data.blocked,
      advisorId: advisor.id,
      pairBlocked: pairIsBlockedFlags(flags),
    };
  });

export const listCustomerBlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureSafetyTables();
    const rows = await (await getSql())<{ advisor_id: string; name: string; slug: string; created_at: string }>`
      select b.advisor_id, coalesce(a.name, 'Advisor') as name, coalesce(a.slug, b.advisor_id) as slug,
             b.created_at::text as created_at
      from ora_customer_blocks b
      left join ora_advisors a on a.id = b.advisor_id
      where b.customer_id = ${context.userId}
      order by b.created_at desc
      limit 80
    `.catch(() => [] as Array<{ advisor_id: string; name: string; slug: string; created_at: string }>);
    return {
      blocked: rows.map((r) => ({
        advisorId: r.advisor_id,
        name: r.name,
        slug: r.slug,
        at: r.created_at,
      })),
    };
  });

export const reportCustomerAdvisor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string; reason?: string; body?: string; readingId?: string }) => ({
    advisorId: clip(input.advisorId, 80),
    reason: parseSafetyReportReason(input.reason),
    body: clip(input.body, SAFETY_REPORT_NOTE_MAX),
    readingId: clip(input.readingId, 80),
  }))
  .handler(async ({ context, data }) => {
    await ensureAccount(context.userId, "");
    await ensureSafetyTables();
    const advisor = await loadAdvisorRow(data.advisorId);
    if (!advisor) throw new Error("Advisor not available.");
    const id = await insertSafetyReport({
      advisorId: advisor.id,
      customerId: context.userId,
      reporterUserId: context.userId,
      reportedUserId: advisor.user_id,
      reporterRole: "customer",
      kind: "report",
      reason: data.reason,
      body: data.body,
      readingId: data.readingId,
    });
    return { ok: true as const, id };
  });

export async function createAdvisorSafetyReport(input: {
  advisorId: string;
  advisorUserId: string;
  customerId: string;
  kind?: string;
  reason?: string;
  body?: string;
  readingId?: string;
}) {
  await ensureSafetyTables();
  return insertSafetyReport({
    advisorId: input.advisorId,
    customerId: input.customerId,
    reporterUserId: input.advisorUserId,
    reportedUserId: input.customerId,
    reporterRole: "advisor",
    kind: parseSafetyReportKind(input.kind),
    reason: parseSafetyReportReason(input.reason),
    body: String(input.body || ""),
    readingId: input.readingId,
  });
}

export { parseSafetyReportStatus, DAILY_SAFETY_REPORT_LIMIT };

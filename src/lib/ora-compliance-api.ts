import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { auditLog, requireAdmin, rid } from "@/lib/ora";
import {
  applyAiClassification,
  classifyCompliance,
  needsContextReview,
  shouldBlockCompliance,
  type ComplianceHit,
  type ComplianceSender,
} from "@/lib/ora-compliance";

const SCHEMA = `
create table if not exists ora_ai_reports (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  conversation_id text not null default '',
  conversation_kind text not null default 'reading',
  message_id text not null default '',
  category text not null,
  sender text not null,
  risk text not null,
  confidence numeric not null default 0,
  status text not null default 'new',
  excerpt text not null default '',
  context_json text not null default '',
  blocked boolean not null default false,
  warning text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text not null default ''
);
create index if not exists ora_ai_reports_status_idx on ora_ai_reports (status, created_at desc);
create table if not exists ora_ai_report_audit (
  id text primary key,
  report_id text not null,
  admin_id text not null,
  action text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table ora_profiles add column if not exists age_confirmed_at timestamptz;
`;

let schemaReady = false;

export async function ensureComplianceSchema() {
  if (schemaReady) return;
  const sql = await getSql();
  for (const statement of SCHEMA.split(";").map((part) => part.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
  schemaReady = true;
}

async function recentBodies(kind: "reading" | "message", conversationId: string) {
  if (!conversationId) return [] as string[];
  const sql = await getSql();
  if (kind === "reading") {
    const rows = await sql<{ body: string }>`
      select body from ora_messages where reading_id = ${conversationId} order by created_at desc limit 4
    `.catch(() => []);
    return rows.map((row) => String(row.body || "").slice(0, 240)).reverse();
  }
  const rows = await sql<{ body: string }>`
    select body from ora_advisor_inbox_messages
    where thread_id = ${conversationId} or (advisor_id || ':' || customer_id) = ${conversationId}
    order by created_at desc limit 4
  `.catch(() => []);
  return rows.map((row) => String(row.body || "").slice(0, 240)).reverse();
}

async function accountUnder18(userId: string) {
  const sql = await getSql();
  const [row] = await sql<{ date_of_birth: string }>`
    select coalesce(date_of_birth, '') as date_of_birth from ora_profiles where user_id = ${userId} limit 1
  `.catch(() => []);
  const { accountIsUnder18 } = await import("@/lib/ora-compliance");
  return accountIsUnder18(row?.date_of_birth || "");
}

async function optionalAi(body: string, recent: string[], sender: ComplianceSender, local: ComplianceHit | null) {
  if (local && local.confidence >= 0.82) return local;
  if (!needsContextReview(body) && !local) return local;
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return local;
  const snippet = [...recent.slice(-3), body].map((line) => line.slice(0, 180)).join("\n").slice(0, 700);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(2500),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "You are a compliance classifier. Reply with JSON only: {\"category\":\"personal_info|off_platform|advisor_disclosure|sexual|medical|under_18|external_payment|other\",\"risk\":\"low|medium|high\",\"confidence\":0-1,\"block\":boolean}. Do not treat intimacy, a relative's age, or a customer describing their own doctor as a violation. If uncertain, confidence below 0.6 and block false.",
          },
          { role: "user", content: `sender:${sender}\n${snippet}` },
        ],
      }),
    });
    if (!res.ok) return local;
    const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content || "";
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { category?: string; risk?: string; confidence?: number; block?: boolean };
    return applyAiClassification(local, parsed, sender);
  } catch {
    return local;
  }
}

async function saveReport(input: {
  advisorId: string;
  customerId: string;
  conversationId: string;
  kind: "reading" | "message";
  sender: ComplianceSender;
  hit: ComplianceHit;
  body: string;
  recent: string[];
}) {
  const sql = await getSql();
  const excerpt = input.body.trim().slice(0, 500);
  const [dup] = await sql<{ id: string }>`
    select id from ora_ai_reports
    where advisor_id = ${input.advisorId}
      and customer_id = ${input.customerId}
      and category = ${input.hit.category}
      and excerpt = ${excerpt}
      and created_at > now() - interval '15 minutes'
    limit 1
  `.catch(() => []);
  if (dup) return dup.id;
  const id = rid("air");
  const context = JSON.stringify(input.recent.slice(-2).map((line) => line.slice(0, 180)));
  await sql`
    insert into ora_ai_reports (
      id, advisor_id, customer_id, conversation_id, conversation_kind, category, sender,
      risk, confidence, status, excerpt, context_json, blocked, warning
    ) values (
      ${id}, ${input.advisorId}, ${input.customerId}, ${input.conversationId}, ${input.kind}, ${input.hit.category}, ${input.sender},
      ${input.hit.risk}, ${input.hit.confidence}, 'new', ${excerpt}, ${context}, ${shouldBlockCompliance(input.hit)}, ${input.hit.warning || input.hit.advisorWarning}
    )
  `;
  return id;
}

export async function screenOutgoingMessage(input: {
  body: string;
  sender: ComplianceSender;
  advisorId: string;
  customerId: string;
  conversationId: string;
  kind: "reading" | "message";
}) {
  const body = String(input.body || "").trim();
  if (!body) return { ok: true as const, warning: "" };
  try {
    await ensureComplianceSchema();
  } catch (err) {
    console.error("[ora] compliance schema", err);
    return { ok: true as const, warning: "" };
  }
  const recent = await recentBodies(input.kind, input.conversationId);
  const under18 = input.sender === "customer" ? await accountUnder18(input.customerId) : false;
  const local = classifyCompliance({ body, sender: input.sender, recent, accountUnder18: under18 });
  const hit = await optionalAi(body, recent, input.sender, local);
  if (!hit) return { ok: true as const, warning: "" };
  await saveReport({ ...input, hit, body, recent });
  if (hit.stopReading) {
    try {
      const { closeReadingById } = await import("@/lib/ora");
      const sql = await getSql();
      if (input.kind === "reading" && input.conversationId) {
        await closeReadingById(input.conversationId);
      }
      const live = await sql<{ id: string }>`
        select id from ora_readings
        where advisor_id = ${input.advisorId} and client_id = ${input.customerId} and status = 'live'
      `.catch(() => []);
      for (const row of live) {
        if (row.id !== input.conversationId) await closeReadingById(row.id);
      }
    } catch (err) {
      console.error("[ora] end under-18 reading", err);
    }
  }
  if (shouldBlockCompliance(hit) || hit.stopReading) {
    return { ok: false as const, warning: hit.warning || hit.advisorWarning || "This message can't be sent.", stopReading: hit.stopReading };
  }
  return { ok: true as const, warning: hit.advisorWarning || "" };
}

export const confirmAdultAge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureComplianceSchema();
    const { ensureAccount } = await import("@/lib/ora");
    await ensureAccount(context.userId, "");
    const sql = await getSql();
    await sql`
      update ora_profiles set age_confirmed_at = coalesce(age_confirmed_at, now()) where user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const adminAiReportCount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "advisors");
    await ensureComplianceSchema();
    const sql = await getSql();
    const [row] = await sql<{ n: number; high: number }>`
      select count(*)::int as n,
             count(*) filter (where risk = 'high')::int as high
      from ora_ai_reports where status = 'new'
    `;
    return { count: Number(row?.n) || 0, high: Number(row?.high) || 0 };
  });

export const adminAiReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { status?: string; category?: string; risk?: string; query?: string; from?: string; to?: string }) => ({
    status: String(input?.status || "new").slice(0, 20),
    category: String(input?.category || "all").slice(0, 40),
    risk: String(input?.risk || "all").slice(0, 20),
    query: String(input?.query || "").trim().slice(0, 80),
    from: String(input?.from || "").slice(0, 10),
    to: String(input?.to || "").slice(0, 10),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    await ensureComplianceSchema();
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      advisor_id: string;
      customer_id: string;
      conversation_id: string;
      conversation_kind: string;
      category: string;
      sender: string;
      risk: string;
      confidence: number;
      status: string;
      excerpt: string;
      context_json: string;
      created_at: string;
      advisor_name: string;
      advisor_email: string;
      customer_name: string;
      advisor_status: string;
    }>`
      select r.id, r.advisor_id, r.customer_id, r.conversation_id, r.conversation_kind, r.category, r.sender,
             r.risk, r.confidence, r.status, r.excerpt, r.context_json, r.created_at::text as created_at,
             coalesce(a.name, 'Advisor') as advisor_name,
             coalesce(nullif(u.email, ''), nullif(p.email, ''), '') as advisor_email,
             coalesce(nullif(c.display_name, ''), 'Client') as customer_name,
             coalesce(a.status, '') as advisor_status
      from ora_ai_reports r
      left join ora_advisors a on a.id = r.advisor_id
      left join "user" u on u.id = a.user_id
      left join ora_profiles p on p.user_id = a.user_id
      left join ora_profiles c on c.user_id = r.customer_id
      order by r.created_at desc
      limit 300
    `;
    const { matchesAiReportFilters } = await import("@/lib/ora-compliance");
    const filtered = rows.filter((row) =>
      matchesAiReportFilters(
        {
          advisorName: row.advisor_name,
          advisorEmail: row.advisor_email,
          customerName: row.customer_name,
          category: row.category,
          risk: row.risk,
          status: row.status,
          at: row.created_at,
        },
        data,
      ),
    );
    const counts = { new: 0, reviewing: 0, resolved: 0, dismissed: 0 };
    for (const row of rows) {
      if (row.status === "new" || row.status === "reviewing" || row.status === "resolved" || row.status === "dismissed") {
        counts[row.status] += 1;
      }
    }
    return {
      counts,
      rows: filtered.slice(0, 80).map((row) => ({
        id: row.id,
        advisorId: row.advisor_id,
        advisorName: row.advisor_name,
        advisorEmail: row.advisor_email,
        advisorStatus: row.advisor_status,
        customerId: row.customer_id,
        customerName: row.customer_name,
        conversationId: row.conversation_id,
        kind: row.conversation_kind,
        category: row.category,
        sender: row.sender,
        risk: row.risk,
        confidence: Number(row.confidence) || 0,
        status: row.status,
        excerpt: row.excerpt,
        context: safeContext(row.context_json),
        at: row.created_at,
      })),
    };
  });

function safeContext(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((line) => String(line || "").slice(0, 180)).slice(0, 3);
  } catch {
    return [];
  }
}

export const adminAiReportAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; action?: string }) => ({
    id: String(input?.id || "").trim().slice(0, 80),
    action: String(input?.action || "").trim().slice(0, 40),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    await ensureComplianceSchema();
    const allowed = ["reviewing", "dismiss", "resolve", "warning", "suspend", "unsuspend"] as const;
    if (!data.id || !allowed.includes(data.action as (typeof allowed)[number])) throw new Error("Choose a report action.");
    const sql = await getSql();
    const [report] = await sql<{ id: string; advisor_id: string; status: string }>`
      select id, advisor_id, status from ora_ai_reports where id = ${data.id} limit 1
    `;
    if (!report) throw new Error("Report not found.");
    const next =
      data.action === "reviewing" || data.action === "warning"
        ? "reviewing"
        : data.action === "dismiss"
          ? "dismissed"
          : data.action === "resolve" || data.action === "suspend"
            ? "resolved"
            : report.status;
    await sql`
      update ora_ai_reports
      set status = ${next}, reviewed_at = now(), reviewed_by = ${context.userId}
      where id = ${report.id}
    `;
    if (data.action === "suspend" || data.action === "unsuspend") {
      const [advisor] = await sql<{ user_id: string }>`select user_id from ora_advisors where id = ${report.advisor_id} limit 1`;
      if (data.action === "suspend") {
        await sql`update ora_advisors set status = 'suspended', online = false, busy = false where id = ${report.advisor_id}`;
        if (advisor?.user_id) await sql`update ora_profiles set status = 'suspended' where user_id = ${advisor.user_id}`;
      } else {
        await sql`update ora_advisors set status = 'live' where id = ${report.advisor_id} and status = 'suspended'`;
        if (advisor?.user_id) await sql`update ora_profiles set status = 'active' where user_id = ${advisor.user_id}`;
      }
    }
    await sql`
      insert into ora_ai_report_audit (id, report_id, admin_id, action, note)
      values (${rid("aia")}, ${report.id}, ${context.userId}, ${data.action}, ${next})
    `;
    await auditLog(context.userId, `ai_report_${data.action}`, "ai_report", report.id, report.advisor_id);
    return { ok: true as const };
  });

export const adminAiReportThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: String(input?.id || "").trim().slice(0, 80) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    await ensureComplianceSchema();
    const sql = await getSql();
    const [report] = await sql<{ conversation_id: string; conversation_kind: string; advisor_id: string; customer_id: string }>`
      select conversation_id, conversation_kind, advisor_id, customer_id from ora_ai_reports where id = ${data.id} limit 1
    `;
    if (!report) throw new Error("Report not found.");
    if (report.conversation_kind === "reading" && report.conversation_id) {
      const rows = await sql<{ id: string; role: string; body: string; at: string }>`
        select id, role, body, created_at::text as at from ora_messages
        where reading_id = ${report.conversation_id}
        order by created_at asc
        limit 200
      `.catch(() => []);
      return { messages: rows.map(line) };
    }
    const rows = await sql<{ id: string; role: string; body: string; at: string }>`
      select id, role, body, created_at::text as at from ora_advisor_inbox_messages
      where advisor_id = ${report.advisor_id} and customer_id = ${report.customer_id}
      order by created_at asc
      limit 200
    `.catch(() => []);
    return { messages: rows.map(line) };
  });

function line(row: { id: string; role: string; body: string; at: string }) {
  return { id: row.id, role: row.role === "advisor" ? "advisor" : "client", body: String(row.body || ""), at: String(row.at || "") };
}

export const advisorSafetyNotice = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { customerId?: string }) => ({
    customerId: String(input?.customerId || "").slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    await ensureComplianceSchema();
    const { deskUserId } = await import("@/lib/ora-view-as");
    const sql = await getSql();
    const acting = await deskUserId(context.userId);
    const [advisor] = await sql<{ id: string }>`
      select id from ora_advisors where user_id = ${acting} limit 1
    `.catch(() => []);
    if (!advisor?.id || !data.customerId) return { notice: "" };
    const [row] = await sql<{ warning: string }>`
      select warning from ora_ai_reports
      where advisor_id = ${advisor.id} and customer_id = ${data.customerId} and sender = 'customer' and category = 'sexual' and status = 'new'
      order by created_at desc limit 1
    `.catch(() => []);
    return { notice: row?.warning || "" };
  });

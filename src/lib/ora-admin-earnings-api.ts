import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  buildAdvisorEarningsBoard,
  buildAdvisorEarningsDetail,
  payAdvisorEarnings,
  readingShareCents,
  validateAdvisorEarningPayment,
  type EarningEvent,
  type PayoutEvent,
} from "@/lib/ora-admin-earnings";
import { auditLog, loadSettings, requireAdmin, rid } from "@/lib/ora";

let columnsReady = false;

async function ensureEarningPaymentColumns() {
  if (columnsReady) return;
  const sql = await getSql();
  await sql.query("alter table ora_payouts add column if not exists method text not null default ''");
  await sql.query("alter table ora_payouts add column if not exists reference_id text not null default ''");
  await sql.query("alter table ora_payouts add column if not exists idempotency_key text not null default ''");
  await sql.query(
    "create unique index if not exists ora_payouts_idempotency_idx on ora_payouts (idempotency_key) where idempotency_key <> ''",
  );
  columnsReady = true;
}

function stamp(input?: { t?: number }) {
  return { t: Math.floor(Number(input?.t) || Date.now()) };
}

async function loadEarningEvents(): Promise<EarningEvent[]> {
  const sql = await getSql();
  const readings = await sql<{ id: string; advisor_id: string; at: string; earned: number }>`
    select r.id, r.advisor_id, coalesce(r.ended_at, r.started_at)::text as at,
           coalesce(r.advisor_earned, 0)::int as earned
    from ora_readings r
    where r.status in ('ended', 'completed')
      and not exists (
        select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed'
      )
  `.catch(() => []);
  const messages = await sql<{ id: string; advisor_id: string; at: string; cents: number }>`
    select id, advisor_id, created_at::text as at, coalesce(advisor_share_cents, 0)::int as cents
    from ora_paid_messages
    where credited = true and coins > 0
  `.catch(() => []);
  const tips = await sql<{ id: string; advisor_id: string; at: string; coins: number }>`
    select id, advisor_id, created_at::text as at, coalesce(advisor_share_coins, 0)::int as coins
    from ora_customer_tips
    where charged = true and credited = true
  `.catch(() => []);
  return [
    ...readings.map((row) => ({
      id: row.id,
      advisorId: row.advisor_id,
      at: String(row.at || ""),
      kind: "reading" as const,
      advisorCents: readingShareCents(row.earned),
    })),
    ...messages.map((row) => ({
      id: row.id,
      advisorId: row.advisor_id,
      at: String(row.at || ""),
      kind: "message" as const,
      advisorCents: Math.max(0, Math.floor(Number(row.cents) || 0)),
    })),
    ...tips.map((row) => ({
      id: row.id,
      advisorId: row.advisor_id,
      at: String(row.at || ""),
      kind: "tip" as const,
      advisorCents: readingShareCents(row.coins),
    })),
  ];
}

async function loadPayoutEvents(): Promise<PayoutEvent[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    advisor_id: string;
    coins: number;
    amount_cents: number;
    status: string;
    workflow: string;
    paid_at: string | null;
    created_at: string;
    note: string;
    method: string;
    reference_id: string;
  }>`
    select id, advisor_id, coins, coalesce(amount_cents, 0)::int as amount_cents, status,
           coalesce(workflow, '') as workflow, paid_at::text as paid_at, created_at::text as created_at,
           coalesce(note, '') as note, coalesce(method, '') as method, coalesce(reference_id, '') as reference_id
    from ora_payouts
  `.catch(() => []);
  return rows.map((row) => ({
    id: row.id,
    advisorId: row.advisor_id,
    coins: Number(row.coins) || 0,
    amountCents: Number(row.amount_cents) || 0,
    status: row.status,
    workflow: row.workflow || "",
    paidAt: row.paid_at ? String(row.paid_at) : "",
    createdAt: String(row.created_at || ""),
    method: row.method || "",
    referenceId: row.reference_id || "",
    note: row.note || "",
  }));
}

export const adminAdvisorEarningsBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "payouts");
    await ensureEarningPaymentColumns();
    const sql = await getSql();
    const advisors = await sql<{
      id: string;
      name: string;
      photo_url: string;
      email: string;
      profile_email: string;
      status: string;
    }>`
      select a.id, a.name, coalesce(a.photo_url, '') as photo_url,
             coalesce(a.email, '') as email, coalesce(p.email, '') as profile_email, a.status
      from ora_advisors a
      left join ora_profiles p on p.user_id = a.user_id
      order by a.name
    `;
    const [earnings, payouts] = await Promise.all([loadEarningEvents(), loadPayoutEvents()]);
    return buildAdvisorEarningsBoard({
      advisors: advisors.map((row) => ({
        id: row.id,
        name: row.name,
        photoUrl: row.photo_url || "",
        email: row.email || row.profile_email || "",
        status: row.status,
      })),
      earnings,
      payouts,
    });
  });

export const adminAdvisorEarningsDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; month?: string; t?: number }) => ({
    advisorId: String(input?.advisorId || "").trim().slice(0, 64),
    month: /^\d{4}-\d{2}$/.test(String(input?.month || "")) ? String(input?.month) : "",
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    if (!data.advisorId) throw new Error("Choose an advisor.");
    await ensureEarningPaymentColumns();
    const sql = await getSql();
    const [advisor] = await sql<{
      id: string;
      name: string;
      photo_url: string;
      email: string;
      profile_email: string;
      status: string;
    }>`
      select a.id, a.name, coalesce(a.photo_url, '') as photo_url,
             coalesce(a.email, '') as email, coalesce(p.email, '') as profile_email, a.status
      from ora_advisors a
      left join ora_profiles p on p.user_id = a.user_id
      where a.id = ${data.advisorId}
    `;
    if (!advisor) throw new Error("Advisor not found.");
    const [earnings, payouts] = await Promise.all([loadEarningEvents(), loadPayoutEvents()]);
    return buildAdvisorEarningsDetail({
      advisor: {
        id: advisor.id,
        name: advisor.name,
        photoUrl: advisor.photo_url || "",
        email: advisor.email || advisor.profile_email || "",
        status: advisor.status,
      },
      earnings,
      payouts,
      month: data.month,
    });
  });

export const adminPayAdvisorEarnings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    advisorId?: string;
    amountCents?: number;
    method?: string;
    referenceId?: string;
    note?: string;
    requestId?: string;
  }) =>
    validateAdvisorEarningPayment({
      advisorId: String(input?.advisorId || ""),
      amountCents: Number(input?.amountCents),
      method: String(input?.method || ""),
      referenceId: String(input?.referenceId || ""),
      note: String(input?.note || ""),
      requestId: String(input?.requestId || ""),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    await ensureEarningPaymentColumns();
    const sql = await getSql();
    const settings = await loadSettings();
    try {
      const saved = await payAdvisorEarnings(sql, {
        ...data,
        payoutId: rid("pay"),
        currency: settings.currency,
      });
      await auditLog(
        context.userId,
        "advisor_earnings_paid",
        "payout",
        saved.payoutId,
        `${data.advisorId} · ${saved.paidCents}c`,
      );
      return saved;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "23505") throw new Error("This payment was already recorded.");
      throw err instanceof Error ? err : new Error("Could not record that payment.");
    }
  });

import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { addLedger, assertActive } from "@/lib/ora";
import {
  emptyMembership,
  MEMBERSHIP_PERIOD_DAYS,
  MEMBERSHIP_PLANS,
  nextRefreshAt,
  packFromPlan,
  planById,
  planByPackId,
  type Membership,
  type MembershipPlanId,
} from "@/lib/ora-membership-plan";

export {
  emptyMembership,
  formatCountdown,
  isMembershipLive,
  MEMBERSHIP_PACK_ID,
  MEMBERSHIP_PERIOD_DAYS,
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PRICE_CENTS,
  nextRefreshAt,
  packFromPlan,
  planById,
  planByPackId,
} from "@/lib/ora-membership-plan";
export type { Membership, MembershipPlan, MembershipPlanId } from "@/lib/ora-membership-plan";

export const MEMBERSHIP_PACK = packFromPlan(MEMBERSHIP_PLANS.membership);

let schemaReady = false;

export async function ensureMembershipSchema() {
  if (schemaReady) return;
  const sql = await getSql();
  await sql`alter table ora_wallets add column if not exists membership_active boolean not null default false`;
  await sql`alter table ora_wallets add column if not exists membership_cancel_at_period_end boolean not null default false`;
  await sql`alter table ora_wallets add column if not exists membership_renews_at timestamptz`;
  await sql`alter table ora_wallets add column if not exists membership_refresh_at timestamptz`;
  await sql`alter table ora_wallets add column if not exists membership_seconds integer not null default 0`;
  await sql`alter table ora_wallets add column if not exists membership_plan text not null default ''`;
  schemaReady = true;
}

export function mapMembership(row: {
  membership_active?: boolean;
  membership_cancel_at_period_end?: boolean;
  membership_renews_at?: string | Date | null;
  membership_refresh_at?: string | Date | null;
  membership_seconds?: number;
  membership_plan?: string | null;
} | null | undefined): Membership {
  if (!row) return emptyMembership();
  const active = Boolean(row.membership_active);
  const raw = String(row.membership_plan || "");
  const plan: MembershipPlanId | "" = raw === "mini" || raw === "membership" ? raw : active ? "membership" : "";
  return {
    active,
    plan,
    cancelAtPeriodEnd: Boolean(row.membership_cancel_at_period_end),
    renewsAt: row.membership_renews_at ? String(row.membership_renews_at) : "",
    refreshAt: row.membership_refresh_at ? String(row.membership_refresh_at) : "",
    seconds: Math.max(0, Number(row.membership_seconds) || 0),
  };
}

export async function refreshMembershipState(userId: string, now = Date.now()) {
  await ensureMembershipSchema();
  const sql = await getSql();
  const [row] = await sql<{
    membership_active: boolean;
    membership_cancel_at_period_end: boolean;
    membership_renews_at: string | null;
    membership_refresh_at: string | null;
    membership_plan: string;
  }>`
    select membership_active, membership_cancel_at_period_end, membership_renews_at, membership_refresh_at, membership_plan
    from ora_wallets where user_id = ${userId}
  `;
  if (!row?.membership_active) return;

  const renews = row.membership_renews_at ? Date.parse(String(row.membership_renews_at)) : 0;
  if (Number.isFinite(renews) && renews > 0 && renews <= now) {
    await sql`
      update ora_wallets
      set membership_active = false,
          membership_cancel_at_period_end = false,
          membership_seconds = 0,
          membership_plan = ''
      where user_id = ${userId} and membership_active = true
    `;
    return;
  }

  const plan = planById(row.membership_plan) ?? MEMBERSHIP_PLANS.membership;
  const refresh = row.membership_refresh_at ? Date.parse(String(row.membership_refresh_at)) : 0;
  if (Number.isFinite(refresh) && refresh > 0 && refresh <= now) {
    const nextIso = new Date(nextRefreshAt(refresh, plan.refreshMs, now)).toISOString();
    await sql`
      update ora_wallets
      set membership_seconds = ${plan.seconds},
          membership_refresh_at = ${nextIso}::timestamptz
      where user_id = ${userId} and membership_active = true
    `;
  }
}

export async function assertNoLiveMembership(userId: string) {
  await refreshMembershipState(userId);
  const sql = await getSql();
  const [row] = await sql<{ membership_active: boolean; membership_renews_at: string | null }>`
    select membership_active, membership_renews_at from ora_wallets where user_id = ${userId}
  `;
  const live = Boolean(row?.membership_active) && (!row?.membership_renews_at || Date.parse(String(row.membership_renews_at)) > Date.now());
  if (live) throw new Error("You already have an active Ora subscription. Only one plan can be active at a time.");
}

export async function activateMembershipFromPayment(userId: string, paymentId: string, packId: string) {
  await ensureMembershipSchema();
  const plan = planByPackId(packId);
  if (!plan) return;
  const sql = await getSql();
  const [done] = await sql<{ id: string }>`
    select id from ora_ledger where kind = 'membership' and ref_id = ${paymentId} limit 1
  `;
  if (done) return;

  const [current] = await sql<{
    membership_active: boolean;
    membership_plan: string;
    membership_renews_at: string | null;
  }>`
    select membership_active, membership_plan, membership_renews_at from ora_wallets where user_id = ${userId}
  `;
  const live =
    Boolean(current?.membership_active) &&
    (!current?.membership_renews_at || Date.parse(String(current.membership_renews_at)) > Date.now());

  await addLedger(userId, "membership", 0, plan.seconds, `${plan.name} · 3 minutes ${plan.refreshLabel}`, paymentId);

  if (live) {
    const existing = planById(current?.membership_plan) ?? plan;
    if (existing.plan !== plan.plan) return;
    const base = Math.max(Date.now(), Date.parse(String(current?.membership_renews_at || "")) || Date.now());
    const renews = new Date(base + MEMBERSHIP_PERIOD_DAYS * 86400000).toISOString();
    await sql`
      update ora_wallets
      set membership_cancel_at_period_end = false,
          membership_renews_at = ${renews}::timestamptz
      where user_id = ${userId}
    `;
    return;
  }

  const renews = new Date(Date.now() + MEMBERSHIP_PERIOD_DAYS * 86400000).toISOString();
  const refresh = new Date(Date.now() + plan.refreshMs).toISOString();
  await sql`
    update ora_wallets
    set membership_active = true,
        membership_plan = ${plan.plan},
        membership_cancel_at_period_end = false,
        membership_renews_at = ${renews}::timestamptz,
        membership_refresh_at = ${refresh}::timestamptz,
        membership_seconds = ${plan.seconds}
    where user_id = ${userId}
  `;
}

export const cancelMembership = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertActive(context.userId);
    await ensureMembershipSchema();
    const sql = await getSql();
    await sql`
      update ora_wallets
      set membership_cancel_at_period_end = true
      where user_id = ${context.userId} and membership_active = true
    `;
    return { ok: true as const };
  });

export async function applyMembershipClock(
  userId: string,
  data: { refreshAgoHours?: number; expireAgoHours?: number; spendSeconds?: number },
) {
  await ensureMembershipSchema();
  const sql = await getSql();
  const spendSeconds = Math.max(0, Math.floor(Number(data.spendSeconds) || 0));
  const refreshAgoHours = Math.max(0, Number(data.refreshAgoHours) || 0);
  const expireAgoHours = Math.max(0, Number(data.expireAgoHours) || 0);
  if (spendSeconds) {
    await sql`
      update ora_wallets
      set membership_seconds = greatest(0, membership_seconds - ${spendSeconds})
      where user_id = ${userId} and membership_active = true
    `;
  }
  if (refreshAgoHours) {
    const when = new Date(Date.now() - refreshAgoHours * 3600000).toISOString();
    await sql`
      update ora_wallets
      set membership_refresh_at = ${when}::timestamptz
      where user_id = ${userId} and membership_active = true
    `;
  }
  if (expireAgoHours) {
    const when = new Date(Date.now() - expireAgoHours * 3600000).toISOString();
    await sql`
      update ora_wallets
      set membership_renews_at = ${when}::timestamptz
      where user_id = ${userId} and membership_active = true
    `;
  }
  await refreshMembershipState(userId);
  const [row] = await sql<{
    membership_active: boolean;
    membership_plan: string;
    membership_seconds: number;
    membership_refresh_at: string | null;
    membership_renews_at: string | null;
    coins: number;
  }>`
    select membership_active, membership_plan, membership_seconds, membership_refresh_at, membership_renews_at, coins
    from ora_wallets where user_id = ${userId}
  `;
  return {
    active: Boolean(row?.membership_active),
    plan: row?.membership_plan || "",
    seconds: Number(row?.membership_seconds || 0),
    refreshAt: row?.membership_refresh_at ? String(row.membership_refresh_at) : "",
    renewsAt: row?.membership_renews_at ? String(row.membership_renews_at) : "",
    coins: Number(row?.coins || 0),
  };
}

export const previewMembershipClock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { refreshAgoHours?: number; expireAgoHours?: number; spendSeconds?: number }) => ({
    refreshAgoHours: Math.max(0, Number(input.refreshAgoHours) || 0),
    expireAgoHours: Math.max(0, Number(input.expireAgoHours) || 0),
    spendSeconds: Math.max(0, Math.floor(Number(input.spendSeconds) || 0)),
  }))
  .handler(async ({ context, data }) => {
    const { isWorkspacePreview } = await import("@/lib/env.server");
    if (!isWorkspacePreview()) throw new Error("Not available.");
    return applyMembershipClock(context.userId, data);
  });

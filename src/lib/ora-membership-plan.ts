export type MembershipPlanId = "mini" | "membership";

export type MembershipPlan = {
  plan: MembershipPlanId;
  packId: string;
  name: string;
  amountCents: number;
  coins: number;
  seconds: number;
  refreshMs: number;
  refreshLabel: string;
};

export const MEMBERSHIP_PERIOD_DAYS = 30;

export const MEMBERSHIP_PLANS: Record<MembershipPlanId, MembershipPlan> = {
  mini: {
    plan: "mini",
    packId: "membership-mini",
    name: "Ora Mini",
    amountCents: 1000,
    coins: 20,
    seconds: 180,
    refreshMs: 7 * 24 * 60 * 60 * 1000,
    refreshLabel: "every 7 days",
  },
  membership: {
    plan: "membership",
    packId: "membership",
    name: "Ora Membership",
    amountCents: 2500,
    coins: 50,
    seconds: 180,
    refreshMs: 48 * 60 * 60 * 1000,
    refreshLabel: "every 48 hours",
  },
};

export const MEMBERSHIP_PACK_ID = MEMBERSHIP_PLANS.membership.packId;
export const MEMBERSHIP_PRICE_CENTS = MEMBERSHIP_PLANS.membership.amountCents;

export function packFromPlan(plan: MembershipPlan) {
  return {
    id: plan.packId,
    name: plan.name,
    coins: plan.coins,
    amountCents: plan.amountCents,
    currency: "USD",
    active: true,
    sortOrder: plan.plan === "mini" ? 1 : 2,
  };
}

export function planByPackId(packId: string): MembershipPlan | null {
  return Object.values(MEMBERSHIP_PLANS).find((p) => p.packId === packId) ?? null;
}

export function planById(id: string | null | undefined): MembershipPlan | null {
  if (id === "mini" || id === "membership") return MEMBERSHIP_PLANS[id];
  return null;
}

export type Membership = {
  active: boolean;
  plan: MembershipPlanId | "";
  cancelAtPeriodEnd: boolean;
  renewsAt: string;
  refreshAt: string;
  seconds: number;
};

export function emptyMembership(): Membership {
  return { active: false, plan: "", cancelAtPeriodEnd: false, renewsAt: "", refreshAt: "", seconds: 0 };
}

export function isMembershipLive(m: Membership | null | undefined, now = Date.now()) {
  if (!m?.active) return false;
  if (m.renewsAt) {
    const end = Date.parse(m.renewsAt);
    if (Number.isFinite(end) && end <= now) return false;
  }
  return true;
}

export function formatCountdown(iso: string, now = Date.now()) {
  const end = Date.parse(iso);
  if (!iso || !Number.isFinite(end)) return "—";
  let ms = end - now;
  if (ms <= 0) return "soon";
  const days = Math.floor(ms / 86_400_000);
  ms -= days * 86_400_000;
  const hours = Math.floor(ms / 3_600_000);
  ms -= hours * 3_600_000;
  const minutes = Math.floor(ms / 60_000);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${Math.max(1, minutes)} minute${minutes === 1 ? "" : "s"}`;
}

export function nextRefreshAt(fromMs: number, intervalMs: number, now: number) {
  let next = fromMs;
  if (!Number.isFinite(next) || next <= 0) next = now + intervalMs;
  while (next <= now) next += intervalMs;
  return next;
}

import { Link } from "@tanstack/react-router";
import { formatClock, formatMoney, type Wallet } from "@/lib/ora";
import {
  formatCountdown,
  isMembershipLive,
  planById,
  type Membership,
} from "@/lib/ora-membership-plan";

function formatWhen(value: string) {
  if (!value) return "—";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(t);
}

export function membershipFromWallet(w: Wallet): Membership {
  return {
    active: w.membershipActive,
    plan: w.membershipPlan === "mini" || w.membershipPlan === "membership" ? w.membershipPlan : "",
    cancelAtPeriodEnd: w.membershipCancelAtPeriodEnd,
    renewsAt: w.membershipRenewsAt,
    refreshAt: w.membershipRefreshAt,
    seconds: w.membershipSeconds,
  };
}

export function MembershipStatusCard({
  wallet,
  onCancel,
  busy = false,
}: {
  wallet: Wallet;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const mem = membershipFromWallet(wallet);
  if (!isMembershipLive(mem)) return null;
  const plan = planById(mem.plan) ?? planById("membership");
  return (
    <section className="rounded-3xl bg-surface px-5 py-5 shadow-[var(--shadow-border)]">
      <p className="text-[10px] tracking-[0.2em] text-muted uppercase">Current plan</p>
      <h2 className="mt-1 font-display text-2xl text-fg">{plan?.name}</h2>
      <p className="mt-1 text-sm font-medium text-ok">
        {mem.cancelAtPeriodEnd ? "Active until the paid period ends" : "Membership active"}
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Status</dt>
          <dd className="text-fg">{mem.cancelAtPeriodEnd ? "Cancels at period end" : "Active"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Free minutes now</dt>
          <dd className="tabular-nums text-fg">{formatClock(mem.seconds)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Next 3 free minutes</dt>
          <dd className="text-right text-fg">{formatCountdown(mem.refreshAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Ora Coins</dt>
          <dd className="tabular-nums text-fg">{wallet.coins}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{mem.cancelAtPeriodEnd ? "Benefits end" : "Next billing date"}</dt>
          <dd className="text-right text-fg">{formatWhen(mem.renewsAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Price</dt>
          <dd className="text-fg">{formatMoney(plan?.amountCents || 0, "USD")}/month</dd>
        </div>
      </dl>
      {onCancel && !mem.cancelAtPeriodEnd ? (
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-border text-sm text-fg disabled:opacity-60"
        >
          {busy ? "Cancelling…" : "Cancel Membership"}
        </button>
      ) : (
        <Link to="/membership" preload={false} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-fg">
          View membership
        </Link>
      )}
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState, StatusPill, StatTile, orderTone } from "@/components/advisor-desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorRevenueDetail } from "@/lib/ora-advisor-desk";
import { formatUsdFromCoins, revenueStatus } from "@/lib/ora-advisor-desk-stats";
import { formatCoinUnitsFromCents, formatUsdFromCents } from "@/lib/ora-paid-messages";
import { COINS_PER_DOLLAR, formatClock, formatWhen, requestPayout } from "@/lib/ora";

export const Route = createFileRoute("/advisor/earnings")({ component: EarningsPage });

function EarningsPage() {
  const { user, isPending } = useCurrentUserState();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof advisorRevenueDetail>> | null>(null);
  const [coins, setCoins] = useState(50);
  const [requesting, setRequesting] = useState(false);

  async function load() {
    const next = await advisorRevenueDetail();
    setDetail(next);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch(() => setDetail(null));
  }, [user]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (requesting) return;
    setRequesting(true);
    try {
      await requestPayout({ data: { coins } });
      toast.success("Payout requested.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not request");
    } finally {
      setRequesting(false);
    }
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;
  const rows = detail?.rows ?? [];
  const payouts = detail?.payouts ?? [];
  const paid = payouts.filter((p: any) => p.status === "paid");

  return (
    <main>
      <h1 className="font-display text-3xl">Revenue detail</h1>
      <p className="mt-1 text-sm text-muted">
        Your recorded earnings. 10 coins = $1. Refunded sittings are removed.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Today" value={`${detail?.today ?? 0}c`} hint={formatUsdFromCoins(detail?.today ?? 0)} tone="gold" />
        <StatTile label="This week" value={`${detail?.week ?? 0}c`} hint={formatUsdFromCoins(detail?.week ?? 0)} tone="blush" />
        <StatTile label="This month" value={`${detail?.month ?? 0}c`} hint={formatUsdFromCoins(detail?.month ?? 0)} tone="lotus" />
        <StatTile label="Available" value={`${detail?.available ?? 0}c`} hint={formatUsdFromCoins(detail?.available ?? 0)} tone="ok" />
        <StatTile label="Pending hold" value={`${detail?.pendingHold ?? 0}c`} hint={formatUsdFromCoins(detail?.pendingHold ?? 0)} tone="warn" />
        <StatTile label="Requested" value={`${detail?.requested ?? 0}c`} hint={formatUsdFromCoins(detail?.requested ?? 0)} tone="primary" />
      </div>

      <section className="mt-6">
        <h2 className="font-display text-xl">Transactions</h2>
        {!rows.length ? (
          <div className="mt-3">
            <EmptyState title="No earnings yet" body="Completed live text chats will list the client and your earnings." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((row: any) => (
              <li key={row.id} className="rounded-2xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.customerName}</p>
                    <p className="text-xs text-faint">
                      {row.service} · {formatClock(row.seconds)} · {formatWhen(row.at)}
                    </p>
                  </div>
                  <StatusPill tone={orderTone(row.status === "ended" ? "completed" : row.status === "live" ? "progress" : "cancelled")}>
                    {revenueStatus(row.status)}
                  </StatusPill>
                </div>
                <p className="mt-3 text-sm">
                  <span className="text-xs tracking-wide text-faint uppercase">Your earnings</span>
                  <span className="mt-0.5 block font-medium tabular-nums">{formatUsdFromCoins(row.advisorShare)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl">Paid messages</h2>
        <p className="mt-1 text-sm text-muted">Separate from live reading earnings.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile label="Today" value={formatCoinUnitsFromCents(detail?.messageToday ?? 0)} hint={formatUsdFromCents(detail?.messageToday ?? 0)} tone="gold" />
          <StatTile label="All time" value={formatCoinUnitsFromCents(detail?.messageAllTime ?? 0)} hint={formatUsdFromCents(detail?.messageAllTime ?? 0)} tone="lotus" />
        </div>
        {!(detail?.messageRows ?? []).length ? (
          <div className="mt-3">
            <EmptyState title="No paid messages yet" body="Customer messages after the 3 free lifetime messages appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {(detail?.messageRows ?? []).map((row: any) => (
              <li key={row.id} className="rounded-2xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
                <div>
                  <p className="font-medium">{row.customerName}</p>
                  <p className="text-xs text-faint">Paid message · {formatWhen(row.at)}</p>
                </div>
                <p className="mt-3 text-sm">
                  <span className="text-xs tracking-wide text-faint uppercase">Your earnings</span>
                  <span className="mt-0.5 block font-medium tabular-nums">{formatUsdFromCents(row.advisorShare)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl">Tips & Gifts Earnings</h2>
        <p className="mt-1 text-sm text-muted">Your share of customer gifts. Separate from live readings and paid messages.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile label="Tips & Gifts Earnings" value={`${detail?.tipEarnings ?? 0}c`} hint={formatUsdFromCoins(detail?.tipEarnings ?? 0)} tone="gold" />
          <StatTile label="Today" value={`${detail?.tipToday ?? 0}c`} hint={formatUsdFromCoins(detail?.tipToday ?? 0)} tone="ok" />
        </div>
      </section>

      <form onSubmit={(e) => void pay(e)} className="mt-6 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Withdrawal</h2>
        <p className="mt-1 text-sm text-muted">Minimum 50 coins. Paid after the request is reviewed.</p>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="c">Coins</Label>
          <Input id="c" type="number" min={50} value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={requesting}>
          {requesting ? "Requesting…" : "Request payout"}
        </Button>
      </form>

      <section className="mt-8">
        <h2 className="font-display text-xl">Payouts</h2>
        {!payouts.length ? (
          <div className="mt-3">
            <EmptyState title="No withdrawals yet" body="Request a payout when you have at least 50 coins available." />
          </div>
        ) : (
          <ul className="mt-3 ora-rows">
            {payouts.map((p: any) => (
              <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
                <span>
                  {p.coins}c · ${(p.usd || p.coins / COINS_PER_DOLLAR).toFixed(2)}
                </span>
                <span className="text-muted">{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Paid history</h2>
        {!paid.length ? (
          <div className="mt-3">
            <EmptyState title="No paid withdrawals" body="Approved payouts will list here after they are marked paid." />
          </div>
        ) : (
          <ul className="mt-3 ora-rows">
            {paid.map((p: any) => (
              <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
                <span>
                  {p.coins}c · ${(p.usd || p.coins / COINS_PER_DOLLAR).toFixed(2)}
                </span>
                <span className="text-muted">{formatWhen(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

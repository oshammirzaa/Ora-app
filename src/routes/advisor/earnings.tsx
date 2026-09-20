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
import { COINS_PER_DOLLAR, formatClock, formatWhen, getPublicSettings, requestPayout } from "@/lib/ora";

export const Route = createFileRoute("/advisor/earnings")({ component: EarningsPage });

function EarningsPage() {
  const { user, isPending } = useCurrentUserState();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof advisorRevenueDetail>> | null>(null);
  const [coins, setCoins] = useState(50);
  const [share, setShare] = useState(80);
  const [requesting, setRequesting] = useState(false);

  async function load() {
    const next = await advisorRevenueDetail();
    setDetail(next);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch(() => setDetail(null));
    void getPublicSettings()
      .then((s) => setShare(s.platformShare))
      .catch(() => {});
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
  const paid = payouts.filter((p) => p.status === "paid");

  return (
    <main>
      <h1 className="font-display text-3xl">Revenue detail</h1>
      <p className="mt-1 text-sm text-muted">
        You keep {100 - share}%. Ora keeps {share}%. 10 coins = $1. Refunded sittings are removed from earnings.
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
            <EmptyState title="No earnings yet" body="Completed live text chats will list the client, split, and status." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
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
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Charged" value={`${row.gross}c`} sub={formatUsdFromCoins(row.gross)} />
                  <Mini label="Your 20%" value={`${row.advisorShare}c`} sub={formatUsdFromCoins(row.advisorShare)} />
                  <Mini label="Ora 80%" value={`${row.oraShare}c`} sub={formatUsdFromCoins(row.oraShare)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={(e) => void pay(e)} className="mt-6 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Withdrawal</h2>
        <p className="mt-1 text-sm text-muted">Minimum 50 coins. Paid after the house reviews the request.</p>
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
            {payouts.map((p) => (
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
            <EmptyState title="No paid withdrawals" body="Approved payouts will list here after the house marks them paid." />
          </div>
        ) : (
          <ul className="mt-3 ora-rows">
            {paid.map((p) => (
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

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-elevated px-2 py-2">
      <p className="text-[10px] tracking-wide text-faint uppercase">{label}</p>
      <p className="text-sm tabular-nums">{value}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorShell } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { COINS_PER_DOLLAR, formatClock, formatWhen, getDesk, getPublicSettings, requestPayout, setOnline, type Desk } from "@/lib/ora";

export const Route = createFileRoute("/advisor/earnings")({ component: EarningsPage });

function EarningsPage() {
  const { user, isPending } = useCurrentUserState();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [coins, setCoins] = useState(50);
  const [share, setShare] = useState(80);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getDesk().then(setDesk);
    void getPublicSettings().then((s) => setShare(s.platformShare)).catch(() => {});
  }, [user]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (requesting) return;
    setRequesting(true);
    try {
      await requestPayout({ data: { coins } });
      toast.success("Payout requested.");
      setDesk(await getDesk());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not request");
    } finally {
      setRequesting(false);
    }
  }

  if (isPending) {
    return (
      <AdvisorShell tab="earnings">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" />
      </AdvisorShell>
    );
  }
  if (!user) return <RedirectToSignIn to="/advisor/login" />;
  const adv = desk?.advisor;

  return (
    <AdvisorShell
      tab="earnings"
      online={adv?.online}
      busy={adv?.busy}
      canToggle={adv?.status === "live"}
      onToggle={(v) => void setOnline({ data: { online: v } }).then(() => getDesk().then(setDesk))}
    >
      <main className="px-4 py-8">
        <h1 className="font-display text-3xl">Earnings</h1>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Today" value={`${desk?.earningsToday ?? 0}c`} />
          <Stat label="All time" value={`${desk?.earningsTotal ?? 0}c`} />
        </div>
        <p className="mt-3 text-sm text-muted">
          Available to withdraw: {adv?.payoutCoins ?? 0} coins (${((adv?.payoutCoins ?? 0) / COINS_PER_DOLLAR).toFixed(2)}).
          You keep {100 - share}% of paid minutes. The house keeps {share}%.
        </p>

        <form onSubmit={(e) => void pay(e)} className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Withdrawal</h2>
          <p className="mt-1 text-sm text-muted">Minimum 50 coins. 10 coins = $1. Paid after the house reviews the request.</p>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="c">Coins</Label>
            <Input id="c" type="number" min={50} value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={requesting}>
            {requesting ? "Requesting…" : "Request payout"}
          </Button>
        </form>

        <section className="mt-8">
          <h2 className="font-display text-xl">Session history</h2>
          {!desk?.sessions.length ? (
            <p className="mt-2 text-sm text-muted">No paid chats yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
              {desk.sessions.map((s) => (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>
                      {s.advisorName} · {formatClock(s.seconds)} · {s.rateCoins}c/min
                    </span>
                    <span className="tabular-nums text-primary">
                      {s.advisorEarned}c
                      <span className="ml-2 text-faint">house {s.platformFee}c</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-faint">
                    {formatWhen(s.startedAt)}
                    {s.endedAt ? ` – ${formatWhen(s.endedAt)}` : " · live"} · client {s.coinsSpent}c
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl">Payouts</h2>
          {!desk?.payouts.length ? (
            <p className="mt-2 text-sm text-muted">None requested.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
              {desk.payouts.map((p) => (
                <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
                  <span>
                    {p.coins}c · ${p.usd.toFixed(2)}
                    <span className="mt-0.5 block text-xs text-faint">{p.id}</span>
                  </span>
                  <span className="text-muted">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AdvisorShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-faint uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimDailyReward, rewardStatus } from "@/lib/ora-advanced-api";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/rewards")({ component: RewardsPage });

function RewardsPage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Awaited<ReturnType<typeof rewardStatus>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");

  async function load() {
    setData(await rewardStatus());
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => setFailed(err instanceof Error ? err.message : "Could not load rewards"));
  }, [user]);

  if (isPending || (user && !data && !failed)) return <AppShell tab="you"><div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" /></AppShell>;
  if (!user || !data) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">Daily Rewards</h1>
          <p className="mt-1 text-sm text-muted">{failed || "Promo coins, once every 24 hours. Sign in to see your streak."}</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/login">Sign in</Link></Button>
        </main>
      </AppShell>
    );
  }

  const wait = data.waitMs > 0 ? new Date(Date.now() + data.waitMs).toLocaleString() : "";

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" className="text-sm text-primary">Account</Link>
        <h1 className="mt-2 font-display text-3xl text-fg">Daily Rewards</h1>
        <p className="mt-1 text-sm text-muted">Promo coins only. They are separate from coins you purchase and show in Transactions. One claim every 24 hours.</p>
        <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-sm text-muted">Promo balance</p>
          <p className="font-display text-3xl tabular-nums text-primary">{data.promoCoins}c</p>
          <p className="text-xs text-faint">Included in your {data.coins}c spendable balance. Purchased coins are not changed by a claim.</p>
          <ol className="mt-4 grid grid-cols-7 gap-1">
            {data.rewards.map((coins, index) => {
              const day = index + 1;
              const current = data.nextDay === day;
              return (
                <li key={day} className={`rounded-xl px-1 py-2 text-center text-xs ${current ? "bg-[#f3eaf6] text-[#6d3d78]" : "bg-elevated text-muted"}`}>
                  <span className="block">D{day}</span>
                  <span className="font-medium tabular-nums">{coins}c</span>
                </li>
              );
            })}
          </ol>
          <Button
            className="mt-4 w-full rounded-full"
            disabled={!data.enabled || !data.canClaim || busy}
            onClick={() => {
              setBusy(true);
              void claimDailyReward()
                .then((res) => {
                  toast.success(`Day ${res.day}: ${res.coins} promo coin${res.coins === 1 ? "" : "s"}.`);
                  return load();
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : "Could not claim"))
                .finally(() => setBusy(false));
            }}
          >
            {!data.enabled ? "Rewards are off" : data.canClaim ? `Claim ${data.nextCoins} promo coin${data.nextCoins === 1 ? "" : "s"}` : "Already claimed"}
          </Button>
          {wait ? <p className="mt-2 text-xs text-faint">Next claim after {wait}.</p> : null}
        </section>
        <ul className="mt-4 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {data.history.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>Day {row.day} · {formatWhen(row.at)}</span>
              <span className="tabular-nums text-primary">+{row.coins}c</span>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

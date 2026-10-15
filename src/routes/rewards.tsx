import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimDailyReward, rewardStatus } from "@/lib/ora-advanced-api";
import { formatClock, formatWhen } from "@/lib/ora";
import { StreakTracker } from "@/components/streak-tracker";

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
          <p className="mt-1 text-sm text-muted">{failed || "Seven daily check-ins. Day 7 adds 3 free minutes. Sign in to see your streak."}</p>
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
        <p className="mt-1 text-sm text-muted">Check in once each day for 7 days. Day 7 adds 3 free reading minutes. Check-ins do not add coins. Miss a day and the streak starts over.</p>
        <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-sm text-muted">Streak minutes</p>
          <p className="font-display text-3xl tabular-nums text-primary">{formatClock(data.streakSeconds)}</p>
          <p className="text-xs text-faint">Free reading time only. It is separate from welcome minutes, membership minutes, and coins, and it cannot be withdrawn.</p>
          <div className="mt-4">
            <StreakTracker nextDay={data.nextDay} canClaim={data.canClaim} prizeMinutes={data.prizeMinutes} />
          </div>
          <Button
            className="mt-4 w-full rounded-full"
            disabled={!data.enabled || !data.canClaim || busy}
            onClick={() => {
              setBusy(true);
              const key = "ora-device-id";
              let deviceId = "";
              try {
                deviceId = localStorage.getItem(key) || "";
                if (!deviceId) {
                  deviceId = crypto.randomUUID();
                  localStorage.setItem(key, deviceId);
                }
              } catch {
                deviceId = "";
              }
              void claimDailyReward({ data: { deviceId } })
                .then((res) => {
                  toast.success(res.body);
                  return load();
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : "Could not check in"))
                .finally(() => setBusy(false));
            }}
          >
            {!data.enabled ? "Check-in is off" : data.canClaim ? `Check in · Day ${data.nextDay}` : "Checked in today"}
          </Button>
          {wait ? <p className="mt-2 text-xs text-faint">Next check-in after {wait}.</p> : null}
        </section>
        <ul className="mt-4 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {data.history.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>Day {row.day} · {formatWhen(row.at)}</span>
              <span className="tabular-nums text-primary">{row.minutes ? `+${row.minutes} min` : "Checked in"}</span>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

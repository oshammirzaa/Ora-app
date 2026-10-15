import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { rewardStatus } from "@/lib/ora-advanced-api";
import { useAdvancedFlags } from "@/components/advanced-links";
import { formatClock } from "@/lib/ora";
import { cn } from "@/lib/utils";

export function StreakTracker({
  nextDay,
  canClaim,
  prizeMinutes = 3,
}: {
  nextDay: number;
  canClaim: boolean;
  prizeMinutes?: number;
}) {
  const doneThrough = canClaim ? Math.max(0, nextDay - 1) : nextDay;
  return (
    <ol className="grid grid-cols-7 gap-1">
      {Array.from({ length: 7 }, (_, index) => {
        const day = index + 1;
        const done = day <= doneThrough;
        const current = canClaim && day === nextDay;
        return (
          <li
            key={day}
            className={cn(
              "rounded-xl px-1 py-2 text-center text-xs",
              current || done ? "bg-[#f3eaf6] text-[#6d3d78]" : "bg-elevated text-muted",
            )}
          >
            <span className="block">D{day}</span>
            <span className="font-medium tabular-nums">{day === 7 ? `${prizeMinutes}m` : done ? "✓" : "·"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function DashboardStreak() {
  const flags = useAdvancedFlags();
  const [data, setData] = useState<Awaited<ReturnType<typeof rewardStatus>> | null>(null);
  useEffect(() => {
    if (!flags?.rewards) return;
    void rewardStatus()
      .then(setData)
      .catch(() => setData(null));
  }, [flags?.rewards]);
  if (!flags?.rewards || !data) return null;
  return (
    <section className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-wide text-faint uppercase">Daily streak</p>
        <Link to="/rewards" className="text-sm text-primary">
          Open
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        {data.canClaim ? `Day ${data.nextDay} of 7 is ready.` : `Day ${data.nextDay} of 7 is done for today.`} Day 7 adds 3 free minutes. No coins.
      </p>
      <div className="mt-3">
        <StreakTracker nextDay={data.nextDay} canClaim={data.canClaim} prizeMinutes={data.prizeMinutes} />
      </div>
      <p className="mt-2 text-xs text-faint">Streak minutes left {formatClock(data.streakSeconds)}. These cannot be withdrawn.</p>
    </section>
  );
}

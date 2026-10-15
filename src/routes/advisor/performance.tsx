import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorPerformance } from "@/lib/ora-advanced-api";

export const Route = createFileRoute("/advisor/performance")({ component: PerformancePage });

const RANGES = ["today", "7", "30", "90", "all"] as const;

function PerformancePage() {
  const { user, isPending } = useCurrentUserState();
  const [range, setRange] = useState<(typeof RANGES)[number]>("30");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorPerformance>> | null>(null);

  useEffect(() => {
    if (!user) return;
    void advisorPerformance({ data: { range } })
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load performance"));
  }, [user, range]);

  if (isPending || (user && !data)) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user || !data) return <RedirectToSignIn to="/advisor/login" />;
  const m = data.metrics;

  return (
    <main className="space-y-4">
      <Link to="/advisor/settings" className="text-sm text-primary">Settings</Link>
      <h1 className="font-display text-3xl">Performance</h1>
      <p className="text-sm text-muted">Private to you and admins. This score does not change your commission. It needs at least {data.minimum} completed paid readings in the range.</p>
      <div className="flex flex-wrap gap-2">
        {RANGES.map((item) => (
          <Button key={item} type="button" size="sm" variant={range === item ? "default" : "outline"} onClick={() => setRange(item)}>
            {item === "7" ? "7 days" : item === "30" ? "30 days" : item === "90" ? "90 days" : item === "all" ? "All" : "Today"}
          </Button>
        ))}
      </div>
      <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="text-xs tracking-wide text-faint uppercase">Score</p>
        <p className="font-display text-4xl text-primary">{data.score == null ? "—" : data.score}</p>
        <p className="text-sm text-muted">{data.score == null ? `${data.sample} of ${data.minimum} paid readings so far.` : `From ${data.sample} paid readings. Not shown on your public profile.`}</p>
      </section>
      <dl className="grid grid-cols-2 gap-2">
        {[
          ["Paid readings", m.paidCompleted],
          ["Returning clients", m.returningClients],
          ["Avg rating", m.avgRating == null ? "—" : m.avgRating.toFixed(1)],
          ["Avg response", m.avgResponseSeconds == null ? "—" : `${Math.round(m.avgResponseSeconds)}s`],
          ["Accepted", m.accepted],
          ["Missed", m.missed],
          ["Online", `${Math.round(m.onlineSeconds / 60)} min`],
          ["Scheduled kept", m.scheduledCompleted],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
            <dt className="text-xs text-faint">{label}</dt>
            <dd className="text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="space-y-1 text-xs text-muted">
        {data.parts.map((part) => (
          <li key={part.key}>{Math.round(part.weight * 100)}% · {part.detail}</li>
        ))}
      </ul>
    </main>
  );
}

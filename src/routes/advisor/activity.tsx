import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdvisorPageHeader } from "@/components/advisor-shell";
import { advisorActivity } from "@/lib/ora-advisor";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/activity")({ component: ActivityPage });

function ActivityPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorActivity>> | null>(null);

  useEffect(() => {
    void advisorActivity()
      .then(setData)
      .catch(() => setData({ presence: [], readings: [] }));
  }, []);

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <AdvisorPageHeader
        title="Activity"
        description="Online/offline history and text-reading activity. Advisor share is 20%. Ora keeps 80%."
      />

      <section>
        <h2 className="font-display text-xl">Online history</h2>
        {!data.presence.length ? (
          <p className="mt-2 text-sm text-muted">No online sessions recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.presence.map((p) => (
              <li key={p.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <p className="font-medium">{p.open ? "Online now" : "Offline session"}</p>
                <p className="mt-1 text-xs text-faint">
                  {formatWhen(p.startedAt)}
                  {p.endedAt ? ` → ${formatWhen(p.endedAt)}` : ""} · {formatDuration(p.seconds)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Text readings</h2>
        {!data.readings.length ? (
          <p className="mt-2 text-sm text-muted">No completed text readings yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.readings.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <p className="font-medium">{r.customerName}</p>
                <p className="mt-1 text-xs text-faint">
                  {formatWhen(r.startedAt)}
                  {r.endedAt ? ` → ${formatWhen(r.endedAt)}` : ""} · {r.minutes.toFixed(1)} min · {r.coinsSpent}c
                </p>
                <p className="mt-1 text-xs text-muted">
                  Advisor 20% {r.advisorEarnings}c · Ora 80% {r.platformRevenue}c
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

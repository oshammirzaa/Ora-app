import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, Stat, EmptyNote } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { adminReports } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminReports>> | null>(null);

  useEffect(() => {
    void adminReports({ data: { days, t: Date.now() } })
      .then(setData)
      .catch(() => setData(null));
  }, [days]);

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  const tot = data.rows.reduce(
    (a, r) => ({
      sessions: a.sessions + r.sessions,
      spent: a.spent + r.spent,
      earned: a.earned + r.earned,
      fee: a.fee + r.fee,
    }),
    { sessions: 0, spent: 0, earned: 0, fee: 0 },
  );
  const max = Math.max(1, ...data.rows.map((r) => r.spent + r.fee));

  return (
    <main>
      <PageHeader
        title="Reports"
        description="Revenue, sittings, advisor earnings, and customer spend by day."
      />
      <div className="mt-4 flex gap-2">
        {[7, 14, 30].map((n) => (
          <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)}>
            {n} days
          </Button>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sessions" value={String(tot.sessions)} tone="lotus" />
        <Stat label="Customer spend" value={`${tot.spent}c`} tone="blush" />
        <Stat label="Advisor earnings" value={`${tot.earned}c`} tone="primary" />
        <Stat label="House take" value={`${tot.fee}c`} tone="gold" />
      </div>
      <ul className="mt-8 space-y-2">
        {!data.rows.length ? (
          <li>
            <EmptyNote>No sittings in this window.</EmptyNote>
          </li>
        ) : (
          data.rows.map((r) => (
            <li key={r.day} className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
              <div className="flex justify-between text-sm">
                <span>{r.day}</span>
                <span className="tabular-nums text-muted">
                  {r.sessions} · {r.spent}c · house {r.fee}c
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(((r.spent + r.fee) / max) * 100)}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

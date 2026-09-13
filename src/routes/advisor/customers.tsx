import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdvisorPageHeader } from "@/components/advisor-shell";
import { advisorCustomers } from "@/lib/ora-advisor";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/customers")({ component: CustomersPage });

function CustomersPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorCustomers>> | null>(null);

  useEffect(() => {
    void advisorCustomers().then(setData).catch(() => setData({ customers: [] }));
  }, []);

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <AdvisorPageHeader
        title="Customers"
        description="People who have completed a text reading with you. Outreach tools are not in this phase."
      />
      {!data.customers.length ? (
        <p className="text-sm text-muted">No completed readings yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.customers.map((c) => (
            <li key={c.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-xs text-faint">
                {c.readings} readings · {formatDuration(c.seconds)} · advisor 20% {c.advisorEarnings}c
                {c.lastAt ? ` · last ${formatWhen(c.lastAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

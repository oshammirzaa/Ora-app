import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin-shell";
import { adminTrusted } from "@/lib/ora-admin";
import { MIN_FREE_CLIENTS } from "@/lib/ora-rank";

export const Route = createFileRoute("/admin/trusted")({ component: TrustedPage });

function TrustedPage() {
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof adminTrusted>> | null>(null);

  async function load(next = month) {
    setData(await adminTrusted({ data: { month: next, t: Date.now() } }));
  }

  useEffect(() => {
    void load("").catch(() => setData(null));
  }, []);

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  const ranking = Array.isArray(data.ranking) ? data.ranking : [];
  const months = (Array.isArray(data.months) && data.months.length ? data.months : [data.current]).filter(
    (month): month is string => typeof month === "string" && month.length > 0,
  );

  return (
    <main>
      <PageHeader
        title="Trusted Psychics"
        description={`Current Top 10 is automatic from the last 30 days of genuine free-to-paid conversions. Rank requires ${MIN_FREE_CLIENTS} unique completed free-client sittings. Earlier months stay as saved. Figures cannot be edited.`}
      />
      <label className="block max-w-xs text-sm">
        <span className="mb-1.5 block text-xs tracking-wide text-faint uppercase">Month</span>
        <select
          className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          value={data.month}
          onChange={(e) => {
            setMonth(e.target.value);
            void load(e.target.value).catch(() => undefined);
          }}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m.slice(0, 7)}
              {m === data.current ? " · current" : ""}
            </option>
          ))}
        </select>
      </label>

      <ul className="mt-6 ora-rows">
        {!ranking.length ? (
          <li className="px-4 py-6 text-center text-sm text-muted">No ranked psychics for this month yet.</li>
        ) : (
          ranking.map((row) => (
            <li key={row.advisorId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                <span className="font-medium text-primary">#{row.rank}</span> {row.name}
                <span className="mt-0.5 block text-xs text-faint">
                  Eligible free clients {row.eligibleFreeClients} · Converted {row.convertedPaidClients} · Paid clients{" "}
                  {row.paidClients} · {((Number(row.conversionRate) || 0) * 100).toFixed(1)}% · Paid session revenue {row.paidSessionRevenue}c
                </span>
              </span>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

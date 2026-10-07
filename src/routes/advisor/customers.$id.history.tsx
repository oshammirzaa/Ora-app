import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/advisor-desk";
import { advisorClientProfile } from "@/lib/ora-advisor-desk";
import { formatUsdFromCoins, revenueStatus } from "@/lib/ora-advisor-desk-stats";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/customers/$id/history")({
  component: ClientHistoryPage,
});

function ClientHistoryPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorClientProfile>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    void advisorClientProfile({ data: { customerId: id } })
      .then((next: any) => {
        if (alive) setData(next);
      })
      .catch((err: any) => {
        if (alive) setError(err instanceof Error ? err.message : "Client not found.");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <main className="space-y-4">
      <Link
        to="/advisor/customers/$id"
        params={{ id }}
        preload={false}
        className="inline-flex items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft className="size-4" />
        Client Profile
      </Link>
      <div>
        <h1 className="font-display text-2xl text-fg">History of conversations</h1>
        {data?.name ? <p className="mt-1 text-sm text-muted">{data.name}</p> : null}
      </div>
      {error ? (
        <EmptyState title="Client not found" body="This profile is only for people who have already sat with you." />
      ) : !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-elevated" />
      ) : data.history.length ? (
        <ul className="space-y-2">
          {data.history.map((row: any) => (
            <li key={row.id}>
              <Link
                to="/advisor/session/$id"
                params={{ id: row.id }}
                preload={false}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-fg">{revenueStatus(row.status)}</p>
                  <p className="text-xs text-faint">
                    {formatWhen(row.startedAt) || "—"} · {formatDuration(row.seconds)}
                  </p>
                </div>
                <p className="text-sm tabular-nums text-primary">{formatUsdFromCoins(row.coinsSpent)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No conversations yet" body="Completed sittings with this client will appear here." />
      )}
    </main>
  );
}

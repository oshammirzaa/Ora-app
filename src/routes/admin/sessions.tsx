import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { formatClock, formatWhen } from "@/lib/ora";
import { adminEndSession, adminSessions } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/sessions")({ component: SessionsPage });

function SessionsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminSessions>>>([]);

  async function load() {
    setRows(await adminSessions({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, []);

  const live = rows.filter((r) => r.status === "live");

  return (
    <main>
      <PageHeader
        title="Sessions"
        description="Active chats and the full sitting record. Ending a live chat stops billing."
      />

      <h2 className="mt-8 font-display text-xl">Active</h2>
      {!live.length ? (
        <p className="mt-2 text-sm text-muted">None live.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {live.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-4">
              <span className="text-sm">
                {r.client} · {r.advisor} · {formatClock(r.seconds)} · {r.coinsSpent}c
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void adminEndSession({ data: { id: r.id } })
                    .then(() => {
                      toast.success("Session ended.");
                      return load();
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Could not end"))
                }
              >
                Force end
              </Button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-display text-xl">Records</h2>
      <ul className="mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
        {!rows.length ? (
          <li className="px-4 py-3 text-sm text-muted">None yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <p>
                {r.status} · {r.client} · {r.advisor}
              </p>
              <p className="text-xs text-muted">
                {formatWhen(r.startedAt)}
                {r.endedAt ? ` – ${formatWhen(r.endedAt)}` : ""} · {formatClock(r.seconds)} · {r.rateCoins}c/min ·
                charged {r.coinsSpent}c · advisor {r.advisorEarned}c · house {r.platformFee}c
              </p>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, EmptyNote } from "@/components/admin-shell";
import { formatClock, formatWhen } from "@/lib/ora";
import { adminSessions } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/sessions")({ component: SessionsPage });

function billKind(r: { coinsSpent: number; bonusUsed: number; weeklyUsed: number }) {
  const free = r.bonusUsed + r.weeklyUsed > 0;
  const paid = r.coinsSpent > 0;
  if (paid && free) return "Free then paid";
  if (paid) return "Paid";
  if (free) return "Included minutes";
  return "Unbilled";
}

function SessionsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminSessions>>>([]);

  async function load() {
    setRows(await adminSessions({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
    const id = window.setInterval(() => void load().catch(() => undefined), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const live = rows.filter((r) => r.status === "live");
  const history = rows.filter((r) => r.status !== "live");

  return (
    <main>
      <PageHeader
        title="Live Sessions"
        description="Observe active chats and completed sittings. Watching does not change timers or billing."
      />

      <h2 className="mt-8 font-display text-xl">Active now</h2>
      {!live.length ? (
        <EmptyNote>None live.</EmptyNote>
      ) : (
        <ul className="mt-3 space-y-2">
          {live.map((r) => (
            <li key={r.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="text-sm">
                {r.client} · {r.advisor}
              </p>
              <p className="mt-1 text-xs text-muted">
                Started {formatWhen(r.startedAt)} · elapsed {formatClock(r.seconds)} · {billKind(r)} · {r.rateCoins}
                c/min · billed {r.coinsSpent}c · included {formatClock(r.bonusUsed + r.weeklyUsed)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-display text-xl">Completed history</h2>
      <ul className="mt-3 ora-rows">
        {!history.length ? (
          <li className="px-4 py-6 text-center text-sm text-muted">None yet.</li>
        ) : (
          history.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <p>
                {r.status} · {r.client} · {r.advisor} · {billKind(r)}
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

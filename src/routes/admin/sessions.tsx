import { createFileRoute } from "@tanstack/react-router";
import { Ban, CheckCircle2, Clock, MessageSquare, Timer, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { InfoNote, PageHeader, Panel, Stat, EmptyNote } from "@/components/admin-shell";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
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
  const cancelled = rows.filter((r) => r.status === "cancelled");
  const completed = rows.filter((r) => r.status !== "live" && r.status !== "cancelled");
  const paidSeconds = rows.reduce((sum, r) => sum + (r.coinsSpent > 0 ? r.seconds : 0), 0);
  const freeSeconds = rows.reduce((sum, r) => sum + r.bonusUsed + r.weeklyUsed, 0);
  const advisorShare = rows.reduce((sum, r) => sum + r.advisorEarned, 0);
  const houseShare = rows.reduce((sum, r) => sum + r.platformFee, 0);

  return (
    <main>
      <PageHeader
        icon={MessageSquare}
        title="Sessions"
        description="Live, completed, and cancelled sittings. Watching does not change timers or billing. Counts below are the latest sittings returned by the desk, not a new ledger."
      />
      <InfoNote>Free minutes are included time already stored on the sitting. Paid minutes are sittings that billed coins. Earnings are the stored advisor and house shares.</InfoNote>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Live sessions" value={String(live.length)} hint="On the clock" icon={MessageSquare} tone="sky" pulse={live.length > 0} />
        <Stat label="Completed" value={String(completed.length)} hint="Ended, not cancelled" icon={CheckCircle2} tone="mint" />
        <Stat label="Cancelled" value={String(cancelled.length)} hint="In this list" icon={Ban} tone="rose" />
        <Stat label="Session time" value={formatClock(rows.reduce((sum, r) => sum + r.seconds, 0))} hint="Elapsed on these sittings" icon={Clock} tone="teal" />
        <Stat label="Paid sittings" value={formatClock(paidSeconds)} hint="Sittings that billed coins" icon={Timer} tone="sand" />
        <Stat label="Free minutes" value={formatClock(freeSeconds)} hint="Included minutes used" icon={Timer} tone="violet" />
        <Stat label="Advisor share" value={`${advisorShare}c`} hint="Stored on these sittings" icon={Wallet} tone="sand" />
        <Stat label="House share" value={`${houseShare}c`} hint="Stored platform fee" icon={Wallet} tone="violet" />
      </div>

      <Panel title="Active now" icon={MessageSquare}>
      {!live.length ? (
        <EmptyNote>None live.</EmptyNote>
      ) : (
        <ul className="mt-3 space-y-2">
          {live.map((r) => (
            <li key={r.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <ClientNameWithBadge name={r.client} tier={r.loyaltyTier} className="font-medium" />
                <span>· {r.advisor}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                Started {formatWhen(r.startedAt)} · elapsed {formatClock(r.seconds)} · {billKind(r)} · {r.rateCoins}
                c/min · billed {r.coinsSpent}c · included {formatClock(r.bonusUsed + r.weeklyUsed)}
              </p>
            </li>
          ))}
        </ul>
      )}

      </Panel>

      <Panel title="History" icon={CheckCircle2}>
      <ul className="ora-rows">
        {!completed.length && !cancelled.length ? (
          <li className="px-4 py-6 text-center text-sm text-muted">None yet.</li>
        ) : (
          [...completed, ...cancelled].map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-1.5">
                <span>{r.status} ·</span>
                <ClientNameWithBadge name={r.client} tier={r.loyaltyTier} />
                <span>· {r.advisor} · {billKind(r)}</span>
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
      </Panel>
    </main>
  );
}

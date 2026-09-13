import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdvisorPageHeader } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";
import { decideRequest, formatClock, getDesk, type Desk } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/advisor/readings")({ component: ReadingsPage });

function ReadingsPage() {
  const navigate = useNavigate();
  const [desk, setDesk] = useState<Desk | null>(null);
  const load = useCallback(() => getDesk().then(setDesk).catch(() => setDesk(null)), []);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibleInterval(() => {
    void load();
  }, 4000, Boolean(desk), false);

  async function decide(id: string, accept: boolean) {
    try {
      const res = await decideRequest({ data: { id, accept } });
      if (accept && res.readingId) {
        await navigate({ to: "/advisor/session/$id", params: { id: res.readingId } });
        return;
      }
      toast.success("Declined.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decide");
    }
  }

  if (!desk) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <AdvisorPageHeader
        title="Live Text Readings"
        description="Accept incoming paid chats and continue the session that is already open."
      />
      {desk.live ? (
        <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-warn uppercase">In progress</p>
          <p className="mt-1 font-display text-xl">{desk.live.clientName}</p>
          <p className="text-sm tabular-nums text-primary">
            {formatClock(desk.live.seconds)} · you {desk.live.advisorEarned}c
          </p>
          <Button asChild className="mt-3">
            <Link to="/advisor/session/$id" params={{ id: desk.live.id }} preload={false}>
              Open chat
            </Link>
          </Button>
        </section>
      ) : (
        <p className="text-sm text-muted">No live reading right now.</p>
      )}

      <section className="mt-6">
        <h2 className="font-display text-xl">Incoming</h2>
        {!desk.requests.length ? (
          <p className="mt-2 text-sm text-muted">
            {desk.advisor?.online ? "Waiting for a client." : "Go online from Overview to receive requests."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {desk.requests.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <p className="font-display text-lg">{r.clientName}</p>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" disabled={Boolean(desk.live)} onClick={() => void decide(r.id, true)}>
                    Accept
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => void decide(r.id, false)}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

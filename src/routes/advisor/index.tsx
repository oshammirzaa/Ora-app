import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdvisorPageHeader, AdvisorStat } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";
import { advisorOverview } from "@/lib/ora-advisor";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { decideRequest, formatClock, setOnline } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/advisor/")({ component: AdvisorOverviewPage });

function AdvisorOverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorOverview>> | null>(null);

  const load = useCallback(() => advisorOverview().then(setData).catch(() => setData(null)), []);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibleInterval(() => {
    void load();
  }, 8000, Boolean(data), false);

  async function toggle(online: boolean) {
    try {
      await setOnline({ data: { online } });
      await load();
      toast.success(online ? "You are live on the floor." : "You are offline.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

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

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <AdvisorPageHeader
        kicker="Advisor panel"
        title={data.name}
        description={data.online ? "You are available for paid text readings." : "Go online to appear on the customer floor."}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button disabled={data.busy && data.online} onClick={() => void toggle(!data.online)}>
          {data.online ? "Go offline" : "Go online"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/advisor/readings" preload={false}>
            Live Text Readings
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdvisorStat label="Status" value={data.busy ? "In reading" : data.online ? "Online" : "Offline"} />
        <AdvisorStat label="This session" value={formatDuration(data.currentSeconds)} hint={data.lastOnlineAt ? `Online since ${new Date(data.lastOnlineAt).toLocaleString()}` : "Not in an online session"} />
        <AdvisorStat label="Online today" value={formatDuration(data.onlineToday)} />
        <AdvisorStat label="Online this week" value={formatDuration(data.onlineWeek)} />
        <AdvisorStat label="Online this month" value={formatDuration(data.onlineMonth)} />
        <AdvisorStat label="Text readings" value={String(data.readings)} hint={`${data.readingMinutes.toFixed(1)} minutes`} />
        <AdvisorStat label="Advisor 20%" value={`${data.advisorEarnings}c`} />
        <AdvisorStat label="Ora 80%" value={`${data.platformRevenue}c`} />
      </div>

      {data.live ? (
        <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-warn uppercase">Current session</p>
          <p className="mt-1 font-display text-xl">{data.live.clientName}</p>
          <p className="text-sm tabular-nums text-primary">
            {formatClock(data.live.seconds)} · {data.live.coinsSpent}c billed
          </p>
          <Button asChild className="mt-3">
            <Link to="/advisor/session/$id" params={{ id: data.live.id }} preload={false}>
              Open chat
            </Link>
          </Button>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-xl">Incoming chats</h2>
        {!data.incoming.length ? (
          <p className="mt-2 text-sm text-muted">
            {data.online ? "Waiting for a client." : "Go online to receive requests."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.incoming.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <p className="font-display text-lg">{r.clientName}</p>
                <p className="text-xs text-faint">wants a reading</p>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" disabled={Boolean(data.live)} onClick={() => void decide(r.id, true)}>
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

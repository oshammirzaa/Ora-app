import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdvisorShell } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { decideRequest, formatClock, getDesk, getInbox, setOnline, type Desk } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/advisor/")({ component: DeskPage });

function DeskPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [desk, setDesk] = useState<Desk | null>(null);

  const load = useCallback(() => {
    return getDesk()
      .then(setDesk)
      .catch(() => setDesk(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  useVisibleInterval(
    () => {
      void getInbox()
        .then((box) => {
          setDesk((d) => {
            if (!d) return d;
            const sameLive =
              d.live?.id === box.live?.id &&
              d.live?.seconds === box.live?.seconds &&
              d.live?.advisorEarned === box.live?.advisorEarned;
            const sameReq =
              d.requests.length === box.requests.length && d.requests[0]?.id === box.requests[0]?.id;
            if (d.advisor?.online === box.online && d.advisor?.busy === box.busy && sameLive && sameReq) {
              return d;
            }
            return {
              ...d,
              advisor: d.advisor ? { ...d.advisor, online: box.online, busy: box.busy } : d.advisor,
              live: box.live,
              requests: box.requests,
            };
          });
        })
        .catch(() => {});
    },
    3000,
    Boolean(user && desk?.advisor),
    false,
  );

  useVisibleInterval(
    () => {
      setDesk((d) => {
        if (!d?.live) return d;
        return { ...d, live: { ...d.live, seconds: d.live.seconds + 1 } };
      });
    },
    1000,
    Boolean(desk?.live),
    false,
  );

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

  if (isPending) {
    return (
      <AdvisorShell tab="desk">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" />
      </AdvisorShell>
    );
  }
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  const adv = desk?.advisor;
  const pending = desk?.applicationStatus === "pending";
  const declined = desk?.applicationStatus === "declined";
  const approved = adv?.status === "live";

  return (
    <AdvisorShell
      tab="desk"
      online={adv?.online}
      busy={adv?.busy}
      canToggle={approved}
      onToggle={(v) => void toggle(v)}
    >
      <main className="px-4 py-8">
        <p className="text-xs tracking-wide text-faint uppercase">Advisor desk</p>
        <h1 className="mt-1 font-display text-3xl">{adv?.name || "Desk"}</h1>
        <p className="mt-1 text-sm text-muted">
          {approved
            ? adv?.online
              ? "You are Live on the customer floor."
              : "Go online to receive paid chats."
            : pending
              ? "Application in review. You cannot go online yet."
              : declined
                ? "Application declined. Update and apply again."
                : "Apply as an advisor to open a desk."}
        </p>

        {!adv && !pending ? (
          <div className="mt-6 space-y-3">
            <Button asChild className="w-full">
              <Link to="/advisor/signup" preload={false}>
                Apply as advisor
              </Link>
            </Button>
            <p className="text-sm text-muted">
              Already have a customer account?{" "}
              <Link to="/apply" preload={false} className="text-primary">
                Apply with this login
              </Link>
            </p>
          </div>
        ) : null}

        {pending ? (
          <div className="mt-6 rounded-xl bg-surface p-5 text-sm text-muted shadow-[var(--shadow-border)]">
            Status: pending verification. The owner panel approves you before Live.
          </div>
        ) : null}

        {approved && desk?.live ? (
          <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-wide text-warn uppercase">Current session</p>
            <p className="mt-1 font-display text-xl">{desk.live.clientName}</p>
            <p className="text-sm tabular-nums text-primary">
              {formatClock(desk.live.seconds)} · you {desk.live.advisorEarned}c
            </p>
            <Button asChild className="mt-3 w-full">
              <Link to="/advisor/session/$id" params={{ id: desk.live.id }} preload={false}>
                Open chat
              </Link>
            </Button>
          </section>
        ) : null}

        {approved ? (
          <section className="mt-6">
            <h2 className="font-display text-xl">Incoming chats</h2>
            {!desk?.requests.length ? (
              <p className="mt-2 text-sm text-muted">
                {adv?.online ? "Waiting for a client." : "Go online to receive requests."}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {desk.requests.map((r) => (
                  <li key={r.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                    <p className="font-display text-lg">{r.clientName}</p>
                    <p className="text-xs text-faint">wants a reading</p>
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
        ) : null}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat label="Today" value={`${desk?.earningsToday ?? 0}c`} />
          <Stat label="Total" value={`${desk?.earningsTotal ?? 0}c`} />
        </div>
      </main>
    </AdvisorShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-faint uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

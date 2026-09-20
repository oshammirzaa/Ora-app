import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { SessionHistoryCard } from "@/components/session-history-card";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCustomer, type Customer } from "@/lib/ora";

export const Route = createFileRoute("/work")({ component: WorkPage });

function WorkPage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Customer | null>(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      return;
    }
    void getCustomer()
      .then(setData)
      .catch(() => setData(null));
  }, [user]);

  if (isPending) {
    return (
      <AppShell tab="work">
        <div className="mx-4 mt-8 h-48 animate-pulse rounded-2xl bg-elevated" />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell tab="work">
        <main className="px-4 py-8">
          <p className="text-xs tracking-wide text-muted uppercase">Your sittings</p>
          <h1 className="mt-1 font-display text-3xl text-fg">Readings</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in to see live and past sessions, timers, and reviews.
          </p>
          <div className="mt-6 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <Clock3 className="size-6 text-primary" strokeWidth={1.7} />
            <p className="mt-3 font-display text-xl text-fg">No readings yet</p>
            <p className="mt-1 text-sm text-muted">Your first three minutes are waiting after you sign in.</p>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full rounded-full">
              <Link to="/signup">Create account</Link>
            </Button>
          </div>
        </main>
      </AppShell>
    );
  }

  const sessions = data?.sessions ?? [];
  const live = sessions.filter((s) => s.status !== "ended");
  const past = sessions.filter((s) => s.status === "ended");

  return (
    <AppShell tab="work">
      <main className="px-4 py-8">
        <p className="text-xs tracking-wide text-muted uppercase">{data?.me.displayName || "Customer"}</p>
        <h1 className="mt-1 font-display text-3xl text-fg">Readings</h1>
        <p className="mt-2 text-sm text-muted">Live sittings, history, and reviews — same sessions as your account.</p>

        <Button asChild className="mt-5 w-full rounded-full">
          <Link to="/">Start a reading</Link>
        </Button>

        {live.length ? (
          <section className="mt-8">
            <h2 className="font-display text-xl text-fg">Live now</h2>
            <ul className="mt-3 space-y-2">
              {live.map((s) => (
                <li key={s.id}>
                  <SessionHistoryCard session={s} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl text-fg">Reading History</h2>
          {!past.length ? (
            <div className="mt-3 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
              <p className="text-sm text-muted">No past readings yet. Chat with a psychic to start one.</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {past.map((s) => (
                <li key={s.id}>
                  <SessionHistoryCard session={s} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}

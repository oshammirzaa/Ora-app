import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { SessionHistoryCard } from "@/components/session-history-card";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getCustomer, type SessionRow } from "@/lib/ora";
import { useOraRefresh } from "@/lib/use-ora-refresh";

export const Route = createFileRoute("/reading-history")({ component: ReadingHistoryPage });

function ReadingHistoryPage() {
  const { user, isPending } = useCurrentUserState();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  async function load() {
    const next = await getCustomer();
    setSessions(next.sessions);
  }

  useEffect(() => {
    if (!user) {
      setSessions(null);
      return;
    }
    void load().catch(() => setSessions([]));
  }, [user]);
  useOraRefresh(() => {
    if (!user) return;
    return load().catch(() => undefined);
  });

  if (isPending || (user && !sessions)) {
    return (
      <AppShell tab="you">
        <div className="mx-4 mt-8 h-48 animate-pulse rounded-xl bg-elevated" />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">Reading History</h1>
          <p className="mt-2 text-sm text-muted">Sign in to see your previous readings and sittings.</p>
          <Button asChild className="mt-6 w-full rounded-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </main>
      </AppShell>
    );
  }

  const rows = sessions ?? [];
  const live = rows.filter((s) => s.status !== "ended");
  const past = rows.filter((s) => s.status === "ended");

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" preload={false} className="text-sm text-primary">
          Back to account
        </Link>
        <h1 className="mt-3 font-display text-3xl text-fg">Reading History</h1>
        <p className="mt-1 text-sm text-muted">Previous readings and sitting history.</p>
        {live.length ? (
          <section className="mt-6">
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
        <section className="mt-6">
          {!past.length ? (
            <p className="text-sm text-muted">No readings yet.</p>
          ) : (
            <ul className="space-y-2">
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

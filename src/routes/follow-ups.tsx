import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatWhen } from "@/lib/ora";
import { listMyFollowUps } from "@/lib/ora-favorites";
import { useOraRefresh } from "@/lib/use-ora-refresh";

type FollowUp = Awaited<ReturnType<typeof listMyFollowUps>>["messages"][number];

export const Route = createFileRoute("/follow-ups")({ component: FollowUpsPage });

function FollowUpsPage() {
  const { user, isPending } = useCurrentUserState();
  const [messages, setMessages] = useState<FollowUp[] | null>(null);

  async function load() {
    const inbox = await listMyFollowUps();
    setMessages(inbox.messages);
  }

  useEffect(() => {
    if (!user) {
      setMessages(null);
      return;
    }
    void load().catch(() => setMessages([]));
  }, [user]);
  useOraRefresh(() => {
    if (!user) return;
    return load().catch(() => undefined);
  });

  if (isPending || (user && !messages)) {
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
          <h1 className="font-display text-3xl text-fg">Messages</h1>
          <p className="mt-2 text-sm text-muted">Follow-ups from advisors after a sitting.</p>
          <Button asChild className="mt-6 w-full rounded-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" preload={false} className="text-sm text-primary">
          Back to account
        </Link>
        <h1 className="mt-3 font-display text-3xl text-fg">Messages</h1>
        <p className="mt-1 text-sm text-muted">Follow-ups from advisors after a sitting.</p>
        {!messages?.length ? (
          <p className="mt-4 text-sm text-muted">No follow-ups yet. They appear here after an advisor writes you about a completed sitting.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {messages.map((m) => (
              <li key={m.id} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
                <Link to="/advisors/$id" params={{ id: m.advisorSlug }} preload={false} className="block">
                  <p className="font-display text-fg">{m.advisorName}</p>
                  <p className="mt-1 text-sm text-muted">{m.body}</p>
                  <p className="mt-1 text-xs text-faint">{formatWhen(m.at)}</p>
                </Link>
                <Link to="/messages/$id" params={{ id: m.advisorSlug }} preload={false} className="mt-2 inline-flex text-xs text-primary">
                  Reply
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

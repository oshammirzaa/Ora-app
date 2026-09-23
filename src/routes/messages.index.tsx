import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdvisorMedia } from "@/components/advisor-media";
import { AppShell } from "@/components/app-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatWhen } from "@/lib/ora";
import { listCustomerInbox } from "@/lib/ora-paid-messages-api";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/messages/")({ component: CustomerInboxPage });

function CustomerInboxPage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Awaited<ReturnType<typeof listCustomerInbox>> | null>(null);

  function load() {
    return listCustomerInbox()
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not open messages"));
  }

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  useVisibleInterval(() => {
    if (!user) return;
    void listCustomerInbox().then(setData).catch(() => {});
  }, 5000, Boolean(user), false);

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn />;

  const threads = data?.threads || [];

  return (
    <AppShell tab="you">
      <main className="px-4 py-6">
        <p className="text-xs tracking-wide text-faint uppercase">Messages</p>
        <h1 className="mt-1 font-display text-3xl text-fg">Inbox</h1>
        {!threads.length ? (
          <div className="mt-6 rounded-2xl bg-surface p-5 text-sm text-muted shadow-[var(--shadow-border)]">
            <MessageSquare className="mb-2 size-5 text-primary" />
            No messages yet. Open an advisor and send a message when you want guidance.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {threads.map((thread) => (
              <li key={thread.advisorId}>
                <Link
                  to="/messages/$id"
                  params={{ id: thread.slug || thread.advisorId }}
                  preload={false}
                  className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-full bg-elevated">
                    <AdvisorMedia photo={thread.photo} alt="" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-fg">{thread.name}</p>
                      <p className="shrink-0 text-[11px] text-faint">{thread.at ? formatWhen(thread.at) : ""}</p>
                    </div>
                    <p className="truncate text-sm text-muted">{thread.preview || "No messages yet"}</p>
                  </div>
                  {thread.unread > 0 ? (
                    <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] text-primary-fg">
                      {thread.unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

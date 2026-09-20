import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatClock, formatWhen } from "@/lib/ora";
import {
  createTicket,
  listMyTickets,
  listSupportOptions,
  SUPPORT_REASONS,
  statusLabel,
  type SupportReason,
} from "@/lib/ora-support";

export const Route = createFileRoute("/support/")({ component: SupportPage });

function SupportPage() {
  const { user, isPending } = useCurrentUserState();
  const [tickets, setTickets] = useState<Awaited<ReturnType<typeof listMyTickets>>["tickets"]>([]);
  const [unread, setUnread] = useState(0);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listSupportOptions>>["sessions"]>([]);
  const [reason, setReason] = useState<SupportReason>(SUPPORT_REASONS[0].id);
  const [readingId, setReadingId] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [mine, opts] = await Promise.all([listMyTickets(), listSupportOptions()]);
    setTickets(mine.tickets);
    setUnread(mine.unread);
    setSessions(opts.sessions);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch(() => setTickets([]));
  }, [user]);

  if (isPending) {
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
          <h1 className="font-display text-3xl text-fg">Support</h1>
          <p className="mt-2 text-sm text-muted">Sign in to open a private ticket with Ora staff.</p>
          <Button asChild className="mt-6 w-full rounded-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </main>
      </AppShell>
    );
  }

  const needsLink = reason === "advisor" || reason === "session" || reason === "refund";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await createTicket({
        data: { reason, body, readingId: needsLink ? readingId : "" },
      });
      setBody("");
      setReadingId("");
      toast.success(`Ticket ${res.ticketNo} is open.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <p className="text-xs tracking-wide text-faint uppercase">
          <Link to="/me" preload={false} className="text-primary">
            Account
          </Link>
          <span className="text-faint"> / Support</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <LifeBuoy className="size-5 text-primary" />
          <h1 className="font-display text-3xl text-fg">Support</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Private help from Ora staff. Advisors cannot see these tickets.
          {unread ? ` ${unread} new ${unread === 1 ? "reply" : "replies"}.` : ""}
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">New ticket</p>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
            >
              {SUPPORT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {needsLink ? (
            <div className="space-y-1.5">
              <Label htmlFor="session">Related session</Label>
              <select
                id="session"
                value={readingId}
                onChange={(e) => setReadingId(e.target.value)}
                className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              >
                <option value="">None / not sure</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.advisorName} · {formatClock(s.seconds)} · {s.status}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              minLength={8}
              required
              placeholder="Tell us what happened."
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Submit ticket
          </Button>
        </form>

        <section className="mt-8">
          <h2 className="font-display text-xl">Your tickets</h2>
          {!tickets.length ? (
            <p className="mt-2 text-sm text-muted">No tickets yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/support/$id"
                    params={{ id: t.id }}
                    className="block rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium tabular-nums">{t.ticketNo}</p>
                      <span className="text-xs text-primary">
                        {t.customerUnread ? "New reply · " : ""}
                        {statusLabel(t.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {t.reasonLabel}
                      {t.advisorName ? ` · ${t.advisorName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-faint">{formatWhen(t.lastMessageAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}

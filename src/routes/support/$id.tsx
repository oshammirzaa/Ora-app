import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatWhen } from "@/lib/ora";
import { getMyTicket, replyMyTicket, statusLabel } from "@/lib/ora-support";

export const Route = createFileRoute("/support/$id")({ component: SupportTicketPage });

function SupportTicketPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyTicket>> | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const next = await getMyTicket({ data: { id } });
    setData(next);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Ticket not found."));
  }, [user, id]);

  if (isPending) {
    return (
      <AppShell tab="you">
        <div className="mx-4 mt-8 h-48 animate-pulse rounded-xl bg-elevated" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const ticket = data?.ticket;
  const closed = ticket?.status === "closed";

  async function reply(e: FormEvent) {
    e.preventDefault();
    if (busy || !ticket) return;
    setBusy(true);
    try {
      await replyMyTicket({ data: { id: ticket.id, body } });
      setBody("");
      toast.success("Reply sent.");
      await load();
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <p className="text-xs tracking-wide text-faint uppercase">
          <Link to="/support" preload={false} className="text-primary">
            Support
          </Link>
          <span className="text-faint"> / Ticket</span>
        </p>
        {err ? <p className="mt-6 text-sm text-danger">{err}</p> : null}
        {!ticket ? (
          err ? null : <div className="mt-6 h-40 animate-pulse rounded-xl bg-elevated" />
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl tabular-nums">{ticket.ticketNo}</h1>
            <p className="mt-1 text-sm text-muted">
              {ticket.reasonLabel} · {statusLabel(ticket.status)}
              {ticket.advisorName ? ` · ${ticket.advisorName}` : ""}
            </p>
            <ul className="mt-6 space-y-3">
              {data?.messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.role === "admin"
                      ? "rounded-xl bg-elevated p-4"
                      : "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                  }
                >
                  <p className="text-xs tracking-wide text-faint uppercase">
                    {m.role === "admin" ? "Ora support" : "You"} · {formatWhen(m.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                </li>
              ))}
            </ul>
            {closed ? (
              <p className="mt-6 text-sm text-muted">This ticket is closed.</p>
            ) : (
              <form onSubmit={(e) => void reply(e)} className="mt-6 space-y-3">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  placeholder="Reply to support"
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  Send reply
                </Button>
              </form>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatClock, formatWhen } from "@/lib/ora";
import {
  adminAddTicketNote,
  adminLinkTicket,
  adminReplyTicket,
  adminSetTicketStatus,
  adminTicket,
  SUPPORT_STATUSES,
  statusLabel,
} from "@/lib/ora-support";

export const Route = createFileRoute("/admin/support/$id")({ component: AdminTicketPage });

function AdminTicketPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminTicket>> | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [readingId, setReadingId] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const next = await adminTicket({ data: { id, t: Date.now() } });
    setData(next);
    setReadingId(next.ticket.readingId);
  }

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Ticket not found."));
  }, [id]);

  const ticket = data?.ticket;

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setBusy("reply");
    try {
      await adminReplyTicket({ data: { id: ticket.id, body: reply } });
      setReply("");
      toast.success("Reply sent to the customer.");
      await load();
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Could not reply");
    } finally {
      setBusy("");
    }
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setBusy("note");
    try {
      await adminAddTicketNote({ data: { id: ticket.id, body: note } });
      setNote("");
      toast.success("Internal note saved.");
      await load();
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Could not save note");
    } finally {
      setBusy("");
    }
  }

  async function setStatus(status: string) {
    if (!ticket) return;
    setBusy("status");
    try {
      await adminSetTicketStatus({ data: { id: ticket.id, status } });
      toast.success("Status updated.");
      await load();
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Could not update");
    } finally {
      setBusy("");
    }
  }

  async function linkSession() {
    if (!ticket) return;
    setBusy("link");
    try {
      await adminLinkTicket({ data: { id: ticket.id, readingId } });
      toast.success("Linked session saved.");
      await load();
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : "Could not link");
    } finally {
      setBusy("");
    }
  }

  if (err) return <p className="text-danger">{err}</p>;
  if (!ticket || !data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <p className="text-xs tracking-wide text-faint uppercase">
        <Link to="/admin/support" className="text-primary">
          Support
        </Link>
        <span className="text-faint"> / {ticket.ticketNo}</span>
      </p>
      <PageHeader
        title={ticket.ticketNo}
        description={`${ticket.reasonLabel} · ${statusLabel(ticket.status)}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <ul className="space-y-3">
            {data.messages.map((m) => (
              <li
                key={m.id}
                className={
                  m.role === "admin"
                    ? "rounded-xl bg-elevated p-4"
                    : "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                }
              >
                <p className="text-xs tracking-wide text-faint uppercase">
                  {m.role === "admin" ? m.author : "Customer"} · {formatWhen(m.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => void sendReply(e)} className="mt-4 space-y-3">
            <Label htmlFor="reply">Reply to customer</Label>
            <Textarea id="reply" value={reply} onChange={(e) => setReply(e.target.value)} required />
            <Button type="submit" disabled={busy === "reply"}>
              Send reply
            </Button>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-wide text-faint uppercase">Customer</p>
            <p className="mt-1 font-medium">{data.customer?.name || "Customer"}</p>
            <p className="text-sm text-muted">{data.customer?.email || "No email"}</p>
            <p className="mt-1 text-xs text-faint">
              {data.customer?.status} · {data.customer?.coins ?? 0}c · promo {data.customer?.bonus} · week{" "}
              {data.customer?.weekly}
            </p>
            {data.customer ? (
              <Link to="/admin/customers" className="mt-2 inline-block text-sm text-primary">
                Open customers
              </Link>
            ) : null}
          </section>

          <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-wide text-faint uppercase">Status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUPPORT_STATUSES.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={ticket.status === s.id ? "default" : "outline"}
                  disabled={busy === "status"}
                  onClick={() => void setStatus(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-wide text-faint uppercase">Linked session</p>
            {data.session ? (
              <p className="mt-2 text-sm">
                {data.session.advisorName} · {data.session.status} · {formatClock(data.session.seconds)} ·{" "}
                {data.session.coinsSpent}c · {data.session.rateCoins}c/min
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">No session linked.</p>
            )}
            <div className="mt-3 space-y-2">
              <select
                value={readingId}
                onChange={(e) => setReadingId(e.target.value)}
                className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg"
              >
                <option value="">None</option>
                {data.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.advisorName} · {s.status}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" disabled={busy === "link"} onClick={() => void linkSession()}>
                Save link
              </Button>
            </div>
          </section>

          <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-wide text-faint uppercase">Internal notes</p>
            <p className="mt-1 text-xs text-muted">Staff only. Never shown to the customer or advisors.</p>
            <ul className="mt-3 space-y-2">
              {!data.notes.length ? <li className="text-sm text-muted">None yet.</li> : null}
              {data.notes.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className="text-xs text-faint">
                    {n.author} · {formatWhen(n.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap">{n.body}</p>
                </li>
              ))}
            </ul>
            <form onSubmit={(e) => void saveNote(e)} className="mt-3 space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} required placeholder="Private note" />
              <Button type="submit" size="sm" variant="outline" disabled={busy === "note"}>
                Add note
              </Button>
            </form>
          </section>

          <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-wide text-faint uppercase">Previous tickets</p>
            <ul className="mt-3 space-y-2">
              {!data.history.length ? <li className="text-sm text-muted">No earlier tickets.</li> : null}
              {data.history.map((t) => (
                <li key={t.id}>
                  <Link to="/admin/support/$id" params={{ id: t.id }} className="text-sm text-primary">
                    {t.ticketNo} · {statusLabel(t.status)} · {t.reasonLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

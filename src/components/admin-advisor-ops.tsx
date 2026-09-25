import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen } from "@/lib/ora";
import {
  adminAdvisorChat,
  adminAdvisorClients,
  adminAdvisorReviews,
  adminDeleteAdvisorReview,
  adminSaveAdvisorReview,
  adminStartViewAs,
} from "@/lib/ora-admin-advisor-ops";
import { adminAdvisorEarningsDetail } from "@/lib/ora-admin-earnings-api";

function usd(cents: number) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export function ViewAsButton({ advisorId, name }: { advisorId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await adminStartViewAs({ data: { advisorId, reason } });
      window.location.href = "/advisor";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this advisor desk.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        View as Advisor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(100%-1.5rem,32rem)] w-[min(100%-1.5rem,28rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View as {name}</DialogTitle>
            <DialogDescription>
              Opens the advisor desk with your admin session. Passwords, payout details, and security settings stay locked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`view-reason-${advisorId}`}>Reason (optional)</Label>
              <Input id={`view-reason-${advisorId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </div>
            <Button disabled={busy} onClick={() => void start()}>
              {busy ? "Opening…" : "Open advisor desk"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AdvisorOpsButtons({ advisorId, name }: { advisorId: string; name: string }) {
  const [which, setWhich] = useState<"" | "chats" | "reviews" | "payout">("");
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setWhich("chats")}>
          Clients & Chats
        </Button>
        <Button size="sm" variant="outline" onClick={() => setWhich("reviews")}>
          Reviews
        </Button>
        <Button size="sm" variant="outline" onClick={() => setWhich("payout")}>
          Payout Information
        </Button>
      </div>
      <Dialog open={which === "chats"} onOpenChange={(open) => { if (!open) setWhich(""); }}>
        {which === "chats" ? <ChatsDialog advisorId={advisorId} name={name} /> : null}
      </Dialog>
      <Dialog open={which === "reviews"} onOpenChange={(open) => { if (!open) setWhich(""); }}>
        {which === "reviews" ? <ReviewsDialog advisorId={advisorId} name={name} /> : null}
      </Dialog>
      <Dialog open={which === "payout"} onOpenChange={(open) => { if (!open) setWhich(""); }}>
        {which === "payout" ? <PayoutDialog advisorId={advisorId} name={name} /> : null}
      </Dialog>
    </>
  );
}

function ChatsDialog({ advisorId, name }: { advisorId: string; name: string }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminAdvisorClients>>["conversations"]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [thread, setThread] = useState<(typeof rows)[number] | null>(null);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof adminAdvisorChat>>["messages"]>([]);
  const [error, setError] = useState("");

  async function load(nextOffset: number, q = query) {
    const data = await adminAdvisorClients({ data: { advisorId, query: q, offset: nextOffset } });
    setRows(nextOffset ? (cur) => [...cur, ...data.conversations] : data.conversations);
    setTotal(data.total);
    setOffset(nextOffset + data.conversations.length);
  }

  useEffect(() => {
    void load(0).catch((e) => setError(e instanceof Error ? e.message : "Could not load chats."));
  }, [advisorId]);

  async function openThread(row: (typeof rows)[number], before = "") {
    setThread(row);
    const data = await adminAdvisorChat({
      data: { advisorId, kind: row.kind, refId: row.refId, before },
    });
    setMessages(before ? (cur) => [...data.messages, ...cur] : data.messages);
  }

  return (
    <DialogContent className="max-h-[min(100%-1.5rem,44rem)] w-[min(100%-1.5rem,40rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Clients & Chats</DialogTitle>
        <DialogDescription>Read-only history for {name}. Opening a chat does not mark it read or change billing.</DialogDescription>
      </DialogHeader>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setThread(null);
          void load(0, query).catch((err) => setError(err instanceof Error ? err.message : "Could not search."));
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client name or client ID" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {thread ? (
        <div className="space-y-2">
          <Button size="sm" variant="outline" onClick={() => setThread(null)}>Back to clients</Button>
          <p className="text-sm text-muted">
            {thread.name} · {thread.clientId} · {thread.kind === "reading" ? "Live reading" : "Message conversation"} · {thread.paid}
          </p>
          {messages[0] ? (
            <Button size="sm" variant="outline" onClick={() => void openThread(thread, messages[0].at)}>
              Load earlier
            </Button>
          ) : null}
          <ul className="space-y-2">
            {messages.map((message) => (
              <li key={message.id} className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]">
                <p className="text-xs text-faint">{message.role === "advisor" ? "Advisor" : "Client"} · {formatWhen(message.at)}</p>
                <p className="mt-1 whitespace-pre-wrap">{message.body || "—"}</p>
              </li>
            ))}
            {!messages.length ? <li className="text-sm text-muted">No messages in this conversation.</li> : null}
          </ul>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="w-full rounded-2xl bg-surface p-3 text-left shadow-[var(--shadow-border)]" onClick={() => void openThread(row)}>
                <span className="font-medium">{row.name}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {row.clientId} · {formatWhen(row.at)} · {row.kind === "reading" ? "Live reading" : "Messages"} · {row.paid}
                </span>
              </button>
            </li>
          ))}
          {!rows.length ? <li className="text-sm text-muted">No client conversations yet.</li> : null}
        </ul>
      )}
      {!thread && offset < total ? (
        <Button variant="outline" onClick={() => void load(offset).catch((e) => setError(e instanceof Error ? e.message : "Could not load more."))}>
          Load more
        </Button>
      ) : null}
    </DialogContent>
  );
}

function ReviewsDialog({ advisorId, name }: { advisorId: string; name: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminAdvisorReviews>>["reviews"]>([]);
  const [editing, setEditing] = useState<string | "new" | "">("");
  const [clientName, setClientName] = useState("");
  const [rating, setRating] = useState("5");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await adminAdvisorReviews({ data: { advisorId } });
    setRows(data.reviews);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load reviews."));
  }, [advisorId]);

  function begin(row?: (typeof rows)[number]) {
    setEditing(row?.id || "new");
    setClientName(row?.clientName || "");
    setRating(String(row?.rating || 5));
    setBody(row?.body || "");
    setError("");
  }

  async function save() {
    try {
      await adminSaveAdvisorReview({
        data: {
          advisorId,
          reviewId: editing === "new" ? "" : editing,
          rating: Number(rating),
          body,
          clientName,
        },
      });
      toast.success(editing === "new" ? "Review added." : "Review updated.");
      setEditing("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this review? The original text stays in the audit log.")) return;
    try {
      await adminDeleteAdvisorReview({ data: { advisorId, reviewId: id } });
      toast.success("Review deleted.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete review.");
    }
  }

  const current = rows.find((row) => row.id === editing);

  return (
    <DialogContent className="max-h-[min(100%-1.5rem,44rem)] w-[min(100%-1.5rem,40rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Reviews</DialogTitle>
        <DialogDescription>Reviews for {name}. Admin edits are logged and do not replace the customer review rules.</DialogDescription>
      </DialogHeader>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rev-name">Customer name</Label>
            <Input id="rev-name" value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={current?.source === "customer"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rev-stars">Star rating</Label>
            <Input id="rev-stars" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rev-body">Written review</Label>
            <Textarea id="rev-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} />
          </div>
          <div className="flex gap-2">
            <Button type="submit">{editing === "new" ? "Add Review" : "Save edit"}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing("")}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" onClick={() => begin()}>Add Review</Button>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]">
            <p className="font-medium">{row.clientName} · {row.rating} stars</p>
            <p className="text-xs text-faint">
              {row.clientId} · {formatWhen(row.at)} · {name}
              {row.readingId ? ` · ${row.readingId}` : ""}
              {row.source === "admin" ? " · Admin-created" : " · Customer review"}
              {row.hidden ? " · Hidden" : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{row.body || "—"}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => begin(row)}>Edit Review</Button>
              <Button size="sm" variant="outline" onClick={() => void remove(row.id)}>Delete Review</Button>
            </div>
          </li>
        ))}
        {!rows.length ? <li className="text-sm text-muted">No reviews yet.</li> : null}
      </ul>
    </DialogContent>
  );
}

function PayoutDialog({ advisorId, name }: { advisorId: string; name: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminAdvisorEarningsDetail>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void adminAdvisorEarningsDetail({ data: { advisorId } })
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load payout information."));
  }, [advisorId]);

  const latest = detail?.payments[0];

  return (
    <DialogContent className="max-h-[min(100%-1.5rem,44rem)] w-[min(100%-1.5rem,40rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Payout Information</DialogTitle>
        <DialogDescription>Existing earnings and payout records for {name}. Splits and balances are not changed here.</DialogDescription>
      </DialogHeader>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!detail && !error ? <div className="h-24 animate-pulse rounded-xl bg-elevated" /> : null}
      {detail ? (
        <div className="space-y-3 text-sm">
          <p>Payout method: {latest?.method || "Not stored"}</p>
          <p>Payout account/name: {detail.advisor.name}</p>
          <p>Payout email: {detail.advisor.email || "Not stored"}</p>
          <p>Payout status: {detail.ready ? "Ready to pay" : detail.unpaidCents > 0 ? "Pending" : "No unpaid balance"}</p>
          <p>Current payable advisor balance: {usd(detail.unpaidCents)}</p>
          <p>Lifetime advisor earnings: {usd(detail.lifetimeCents)}</p>
          <p>Current month earnings: {usd(detail.monthEarningsCents)}</p>
          <p>Amount already paid: {usd(detail.paidCents)}</p>
          <p>Pending payout: {usd(detail.unpaidCents)}</p>
          <p>Last payout date: {detail.lastPaymentAt ? formatWhen(detail.lastPaymentAt) : "—"}</p>
          <p className="font-medium">Payout history</p>
          <ul className="space-y-2">
            {detail.payments.map((payment) => (
              <li key={payment.id} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
                {usd(payment.cents)} · {payment.status} · {payment.method || "method not stored"} · {formatWhen(payment.at)}
                {payment.referenceId ? ` · ${payment.referenceId}` : ""}
              </li>
            ))}
            {!detail.payments.length ? <li className="text-muted">No payout records yet.</li> : null}
          </ul>
        </div>
      ) : null}
    </DialogContent>
  );
}

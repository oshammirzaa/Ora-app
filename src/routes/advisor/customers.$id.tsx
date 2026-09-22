import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, ChevronDown, Flag, MessageSquare, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Initials, ReminderDialog, ReportDialog, StatusPill } from "@/components/advisor-desk";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addAdvisorClientNote,
  advisorClientProfile,
  setAdvisorClientFavorite,
} from "@/lib/ora-advisor-desk";
import {
  formatLastConversation,
  formatLongDate,
  formatReadingMinutes,
  formatUsdFromCoins,
  revenueStatus,
} from "@/lib/ora-advisor-desk-stats";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/customers/$id")({ component: ClientProfilePage });

function ClientProfilePage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorClientProfile>> | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [remind, setRemind] = useState(false);
  const [report, setReport] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    void advisorClientProfile({ data: { customerId: id } })
      .then((next: any) => {
        if (alive) setData(next);
      })
      .catch((e: any) => {
        if (alive) setError(e instanceof Error ? e.message : "Client not found.");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    if (typeof window !== "undefined" && window.location.hash === "#notes") {
      document.getElementById("notes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [data]);

  async function toggleFavorite() {
    if (!data) return;
    const next = !data.favorite;
    try {
      await setAdvisorClientFavorite({ data: { customerId: data.id, favorite: next } });
      setData({ ...data, favorite: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  }

  async function saveNote() {
    if (!data) return;
    const body = draft.trim();
    if (!body) {
      toast.error("Write a note.");
      return;
    }
    setSaving(true);
    try {
      const res = await addAdvisorClientNote({ data: { customerId: data.id, body } });
      toast.success("Note saved. Only you can see it.");
      setDraft("");
      setData({
        ...data,
        notes: res.note ? [res.note, ...data.notes] : data.notes,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <main className="space-y-4">
        <BackLink />
        <EmptyState title="Client not found" body="This profile is only for people who have already sat with you." />
      </main>
    );
  }

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main className="space-y-4" data-client-profile={data.id}>
      <BackLink />

      <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-4">
          <Initials name={data.name} photo={data.photoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <ClientNameWithBadge
                as="h1"
                name={data.name}
                tier={data.loyaltyTier}
                className="min-w-0 font-display text-2xl"
                nameClassName="font-display text-2xl text-fg"
              />
              <button
                type="button"
                aria-label={data.favorite ? "Remove favorite" : "Favorite client"}
                onClick={() => void toggleFavorite()}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-gold"
              >
                <Star className={data.favorite ? "size-5 fill-gold" : "size-5"} />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.frequent ? <StatusPill tone="ok">Frequent</StatusPill> : data.repeat ? <StatusPill tone="ok">Returning</StatusPill> : <StatusPill tone="muted">First time</StatusPill>}
              {data.favoritedYou ? <StatusPill tone="ok">Favorited you</StatusPill> : null}
              {data.live ? <StatusPill tone="warn">Live</StatusPill> : null}
            </div>
            {data.birthDateLabel ? (
              <p className="mt-3 text-sm" data-client-dob={data.dateOfBirth}>
                <span className="text-faint">Date of Birth: </span>
                <span className="text-fg">{data.birthDateLabel}</span>
              </p>
            ) : null}
            {data.genderLabel ? (
              <p className="mt-1 text-sm" data-client-gender={data.gender}>
                <span className="text-faint">Gender: </span>
                <span className="text-fg">{data.genderLabel}</span>
              </p>
            ) : null}
            <p className="mt-1 text-sm">
              <span className="text-faint">Client since: </span>
              <span className="text-fg">{formatLongDate(data.clientSince) || "—"}</span>
            </p>
            <p className="mt-1 text-sm">
              <span className="text-faint">Last conversation: </span>
              <span className="text-fg">{formatLastConversation(data.lastAt) || "—"}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2" aria-label="Session totals with you">
        <Stat label="Charged with you" value={formatUsdFromCoins(data.charged)} />
        <Stat label="Paid minutes" value={formatReadingMinutes(data.paidSeconds)} />
        <Stat label="Readings" value={String(data.readings)} />
        <Stat label="Average time" value={data.readings ? formatReadingMinutes(data.avgSeconds) : "—"} />
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
        >
          <h2 className="font-display text-lg">History of conversations</h2>
          <ChevronDown className={`size-4 text-faint transition ${historyOpen ? "rotate-180" : ""}`} />
        </button>
        {historyOpen ? (
          data.history.length ? (
            <ul className="mt-3 space-y-2">
              {data.history.map((row: any) => (
                <li key={row.id}>
                  <Link
                    to="/advisor/session/$id"
                    params={{ id: row.id }}
                    preload={false}
                    className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-fg">{revenueStatus(row.status)}</p>
                      <p className="text-xs text-faint">
                        {formatWhen(row.startedAt) || "—"} · {formatDuration(row.seconds)}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-primary">{formatUsdFromCoins(row.coinsSpent)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No sittings recorded with you yet.</p>
          )
        ) : null}
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setRemind(true)}>
          Set follow-up reminder
        </Button>
      </section>

      <section id="notes" className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg">Notes</h2>
        <p className="mt-0.5 text-xs text-faint">Never shown to the client.</p>
        <Textarea
          className="mt-3"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note about this client..."
          aria-label="Private client note"
        />
        <Button className="mt-3 w-full" disabled={saving} onClick={() => void saveNote()}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {data.notes.length ? (
          <ul className="mt-4 space-y-3">
            {data.notes.map((note: any) => (
              <li key={note.id} className="rounded-xl bg-elevated px-3 py-3" data-client-note={note.id}>
                <p className="text-sm text-fg">{note.body}</p>
                <p className="mt-1 text-xs text-faint">{formatWhen(note.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No private notes yet.</p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/advisor/inbox" search={{ client: data.id }} preload={false}>
            <MessageSquare className="size-4" />
            Message
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRemind(true)}>
          <Bell className="size-4" />
          Set follow-up reminder
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReport(true)}>
          <Flag className="size-4" />
          Report
        </Button>
      </div>

      <ReminderDialog open={remind} name={data.name} customerId={data.id} onOpenChange={setRemind} />
      <ReportDialog open={report} name={data.name} customerId={data.id} onOpenChange={setReport} />
    </main>
  );
}

function BackLink() {
  return (
    <Link to="/advisor/customers" preload={false} className="inline-flex items-center gap-1 text-sm text-primary">
      <ArrowLeft className="size-4" />
      Clients
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
      <p className="text-[11px] tracking-wide text-faint uppercase">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums text-fg">{value}</p>
    </div>
  );
}

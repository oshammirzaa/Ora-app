import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare, NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeskSearch, EmptyState, FilterChips, Initials, StatusPill } from "@/components/advisor-desk";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { advisorClientList, saveAdvisorClientNote } from "@/lib/ora-advisor-desk";
import { formatUsdFromCoins, matchesClientKind, type ClientKindFilter } from "@/lib/ora-advisor-desk-stats";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/customers")({ component: ClientsPage });

function ClientsPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<ClientKindFilter>("all");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorClientList>> | null>(null);
  const [noteFor, setNoteFor] = useState<{ id: string; name: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void advisorClientList({ data: { q: "" } })
      .then(setData)
      .catch(() => setData({ clients: [] }));
  }, []);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.clients.filter((c) => {
      if (!matchesClientKind(c.repeat, kind)) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle) || c.note.toLowerCase().includes(needle);
    });
  }, [data, q, kind]);

  async function saveNote() {
    if (!noteFor) return;
    setSaving(true);
    try {
      await saveAdvisorClientNote({ data: { customerId: noteFor.id, body: noteFor.body } });
      toast.success("Note saved. Only you can see it.");
      setData((cur) =>
        cur
          ? { clients: cur.clients.map((c) => (c.id === noteFor.id ? { ...c, note: noteFor.body } : c)) }
          : cur,
      );
      setNoteFor(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main className="space-y-4">
      <DeskSearch value={q} onChange={setQ} placeholder="Search clients or notes" />
      <FilterChips
        value={kind}
        onChange={setKind}
        options={[
          { id: "all", label: "All" },
          { id: "repeat", label: "Repeat" },
          { id: "first", label: "First time" },
        ]}
      />
      {!data.clients.length ? (
        <EmptyState title="No clients yet" body="People who finish a live text reading with you will appear here." />
      ) : !visible.length ? (
        <EmptyState title="No matches" body="Try another name, note, or filter." />
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (
            <li key={c.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start gap-3">
                <Initials name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.repeat ? <StatusPill tone="ok">Repeat</StatusPill> : <StatusPill tone="muted">First time</StatusPill>}
                    {c.live ? <StatusPill tone="warn">Live</StatusPill> : null}
                  </div>
                  <p className="mt-1 text-xs text-faint">
                    Active {c.lastAt ? formatWhen(c.lastAt) : "—"} · {c.readings} readings · {formatDuration(c.seconds)}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Charged" value={formatUsdFromCoins(c.charged)} />
                    <Mini label="Your 20%" value={formatUsdFromCoins(c.advisorShare)} />
                    <Mini label="Ora 80%" value={formatUsdFromCoins(c.oraShare)} />
                  </div>
                  {c.note ? <p className="mt-2 line-clamp-2 text-xs text-muted">{c.note}</p> : null}
                  <div className="mt-3 flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link to="/advisor/inbox" search={{ client: c.id }} preload={false}>
                        <MessageSquare className="size-4" />
                        Message
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setNoteFor({ id: c.id, name: c.name, body: c.note })}
                    >
                      <NotebookPen className="size-4" />
                      Notes
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(noteFor)} onOpenChange={(open) => !open && setNoteFor(null)}>
        <DialogContent>
          <DialogTitle>Private note · {noteFor?.name}</DialogTitle>
          <p className="text-xs text-faint">Never shown to the client.</p>
          <Textarea
            className="mt-3"
            value={noteFor?.body ?? ""}
            onChange={(e) => setNoteFor((cur) => (cur ? { ...cur, body: e.target.value } : cur))}
          />
          <Button className="mt-3 w-full" disabled={saving} onClick={() => void saveNote()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-elevated px-2 py-2">
      <p className="text-xs tracking-wide text-faint uppercase">{label}</p>
      <p className="mt-0.5 text-sm tabular-nums text-fg">{value}</p>
    </div>
  );
}

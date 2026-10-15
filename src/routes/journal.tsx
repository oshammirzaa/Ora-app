import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { deleteJournal, listJournal, saveJournal } from "@/lib/ora-advanced-api";

export const Route = createFileRoute("/journal")({ component: JournalPage });

type Entry = Awaited<ReturnType<typeof listJournal>>["entries"][number];
const MOODS = ["", "Calm", "Hopeful", "Uneasy", "Grateful", "Unclear"];

function JournalPage() {
  const { user, isPending } = useCurrentUserState();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [readings, setReadings] = useState<Awaited<ReturnType<typeof listJournal>>["readings"]>([]);
  const [current, setCurrent] = useState<Entry | null>(null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const data = await listJournal();
    setEntries(data.entries);
    setReadings(data.readings);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not open your journal"));
  }, [user]);

  useEffect(() => {
    if (!current || !user || current.title === "Locked entry") return;
    const handle = window.setTimeout(() => {
      setStatus("Saving…");
      void saveJournal({
        data: {
          id: current.id.startsWith("new") ? "" : current.id,
          title: current.title,
          body: current.body,
          mood: current.mood,
          goal: current.goal,
          date: current.date,
          readingId: current.readingId,
        },
      })
        .then(async (saved) => {
          if (current.id.startsWith("new")) setCurrent({ ...current, id: saved.id });
          setStatus("Saved");
          const data = await listJournal();
          setEntries(data.entries);
        })
        .catch(() => setStatus("Not saved"));
    }, 800);
    return () => window.clearTimeout(handle);
  }, [current, user]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (from && entry.date < from) return false;
      if (to && entry.date > to) return false;
      if (!q) return true;
      return `${entry.title} ${entry.body} ${entry.goal} ${entry.mood}`.toLowerCase().includes(q);
    });
  }, [entries, query, from, to]);

  if (isPending) return <AppShell tab="you"><div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" /></AppShell>;
  if (!user) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">My Journal</h1>
          <p className="mt-1 text-sm text-muted">Private notes only you can open. Sign in to write.</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/login">Sign in</Link></Button>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" className="text-sm text-primary">Account</Link>
        <h1 className="mt-2 font-display text-3xl text-fg">My Journal</h1>
        <p className="mt-1 text-sm text-muted">Only you can read these notes. Advisors and staff cannot open them. They are removed if you delete your account.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" className="rounded-full" onClick={() => setCurrent({ id: `new-${Date.now()}`, title: "", body: "", mood: "", goal: "", date: new Date().toISOString().slice(0, 10), readingId: "", updatedAt: "" })}>New entry</Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => {
            const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "ora-journal.json";
            link.click();
            URL.revokeObjectURL(url);
          }}>Export</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search journal" />
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
        </div>
        {current ? (
          <form className="mt-4 space-y-2 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]" onSubmit={(event) => event.preventDefault()}>
            <p className="text-xs text-faint">{status || "Autosave is on."}</p>
            <Input value={current.title} onChange={(event) => setCurrent({ ...current, title: event.target.value })} placeholder="Title" aria-label="Title" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={current.date} onChange={(event) => setCurrent({ ...current, date: event.target.value })} aria-label="Entry date" />
              <select value={current.mood} onChange={(event) => setCurrent({ ...current, mood: event.target.value })} className="h-11 rounded-md bg-elevated px-3 text-sm" aria-label="Mood">
                {MOODS.map((mood) => <option key={mood || "none"} value={mood}>{mood || "Mood"}</option>)}
              </select>
            </div>
            <Textarea value={current.body} onChange={(event) => setCurrent({ ...current, body: event.target.value })} rows={6} placeholder="Private notes" />
            <Input value={current.goal} onChange={(event) => setCurrent({ ...current, goal: event.target.value })} placeholder="A private goal or reflection" aria-label="Goal" />
            <select value={current.readingId} onChange={(event) => setCurrent({ ...current, readingId: event.target.value })} className="h-11 w-full rounded-md bg-elevated px-3 text-sm" aria-label="Linked reading">
              <option value="">No linked reading</option>
              {readings.map((reading) => <option key={reading.id} value={reading.id}>{reading.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setCurrent(null)}>Close</Button>
              {!current.id.startsWith("new") ? (
                <Button type="button" variant="outline" onClick={() => void deleteJournal({ data: { id: current.id } }).then(() => { setCurrent(null); return load(); }).then(() => toast.success("Entry deleted."))}>Delete</Button>
              ) : null}
            </div>
          </form>
        ) : null}
        <ul className="mt-4 space-y-2">
          {visible.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="w-full rounded-xl bg-surface p-4 text-left shadow-[var(--shadow-border)]" onClick={() => setCurrent(entry)}>
                <p className="text-sm text-fg">{entry.title || "Untitled"}</p>
                <p className="text-xs text-faint">{entry.date}{entry.mood ? ` · ${entry.mood}` : ""}</p>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

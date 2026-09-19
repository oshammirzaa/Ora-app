import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/advisor-desk";
import { advisorClientList } from "@/lib/ora-advisor-desk";

export const Route = createFileRoute("/advisor/notes")({ component: NotesPage });

function NotesPage() {
  const [notes, setNotes] = useState<Array<{ id: string; name: string; note: string }>>([]);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    void advisorClientList({ data: { q: "" } })
      .then((d) => setNotes(d.clients.filter((c) => c.note).map((c) => ({ id: c.id, name: c.name, note: c.note }))))
      .catch(() => setNotes([]))
      .finally(() => setLoad(false));
  }, []);

  if (load) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <h1 className="font-display text-3xl">Private notes</h1>
      <p className="mt-1 text-sm text-muted">Only you can see these. Open Clients to add or edit a note.</p>
      {!notes.length ? (
        <div className="mt-4">
          <EmptyState title="No notes yet" body="Save a private note from a client card. Customers never see this." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="font-medium">{n.name}</p>
              <p className="mt-1 text-sm text-muted">{n.note}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

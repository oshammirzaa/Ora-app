import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdvisorPageHeader } from "@/components/advisor-shell";
import { EmptyState, StatusPill } from "@/components/advisor-desk";
import { Button } from "@/components/ui/button";
import { completeAdvisorReminder, listAdvisorReminders } from "@/lib/ora-advisor-desk";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/todo")({ component: TodoPage });

function TodoPage() {
  const [reminders, setReminders] = useState<Awaited<ReturnType<typeof listAdvisorReminders>>["reminders"]>([]);
  const [working, setWorking] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    return listAdvisorReminders()
      .then((d) => setReminders(d.reminders))
      .catch(() => setReminders([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function done(id: string) {
    if (working) return;
    setWorking(id);
    try {
      await completeAdvisorReminder({ data: { id } });
      toast.success("Reminder completed.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete reminder");
    } finally {
      setWorking("");
    }
  }

  if (!loaded) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <AdvisorPageHeader
        title="Things To Do"
        description="Private follow-up reminders. Clients never see these."
      />
      {!reminders.length ? (
        <EmptyState
          title="Nothing waiting"
          body="Set a follow-up from a client or inbox thread. Due items will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {reminders.map((item) => (
            <li key={item.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.due ? "Due" : "Scheduled"} {formatWhen(item.dueAt)}
                  </p>
                  {item.note ? <p className="mt-2 text-sm text-fg">{item.note}</p> : null}
                </div>
                <StatusPill tone={item.due ? "warn" : "muted"}>{item.due ? "Due" : "Later"}</StatusPill>
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/advisor/inbox" search={{ client: item.customerId }} preload={false}>
                    Message
                  </Link>
                </Button>
                <Button size="sm" className="flex-1" disabled={working === item.id} onClick={() => void done(item.id)}>
                  {working === item.id ? "Saving…" : "Done"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdvisorPageHeader } from "@/components/advisor-shell";
import { EmptyState, Initials, ReminderDialog, StatusPill } from "@/components/advisor-desk";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import {
  completeAdvisorReminder,
  deleteAdvisorReminder,
  listAdvisorReminders,
  snoozeAdvisorReminder,
} from "@/lib/ora-advisor-desk";
import { groupAdvisorReminders, type ReminderBucket, type AdvisorReminderRow } from "@/lib/ora-advisor-desk-stats";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/todo")({ component: FollowUpsPage });

const SECTIONS: Array<{ id: ReminderBucket; title: string; empty: string; tone: "warn" | "ok" | "muted" }> = [
  { id: "due", title: "Due", empty: "Nothing due.", tone: "warn" },
  { id: "upcoming", title: "Upcoming", empty: "No upcoming follow-ups.", tone: "ok" },
  { id: "completed", title: "Completed", empty: "No completed follow-ups yet.", tone: "muted" },
];

function FollowUpsPage() {
  const [reminders, setReminders] = useState<AdvisorReminderRow[]>([]);
  const [working, setWorking] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<(typeof reminders)[number] | null>(null);

  const load = useCallback(() => {
    return listAdvisorReminders()
      .then((d) => setReminders(d.reminders as AdvisorReminderRow[]))
      .catch(() => setReminders([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupAdvisorReminders(reminders), [reminders]);

  async function snooze(id: string, preset: string) {
    if (working) return;
    setWorking(id);
    try {
      await snoozeAdvisorReminder({ data: { id, preset } });
      toast.success("Reminder snoozed. The client was not messaged.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not snooze reminder");
    } finally {
      setWorking("");
    }
  }

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

  async function remove(id: string) {
    if (working) return;
    setWorking(id);
    try {
      await deleteAdvisorReminder({ data: { id } });
      toast.success("Reminder cancelled.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel reminder");
    } finally {
      setWorking("");
    }
  }

  if (!loaded) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <AdvisorPageHeader
        title="Follow-ups"
        description="Private reminders for clients you have already read with. Clients never see these."
      />
      <div className="mb-4 grid grid-cols-3 gap-2">
        {SECTIONS.map((section) => (
          <div key={section.id} className="rounded-2xl bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
            <p className="text-[10px] tracking-[0.14em] text-faint uppercase">{section.title}</p>
            <p className="mt-1 font-display text-2xl tabular-nums">{groups[section.id].length}</p>
          </div>
        ))}
      </div>
      {!reminders.length ? (
        <EmptyState
          title="Nothing waiting"
          body="Set a follow-up from a client profile, client list, or a completed reading."
        />
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-lg">{section.title}</h2>
                <StatusPill tone={section.tone}>{groups[section.id].length}</StatusPill>
              </div>
              {!groups[section.id].length ? (
                <p className="text-sm text-muted">{section.empty}</p>
              ) : (
                <ul className="space-y-2">
                  {groups[section.id].map((item) => (
                    <li key={item.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          <Initials name={item.name} photo={item.photoUrl} />
                          <div className="min-w-0">
                            <ClientNameWithBadge
                              name={item.name}
                              tier={item.loyaltyTier}
                              className="font-medium"
                              nameClassName="font-medium text-fg"
                            />
                            <p className="mt-0.5 text-xs text-muted">{formatWhen(item.dueAt)}</p>
                            {item.note ? <p className="mt-2 text-sm text-fg">{item.note}</p> : null}
                          </div>
                        </div>
                        <StatusPill tone={section.tone}>{section.title}</StatusPill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to="/advisor/customers/$id" params={{ id: item.customerId }} preload={false}>
                            View client
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to="/advisor/inbox" search={{ client: item.customerId }} preload={false}>
                            Message client
                          </Link>
                        </Button>
                        {section.id !== "completed" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              disabled={working === item.id}
                              onClick={() => setEditing(item)}
                            >
                              Edit
                            </Button>
                            {section.id === "due" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                disabled={working === item.id}
                                onClick={() => void snooze(item.id, "1hour")}
                              >
                                Snooze 1 hour
                              </Button>
                            ) : null}
                            <Button size="sm" className="flex-1" disabled={working === item.id} onClick={() => void done(item.id)}>
                              {working === item.id ? "Saving…" : "Done"}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={working === item.id}
                          onClick={() => void remove(item.id)}
                        >
                          {section.id === "completed" ? "Delete" : "Cancel"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      <ReminderDialog
        open={Boolean(editing)}
        name={editing?.name || ""}
        customerId={editing?.customerId || ""}
        reminder={editing ? { id: editing.id, dueAt: editing.dueAt, note: editing.note } : null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => void load()}
      />
    </main>
  );
}

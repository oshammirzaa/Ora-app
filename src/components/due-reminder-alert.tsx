import { useEffect, useRef, useState } from "react";
import { Initials } from "@/components/advisor-desk";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWhen } from "@/lib/ora";
import {
  SNOOZE_PRESETS,
  reminderLocalParts,
  shouldBrowserNotifyReminder,
  type AdvisorReminderRow,
  type SnoozePresetId,
} from "@/lib/ora-advisor-desk-stats";
import { cn } from "@/lib/utils";

function maybeBrowserNotify(row: AdvisorReminderRow) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!shouldBrowserNotifyReminder(row)) return;
  try {
    const note = String(row.note || "").trim();
    new Notification(`Ora follow-up · ${row.name || "Client"}`, {
      body: note || "A private follow-up is due.",
      tag: `ora-reminder-${row.id}`,
      silent: false,
    });
  } catch {
    /* browser notifications are best-effort */
  }
}

export function DueReminderAlert({
  reminder,
  busy,
  onView,
  onMessage,
  onSnooze,
  onDone,
}: {
  reminder: AdvisorReminderRow | null;
  busy?: boolean;
  onView?: (id: string) => void;
  onMessage: (id: string) => void;
  onSnooze: (id: string, preset: SnoozePresetId, date?: string, time?: string) => void;
  onDone: (id: string) => void;
}) {
  const [preset, setPreset] = useState<SnoozePresetId>("1hour");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const notified = useRef("");

  useEffect(() => {
    if (!reminder?.id) {
      notified.current = "";
      return;
    }
    const parts = reminderLocalParts(new Date(Date.now() + 60 * 60 * 1000));
    setPreset("1hour");
    setDate(parts.date);
    setTime(parts.time);
    if (notified.current === reminder.id) return;
    notified.current = reminder.id;
    maybeBrowserNotify(reminder);
  }, [reminder?.id]);

  if (!reminder) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-blush/70 p-3 backdrop-blur-md sm:items-center sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ora-due-reminder-title"
    >
      <div className="flex max-h-[min(92dvh,38rem)] w-full max-w-md flex-col overflow-y-auto rounded-[1.75rem] bg-surface px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border-hover)]">
        <p className="text-center text-[11px] font-medium tracking-[0.18em] text-gold uppercase">Follow-up due</p>
        <div className="mt-4 flex flex-col items-center text-center">
          <span className="rounded-full bg-lotus/40 p-1.5 ring-4 ring-gold/25">
            <Initials name={reminder.name} photo={reminder.photoUrl} size="lg" />
          </span>
          <h2 id="ora-due-reminder-title" className="mt-3">
            <ClientNameWithBadge
              name={reminder.name || "Client"}
              tier={reminder.loyaltyTier}
              className="justify-center font-display text-2xl tracking-tight"
              nameClassName="font-display text-2xl text-primary"
            />
          </h2>
          <p className="mt-1 text-xs text-muted">Due {formatWhen(reminder.dueAt)}</p>
        </div>
        {reminder.note ? (
          <p className="mt-4 rounded-2xl bg-blush/70 px-3 py-3 text-sm leading-relaxed text-fg">{reminder.note}</p>
        ) : (
          <p className="mt-4 text-center text-sm text-muted">Private reminder. The client is not notified.</p>
        )}
        <div className="mt-5">
          <Button size="lg" className="h-12 w-full rounded-full" disabled={busy} onClick={() => onMessage(reminder.id)}>
            Open Chat
          </Button>
        </div>
        <p className="mt-4 text-[10px] tracking-[0.14em] text-faint uppercase">Snooze</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SNOOZE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full px-3 text-sm",
                preset === item.id ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onSnooze(reminder.id, preset, preset === "custom" ? date : "", preset === "custom" ? time : "")}
          >
            Snooze
          </Button>
          <Button disabled={busy} onClick={() => onDone(reminder.id)}>
            Mark Done
          </Button>
        </div>
      </div>
    </div>
  );
}

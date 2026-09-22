import { Link } from "@tanstack/react-router";
import { ChevronRight, Search, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DeskRequest } from "@/lib/ora";
import { formatWhen } from "@/lib/ora";
import { reportAdvisorClient, saveAdvisorReminder } from "@/lib/ora-advisor-desk";
import {
  ADVISOR_REPORT_REASONS,
  REMINDER_NOTE_MAX,
  REMINDER_PRESETS,
  remainingDailyClientMessages,
  formatAdvisorMinuteRate,
  formatWait,
  incomingClientInfoView,
  reminderDueAt,
  reminderLocalParts,
  waitingSeconds,
  walletBillingLabel,
  type AdvisorReportKind,
  type AdvisorReportReason,
  type ReminderPresetId,
  type WalletBillingKind,
} from "@/lib/ora-advisor-desk-stats";
import { cn } from "@/lib/utils";

export function DeskSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-lg bg-surface pl-10"
        aria-label={placeholder}
      />
    </label>
  );
}

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
      {options.map((opt) => {
        const on = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm",
              on ? "bg-primary text-primary-fg" : "bg-surface text-muted shadow-[var(--shadow-border)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "muted" && "bg-elevated text-muted",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "ok" && "bg-ok",
          tone === "warn" && "bg-warn",
          tone === "danger" && "bg-danger",
          tone === "muted" && "bg-faint",
        )}
      />
      {children}
    </span>
  );
}

export function orderTone(status: string): "ok" | "warn" | "danger" | "muted" {
  if (status === "completed") return "ok";
  if (status === "progress" || status === "pending") return "warn";
  if (status === "cancelled") return "danger";
  return "muted";
}

export function Initials({ name, photo, size = "md" }: { name: string; photo?: string; size?: "sm" | "md" | "lg" }) {
  const initial = (name || "C").trim().slice(0, 1).toUpperCase();
  const dim = size === "lg" ? "size-16" : size === "sm" ? "size-10" : "size-12";
  if (photo) {
    return <img src={photo} alt="" className={cn(dim, "rounded-full object-cover")} />;
  }
  return (
    <span className={cn(dim, "inline-flex items-center justify-center rounded-full bg-blush font-display text-primary")}>
      {initial}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "primary" | "blush" | "gold" | "ok" | "lotus" | "warn";
}) {
  const well =
    tone === "ok"
      ? "bg-ok/12 text-ok"
      : tone === "gold"
        ? "bg-gold/15 text-gold"
        : tone === "warn"
          ? "bg-warn/15 text-warn"
          : tone === "lotus"
            ? "bg-lotus/30 text-primary"
            : tone === "blush"
              ? "bg-blush text-primary"
              : "bg-primary/12 text-primary";
  const card =
    tone === "ok"
      ? "bg-[#f3faf5]"
      : tone === "gold"
        ? "bg-[#fbf6ee]"
        : tone === "warn"
          ? "bg-[#fbf6ee]"
          : tone === "lotus"
            ? "bg-[#f7f1f6]"
            : tone === "blush"
              ? "bg-[#fbf4f7]"
              : "bg-[#f6f2f7]";
  return (
    <div className={cn("rounded-2xl p-3.5 shadow-[var(--shadow-border)]", card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[11px] leading-tight tracking-wide text-faint uppercase">{label}</p>
        {Icon ? (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", well)}>
            <Icon className="size-3.5" strokeWidth={1.8} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-2xl tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-border)]">
      <p className="font-display text-xl">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

export function DeskLinkRow({
  to,
  label,
  hint,
}: {
  to: string;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      to={to as "/advisor/settings"}
      preload={false}
      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
    >
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-faint">{hint}</span> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

export function ToggleRow({
  label,
  hint,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  hint?: string;
  on: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm text-fg">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-faint">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onToggle(!on)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-150 ease-[var(--ease-out)]",
          on ? "bg-ok" : "bg-elevated shadow-[var(--shadow-border)]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-6 rounded-full bg-surface shadow-[var(--shadow-border)] transition-transform duration-150 ease-[var(--ease-out)]",
            on ? "translate-x-7" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

export function DeskLink({
  to,
  children,
}: {
  to: "/advisor/earnings" | "/advisor/activity" | "/advisor/notes" | "/advisor/settings" | "/advisor/profile" | "/advisor";
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      preload={false}
      className="flex min-h-11 items-center justify-between rounded-2xl bg-surface px-4 text-sm shadow-[var(--shadow-border)]"
    >
      {children}
    </Link>
  );
}

export function MessageQuota({ sent, limit, compact }: { sent: number; limit: number; compact?: boolean }) {
  const used = Math.max(0, Math.floor(Number(sent) || 0));
  const cap = Math.max(0, Math.floor(Number(limit) || 0));
  const remaining = remainingDailyClientMessages(used, cap);
  if (compact) {
    return (
      <p className="text-[11px] leading-tight text-muted">
        <span className="tracking-[0.12em] text-faint uppercase">Daily Messages</span>
        <span className="mt-0.5 block tabular-nums text-fg">
          {used} / {cap} used · {remaining} remaining
        </span>
      </p>
    );
  }
  return (
    <div className="rounded-2xl bg-blush/70 px-3 py-2.5">
      <p className="text-[10px] tracking-[0.14em] text-faint uppercase">Daily Messages</p>
      <p className="mt-0.5 text-sm text-fg">
        <span className="font-medium tabular-nums">{used} / {cap}</span> used
      </p>
      <p className="text-xs text-muted tabular-nums">{remaining} remaining</p>
    </div>
  );
}

export function IncomingRequestCard({
  request,
  working,
  onAccept,
  onDecline,
}: {
  request: DeskRequest;
  working?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const wait = formatWait(
    request.createdAt ? waitingSeconds(request.createdAt, now) : Number(request.waitingSeconds) || 0,
  );
  const billing = walletBillingLabel((request.billingKind as WalletBillingKind) || "none");
  const info = incomingClientInfoView(request);
  return (
    <div className="rounded-2xl bg-blush p-4 shadow-[var(--shadow-border)]">
      <p className="inline-flex items-center gap-1.5 text-xs tracking-wide text-primary uppercase">
        <span className="size-2 animate-pulse rounded-full bg-gold" />
        Incoming chat
      </p>
      <div className="mt-1">
        <ClientNameWithBadge
          name={request.clientName}
          tier={request.loyaltyTier}
          className="font-display text-lg"
          nameClassName="font-display text-lg text-primary"
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {request.service || "Live text chat"} · {formatAdvisorMinuteRate(Number(request.rateCoins) || 0)} · Waiting {wait}
      </p>
      <p className="text-xs text-fg">
        {info.label}
        {info.showHistory
          ? ` · ${info.previousReadings} completed · ${info.lastReadingAt ? formatWhen(info.lastReadingAt) : "last sitting on file"}`
          : " · First sitting with you"}
        {info.favorited ? " · Favorited you" : ""}
      </p>
      <p className="text-xs text-faint">{billing}. Billing starts when you accept.</p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={working} onClick={onAccept}>
          Accept
        </Button>
        <Button variant="outline" className="flex-1" disabled={working} onClick={onDecline}>
          Decline
        </Button>
      </div>
    </div>
  );
}

export { availabilityLabel } from "@/lib/ora-advisor-desk-stats";

export function ReminderDialog({
  open,
  name,
  customerId,
  reminder,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  name: string;
  customerId: string;
  reminder?: { id: string; dueAt?: string; note?: string } | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [preset, setPreset] = useState<ReminderPresetId>("tomorrow");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(reminder?.id);

  useEffect(() => {
    if (!open) return;
    if (reminder?.id) {
      const parts = reminderLocalParts(reminder.dueAt);
      setPreset("custom");
      setDate(parts.date);
      setTime(parts.time);
      setNote(reminder.note || "");
      return;
    }
    const due = reminderDueAt("tomorrow");
    const parts = reminderLocalParts(due);
    setPreset("tomorrow");
    setDate(parts.date);
    setTime(parts.time);
    setNote("");
  }, [open, customerId, reminder?.id, reminder?.dueAt, reminder?.note]);

  function applyPreset(id: ReminderPresetId) {
    setPreset(id);
    if (id === "custom") return;
    const due = reminderDueAt(id);
    const parts = reminderLocalParts(due);
    setDate(parts.date);
    setTime(parts.time);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await saveAdvisorReminder({
        data: { id: reminder?.id || "", customerId, preset, date, time, note },
      });
      toast.success(editing ? "Reminder updated. Only you can see it." : "Reminder saved. Only you can see it.");
      setNote("");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save reminder");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          {editing ? "Edit follow-up reminder" : "Set follow-up reminder"} · {name}
        </DialogTitle>
        <p className="text-xs text-faint">Private to you. The client will not see this reminder.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {REMINDER_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 text-sm",
                preset === item.id ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-xs tracking-wide text-faint uppercase">
            Date
            <Input type="date" className="mt-1" value={date} onChange={(e) => { setDate(e.target.value); setPreset("custom"); }} />
          </label>
          <label className="block text-xs tracking-wide text-faint uppercase">
            Time
            <Input type="time" className="mt-1" value={time} onChange={(e) => { setTime(e.target.value); setPreset("custom"); }} />
          </label>
        </div>
        <Textarea
          className="mt-3"
          value={note}
          maxLength={REMINDER_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional private note — check in with this client about her relationship situation"
        />
        <Button className="mt-3 w-full" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : editing ? "Save changes" : "Save reminder"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({
  open,
  name,
  customerId,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  customerId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<AdvisorReportKind>("report");
  const [reason, setReason] = useState<AdvisorReportReason>("abuse");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await reportAdvisorClient({ data: { customerId, kind, reason, body } });
      toast.success(kind === "escalate" ? "Escalated to Ora admin." : "Report sent to Ora admin.");
      setBody("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          {kind === "escalate" ? "Escalate" : "Report"} · {name}
        </DialogTitle>
        <p className="text-xs text-faint">Internal only. The client will not see this report.</p>
        <div className="mt-3 flex gap-2">
          {(["report", "escalate"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm capitalize",
                kind === id ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
              )}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ADVISOR_REPORT_REASONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setReason(item.id)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3 text-sm",
                reason === item.id ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Textarea
          className="mt-3"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe what happened"
        />
        <Button className="mt-3 w-full" disabled={saving || body.trim().length < 8} onClick={() => void save()}>
          {saving ? "Sending…" : kind === "escalate" ? "Escalate to admin" : "Send report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

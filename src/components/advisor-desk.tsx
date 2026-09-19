import { Link } from "@tanstack/react-router";
import { ChevronRight, Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
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
    <div className={cn("rounded-2xl p-4 shadow-[var(--shadow-border)]", card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs tracking-wide text-faint uppercase">{label}</p>
        {Icon ? (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", well)}>
            <Icon className="size-4" strokeWidth={1.8} />
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

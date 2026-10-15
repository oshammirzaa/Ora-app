import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import type { ReactNode } from "react";
import { PREMIUM_NOTE } from "@/lib/ora-premium-rules";

export function PremiumCrown({ className = "size-4" }: { className?: string }) {
  return <Crown className={className} strokeWidth={1.7} aria-hidden />;
}

export function PremiumLock({ plan }: { plan: string }) {
  const mini = plan === "mini";
  return (
    <section className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)]">
      <div className="bg-gradient-to-br from-[#3d2a44] via-[#6d3d78] to-[#c4a35a] px-5 py-6 text-[#fbf6ea]">
        <p className="inline-flex items-center gap-2 text-[11px] tracking-[0.16em] uppercase">
          <PremiumCrown className="size-3.5 text-[#f3e2b0]" />
          Ora Membership
        </p>
        <h2 className="mt-2 font-display text-3xl">{mini ? "Upgrade to open this" : "A members' room"}</h2>
        <p className="mt-2 max-w-md text-sm text-[#f7efe2]/90">
          {mini
            ? "Ora Mini stays as it is. These twelve tools open with Ora Membership, at the same $25 monthly price."
            : "Love notes, tarot, the moon calendar, and the rest of this room are included with Ora Membership."}
        </p>
      </div>
      <div className="px-5 py-4">
        <Link
          to="/membership"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg"
        >
          {mini ? "Upgrade to Ora Membership" : "Subscribe to Ora Membership"}
        </Link>
        <p className="mt-3 text-xs text-muted">{PREMIUM_NOTE}</p>
      </div>
    </section>
  );
}

export function PremiumNote() {
  return <p className="text-xs leading-relaxed text-muted">{PREMIUM_NOTE}</p>;
}

export function ToolFrame({ kicker, title, lede, children }: { kicker: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <main className="px-4 py-6">
      <Link to="/spirit" className="text-sm text-primary">
        Spiritual tools
      </Link>
      <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] tracking-[0.16em] text-[#8d6b32] uppercase">
        <PremiumCrown className="size-3.5" />
        {kicker}
      </p>
      <h1 className="mt-1 font-display text-4xl text-fg">{title}</h1>
      {lede ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{lede}</p> : null}
      <div className="mt-6">{children}</div>
    </main>
  );
}

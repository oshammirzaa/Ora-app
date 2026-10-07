import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight, MessageCircleReply, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomerMenuTo = "/reading-history" | "/transactions" | "/follow-ups";

const TONE = {
  gold: "bg-gradient-to-br from-[#fbf6ea] to-[#ead7ae] text-[#8d6b32]",
  violet: "bg-gradient-to-br from-[#f4eaf6] to-[#e3d0ec] text-[#6d3d78]",
  rose: "bg-gradient-to-br from-[#fbeff4] to-[#f0d5e2] text-[#8a4d68]",
} as const;

export function CustomerMenuRow({
  to,
  label,
  hint,
  icon: Icon,
  tone,
}: {
  to: CustomerMenuTo;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: keyof typeof TONE;
}) {
  return (
    <Link
      to={to}
      preload={false}
      className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 shadow-[var(--shadow-border)]"
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", TONE[tone])} aria-hidden>
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg">{label}</span>
        <span className="mt-0.5 block text-xs text-faint">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

export function CustomerAccountMenus() {
  return (
    <nav className="mt-8 space-y-2" aria-label="Account history">
      <CustomerMenuRow
        to="/reading-history"
        label="Reading History"
        hint="Previous readings and sitting history"
        icon={BookOpen}
        tone="violet"
      />
      <CustomerMenuRow
        to="/transactions"
        label="Transactions"
        hint="Payments, wallet, and coin history"
        icon={Wallet}
        tone="gold"
      />
      <CustomerMenuRow
        to="/follow-ups"
        label="Messages"
        hint="Follow-ups from advisors after a sitting."
        icon={MessageCircleReply}
        tone="rose"
      />
    </nav>
  );
}

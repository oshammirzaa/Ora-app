import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Gift, NotebookPen, Shield, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getAdvancedFlags } from "@/lib/ora-advanced-api";
import { anyAdvancedFlag, type AdvancedFlags } from "@/lib/ora-feature-flags";

export function useAdvancedFlags() {
  const [flags, setFlags] = useState<AdvancedFlags | null>(null);
  useEffect(() => {
    let stop = false;
    void getAdvancedFlags()
      .then((next) => {
        if (!stop) setFlags(next);
      })
      .catch(() => {
        if (!stop) setFlags(null);
      });
    return () => {
      stop = true;
    };
  }, []);
  return flags;
}

const ROWS: { flag: keyof AdvancedFlags; to: "/scheduled" | "/rewards" | "/journal" | "/referrals" | "/gifts" | "/security"; label: string; hint: string; icon: LucideIcon }[] = [
  { flag: "schedule", to: "/scheduled", label: "My Scheduled Readings", hint: "A future sitting. Coins are not taken until a live chat starts.", icon: CalendarClock },
  { flag: "rewards", to: "/rewards", label: "Daily Rewards", hint: "Seven-day streak. Day 7 adds 3 free minutes.", icon: Sparkles },
  { flag: "journal", to: "/journal", label: "My Journal", hint: "Private notes only you can open.", icon: NotebookPen },
  { flag: "referrals", to: "/referrals", label: "Invite Friends", hint: "3 free minutes after their first paid reading.", icon: Users },
  { flag: "gifts", to: "/gifts", label: "Gift a Reading", hint: "Purchases stay off until payment is ready.", icon: Gift },
  { flag: "security", to: "/security", label: "Login & Security", hint: "Devices, sessions, and an optional authenticator.", icon: Shield },
];

export function AdvancedCustomerLinks() {
  const flags = useAdvancedFlags();
  if (!flags || !anyAdvancedFlag(flags)) return null;
  const rows = ROWS.filter((row) => flags[row.flag]);
  if (!rows.length) return null;
  return (
    <nav className="mt-4 space-y-2" aria-label="More account tools">
      {rows.map((row) => (
        <Link
          key={row.to}
          to={row.to}
          preload={false}
          className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 shadow-[var(--shadow-border)]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f4eaf6] to-[#e3d0ec] text-[#6d3d78]">
            <row.icon className="size-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-fg">{row.label}</span>
            <span className="mt-0.5 block text-xs text-faint">{row.hint}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-faint" />
        </Link>
      ))}
    </nav>
  );
}

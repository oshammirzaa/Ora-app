import { Link } from "@tanstack/react-router";
import { ChevronRight, Crown, type LucideIcon, Heart, Moon, Sparkles, Layers, SunMedium, Milestone, Smile, Award, Mail, Hourglass, BookOpen, History } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdvancedFlags } from "@/components/advanced-links";
import { getPremiumAccess } from "@/lib/ora-premium-api";
import { anyPremiumFlag, type PremiumFlag, type PremiumFlags } from "@/lib/ora-feature-flags";

type ToolId = "love" | "tarot" | "pick" | "moon" | "affirm" | "timeline" | "mood" | "badges" | "vault" | "queue";

const GROUPS: { title: string; hint: string; rows: { flag?: PremiumFlag; tool?: ToolId; to?: "/reading-history" | "/journal" | "/scheduled"; label: string; hint: string; icon: LucideIcon; advanced?: "journal" | "schedule" }[] }[] = [
  {
    title: "Spiritual Tools",
    hint: "Included with Ora Membership",
    rows: [
      { flag: "love", tool: "love", label: "Love Compatibility", hint: "An entertainment score for two birth dates", icon: Heart },
      { flag: "tarot", tool: "tarot", label: "Daily Tarot", hint: "One free card each day. No coins.", icon: Sparkles },
      { flag: "pick", tool: "pick", label: "Pick a Card", hint: "Three cards, one choice, once a day", icon: Layers },
      { flag: "moon", tool: "moon", label: "Moon Calendar", hint: "The astronomical phase, then a reflection", icon: Moon },
      { flag: "affirmations", tool: "affirm", label: "Daily Affirmations", hint: "A line matched to what you are tending", icon: SunMedium },
    ],
  },
  {
    title: "My Journey",
    hint: "Private unless you choose to share",
    rows: [
      { flag: "timeline", tool: "timeline", label: "Relationship Timeline", hint: "Dates you keep for yourself", icon: Milestone },
      { flag: "mood", tool: "mood", label: "Emotional Check-in", hint: "A private mood note. Not a diagnosis.", icon: Smile },
      { to: "/journal", label: "Reading Journal", hint: "Private notes only you can open", icon: BookOpen, advanced: "journal" },
      { flag: "badges", tool: "badges", label: "Spiritual Badges", hint: "Achievements. They do not pay coins.", icon: Award },
      { flag: "vault", tool: "vault", label: "Future Messages", hint: "Notes your psychic set to open later", icon: Mail },
    ],
  },
  {
    title: "My Readings",
    hint: "Summaries and the waiting line",
    rows: [
      { flag: "highlights", to: "/reading-history", label: "Reading Highlights", hint: "Short summaries after a sitting", icon: History },
      { to: "/scheduled", label: "Scheduled Readings", hint: "A future sitting. Coins wait until the chat starts.", icon: Hourglass, advanced: "schedule" },
      { flag: "queue", tool: "queue", label: "Waiting Queue", hint: "Your place when a psychic is in session", icon: Hourglass },
    ],
  },
];

export function usePremiumAccess() {
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getPremiumAccess>> | null>(null);
  useEffect(() => {
    let stop = false;
    void getPremiumAccess()
      .then((next) => {
        if (!stop) setAccess(next);
      })
      .catch(() => {
        if (!stop) setAccess(null);
      });
    return () => {
      stop = true;
    };
  }, []);
  return access;
}

export function PremiumCustomerMenus() {
  const access = usePremiumAccess();
  const advanced = useAdvancedFlags();
  if (!access || !anyPremiumFlag(access.flags)) return null;
  const flags = access.flags;
  return (
    <div className="mt-8 space-y-6">
      {GROUPS.map((group) => {
        const rows = group.rows.filter((row) => {
          if (row.flag && !flags[row.flag]) return false;
          if (row.advanced && !advanced?.[row.advanced]) return false;
          return true;
        });
        if (!rows.length) return null;
        return (
          <section key={group.title}>
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-xl text-fg">{group.title}</h2>
              <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.14em] text-[#8d6b32] uppercase">
                <Crown className="size-3" />
                Membership
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{group.hint}</p>
            <nav className="mt-3 space-y-2" aria-label={group.title}>
              {rows.map((row) => row.tool ? (
                <Link
                  key={`${group.title}-${row.label}`}
                  to="/spirit/$tool"
                  params={{ tool: row.tool }}
                  search={{ advisor: "" }}
                  preload={false}
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 shadow-[var(--shadow-border)]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#fbf6ea] to-[#e7d3a4] text-[#8d6b32]">
                    <row.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm text-fg">
                      {row.label}
                      <Crown className="size-3 text-[#c4a35a]" aria-label="Ora Membership" />
                    </span>
                    <span className="mt-0.5 block text-xs text-faint">{row.hint}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </Link>
              ) : (
                <Link
                  key={`${group.title}-${row.label}`}
                  to={row.to || "/reading-history"}
                  preload={false}
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-3.5 py-2.5 shadow-[var(--shadow-border)]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#fbf6ea] to-[#e7d3a4] text-[#8d6b32]">
                    <row.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm text-fg">
                      {row.label}
                      <Crown className="size-3 text-[#c4a35a]" aria-label="Ora Membership" />
                    </span>
                    <span className="mt-0.5 block text-xs text-faint">{row.hint}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </Link>
              ))}
            </nav>
          </section>
        );
      })}
    </div>
  );
}

export type { PremiumFlags };

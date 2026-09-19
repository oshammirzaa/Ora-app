import {
  Briefcase,
  Cloud,
  Crown,
  Flower2,
  Heart,
  Moon,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const HOME_CHIP_LEAD = [
  "All",
  "Love",
  "Career",
  "Psychic Readings",
  "Dream Analysis",
  "Spirituality",
];

export function homeCategoryChips(dbNames: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...HOME_CHIP_LEAD, ...dbNames]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function matchesAdvisorCategory(specialties: string, filter: string) {
  if (!filter || filter === "All") return true;
  const s = specialties.toLowerCase();
  const f = filter.toLowerCase();
  if (s.includes(f)) return true;
  if (f === "psychic readings") return /psychic|clairvoyant|tarot/.test(s);
  if (f === "dream analysis") return /dream/.test(s);
  if (f === "spirituality") return /spirit/.test(s);
  if (f === "love") return /love|relationship|romance/.test(s);
  if (f === "career") return /career|work|job/.test(s);
  if (f.includes("trusted")) return false;
  return s.includes(f);
}

function categoryTone(name: string): { icon: LucideIcon; well: string } | null {
  const n = name.toLowerCase();
  if (n === "all") return null;
  if (n.includes("trusted")) return { icon: Crown, well: "cat-well-trusted" };
  if (n.includes("love") || n.includes("relationship")) return { icon: Heart, well: "cat-well-love" };
  if (n.includes("career") || n.includes("work") || n.includes("job"))
    return { icon: Briefcase, well: "cat-well-career" };
  if (n.includes("dream")) return { icon: Moon, well: "cat-well-dream" };
  if (n.includes("psychic") || n.includes("reading")) return { icon: Star, well: "cat-well-psychic" };
  if (n.includes("grief") || n.includes("loss") || n.includes("bereave"))
    return { icon: Cloud, well: "cat-well-grief" };
  if (n.includes("astrolog")) return { icon: Sparkles, well: "cat-well-astro" };
  if (n.includes("medium")) return { icon: Sparkles, well: "cat-well-medium" };
  if (n.includes("spirit")) return { icon: Flower2, well: "cat-well-spirit" };
  return { icon: Sparkles, well: "cat-well-default" };
}

export function CategoryPills({
  chips,
  filter,
  onChange,
}: {
  chips: string[];
  filter: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {chips.map((name) => {
        const tone = categoryTone(name);
        const on = filter === name;
        const Icon = tone?.icon;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full pr-3.5 text-sm transition-colors",
              Icon ? "pl-1.5" : "pl-3.5",
              on ? "bg-primary font-medium text-primary-fg" : "bg-surface text-fg shadow-[var(--shadow-border)]",
            )}
          >
            {Icon && tone ? (
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full",
                  on ? "bg-primary-fg/15 text-primary-fg" : tone.well,
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.9} />
              </span>
            ) : null}
            {name}
          </button>
        );
      })}
    </div>
  );
}

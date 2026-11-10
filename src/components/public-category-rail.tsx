import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Compass,
  Flower2,
  Hand,
  Hash,
  Heart,
  Layers,
  Moon,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { serviceCards } from "@/lib/ora-public-categories";

const ICONS: Record<string, LucideIcon> = {
  "psychic-readings": Star,
  astrology: Sparkles,
  numerology: Hash,
  tarot: Layers,
  dreams: Moon,
  palm: Hand,
  love: Heart,
  fortune: Compass,
  career: Briefcase,
  mediums: Flower2,
};

export function PublicCategoryRail() {
  const rail = useRef<HTMLDivElement>(null);

  function move(direction: number) {
    rail.current?.scrollBy({ left: direction * 240, behavior: "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
  }

  return (
    <section id="services" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold text-[#2a2430] md:text-4xl">Readings</h2>
          <p className="mt-1 text-sm font-medium text-[#72687a]">Choose a focus. You will see advisors who list it.</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <RailButton label="Previous readings" onClick={() => move(-1)} />
          <RailButton label="Next readings" onClick={() => move(1)} flip />
        </div>
      </div>
      <div
        ref={rail}
        tabIndex={0}
        aria-label="Reading categories"
        onKeyDown={onKeyDown}
        className="no-scrollbar mt-4 flex snap-x gap-3 overflow-x-auto pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        {serviceCards().map((category) => {
          const Icon = ICONS[category.id] || Sparkles;
          return (
            <Link
              key={category.id}
              to="/psychics"
              search={{ category: category.id }}
              className="flex w-[10.5rem] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-[#eadfe6] bg-white px-3.5 py-4 shadow-[var(--shadow-border)] hover:border-primary/35"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[#fbf6ea] text-primary">
                <Icon className="size-5" strokeWidth={2.25} />
              </span>
              <span className="text-sm leading-tight font-semibold text-[#2a2430]">{category.short}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function RailButton({ label, onClick, flip = false }: { label: string; onClick: () => void; flip?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full border border-[#eadfe6] bg-white text-primary"
    >
      <svg viewBox="0 0 24 24" className={`size-5 ${flip ? "rotate-180" : ""}`} aria-hidden>
        <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

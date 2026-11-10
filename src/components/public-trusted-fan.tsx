import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PublicPsychicCard } from "@/components/public-psychic-card";
import type { PublicPsychic } from "@/lib/ora-domains";

export function PublicTrustedFan({
  advisors,
  marketingHost,
}: {
  advisors: PublicPsychic[];
  marketingHost: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const loop = advisors.length > 1;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (paused || reduced || !loop) return;
    const node = scroller.current;
    if (!node) return;
    let frame = 0;
    let visible = true;
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    });
    observer.observe(node);
    const tick = () => {
      if (visible && node.isConnected) {
        const half = node.scrollWidth / 2;
        node.scrollLeft += 0.45;
        if (half > 0 && node.scrollLeft >= half) node.scrollLeft -= half;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [paused, reduced, loop, advisors.length]);

  function nudge(direction: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * 300, behavior: reduced ? "auto" : "smooth" });
  }

  function hold(next: boolean) {
    setPaused(next);
  }

  if (!advisors.length) {
    return (
      <p className="mt-4 text-sm font-medium text-[#72687a]">
        Trusted Psychics appear here once advisors qualify under the existing ranking. No profiles are added to fill the row.
      </p>
    );
  }

  const cards = loop ? [...advisors, ...advisors] : advisors;

  return (
    <div className="relative mt-2">
      <div className="mb-3 flex justify-end gap-2">
        <FanButton label="Previous trusted advisors" onClick={() => nudge(-1)} />
        <FanButton label="Next trusted advisors" onClick={() => nudge(1)} next />
      </div>
      <div
        ref={scroller}
        tabIndex={0}
        aria-label="Trusted psychic profiles"
        className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        onMouseEnter={() => hold(true)}
        onMouseLeave={() => hold(false)}
        onFocus={() => hold(true)}
        onBlur={() => hold(false)}
        onPointerDown={() => hold(true)}
        onPointerUp={() => hold(false)}
        onPointerCancel={() => hold(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            nudge(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            nudge(-1);
          }
        }}
      >
        {cards.map((advisor, index) => {
          const copy = loop && index >= advisors.length;
          return (
            <div
              key={`${advisor.id}-${copy ? "b" : "a"}`}
              className="w-[18.75rem] shrink-0 snap-start"
              aria-hidden={copy ? true : undefined}
            >
              <PublicPsychicCard advisor={advisor} marketingHost={marketingHost} eager={!copy && index < 4} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FanButton({ label, onClick, next = false }: { label: string; onClick: () => void; next?: boolean }) {
  const Icon = next ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full border border-[#eadfE6] bg-white text-primary"
    >
      <Icon className="size-5" strokeWidth={2.25} />
    </button>
  );
}

export function TrustedCardFan() {
  const angles = [-42, -28, -14, 0, 14, 28, 42];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
      <div className="absolute top-2 left-1/2 h-56 w-[40rem] -translate-x-1/2">
        {angles.map((angle) => (
          <div
            key={angle}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
          >
            <CardBack />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <svg viewBox="0 0 120 188" className="h-44 w-28 drop-shadow-[0_10px_16px_rgba(90,40,70,0.18)]">
      <rect x="2" y="2" width="116" height="184" rx="14" fill="#7a4e6c" />
      <rect x="8" y="8" width="104" height="172" rx="10" fill="none" stroke="#c4a35a" strokeWidth="1.6" />
      <rect x="14" y="14" width="92" height="160" rx="8" fill="#fbf6ea" />
      <circle cx="60" cy="86" r="22" fill="none" stroke="#7a4e6c" strokeWidth="1.4" />
      <path d="M72 74c-12 4-20 16-18 28 8-6 18-6 26-2-2-10-4-18-8-26z" fill="#7a4e6c" />
      <path d="M60 48l1.6 4.6 4.8.2-3.8 2.9 1.4 4.6L60 57.6 55.9 60.3l1.4-4.6-3.8-2.9 4.8-.2z" fill="#c4a35a" />
      <text x="60" y="154" textAnchor="middle" fill="#7a4e6c" fontSize="11" fontFamily="Georgia, serif" letterSpacing="3">
        ORA
      </text>
    </svg>
  );
}

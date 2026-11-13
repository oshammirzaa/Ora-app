import { ChevronLeft, ChevronRight, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AdvisorMedia } from "@/components/advisor-media";
import { AdvisorRating, formatUsdPerMin, primarySpecialty } from "@/components/advisor-cards";
import { PresenceBadge, PresenceDot } from "@/components/chat-now";
import { appHref, type PublicPsychic } from "@/lib/ora-domains";
import { presenceState } from "@/lib/ora-presence";
import { advisorShowsTrustedBadge } from "@/lib/ora-rank";

export function PublicTrustedFan({
  advisors,
  marketingHost,
}: {
  advisors: PublicPsychic[];
  marketingHost: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pointing, setPointing] = useState(false);
  const [reduced, setReduced] = useState(false);
  const paused = hovering || focused || pointing;
  const [shown, setShown] = useState(advisors);
  const loop = shown.length > 1;

  useEffect(() => {
    if (!paused) setShown(advisors);
  }, [advisors, paused]);

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
    const TRUSTED_FAN_START_MS = 100;
    const TRUSTED_FAN_MOVE_MS = 1600;
    const TRUSTED_FAN_READ_MS = 4800;
    let timer = 0;
    let frame = 0;
    let visible = false;
    const stop = () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
    const queue = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(step, delay);
    };
    const step = () => {
      if (!visible || !node.isConnected) return;
      const card = node.querySelector<HTMLElement>("[data-trusted-card]");
      const styles = window.getComputedStyle(node);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "12") || 12;
      const width = (card?.offsetWidth || 292) + gap;
      const half = node.scrollWidth / 2;
      const from = node.scrollLeft;
      const started = performance.now();
      const tick = (now: number) => {
        if (!visible || !node.isConnected) return;
        const progress = Math.min(1, (now - started) / TRUSTED_FAN_MOVE_MS);
        const eased = 1 - (1 - progress) ** 3;
        let next = from + width * eased;
        if (half > 0 && next >= half) next -= half;
        node.scrollLeft = next;
        if (progress < 1) frame = window.requestAnimationFrame(tick);
        else queue(TRUSTED_FAN_READ_MS);
      };
      frame = window.requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const nextVisible = entries.some((entry) => entry.isIntersecting);
        if (nextVisible && !visible) {
          visible = true;
          queue(TRUSTED_FAN_START_MS);
        } else if (!nextVisible) {
          visible = false;
          stop();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => {
      stop();
      observer.disconnect();
    };
  }, [paused, reduced, loop, shown.length]);

  function nudge(direction: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * 292, behavior: reduced ? "auto" : "smooth" });
  }

  if (!advisors.length) {
    return (
      <p className="mt-4 max-w-xl text-sm font-medium text-[#3a3142]">
        Trusted Psychics appear here once advisors qualify under the existing ranking. No profiles are added to fill the row.
      </p>
    );
  }

  const cards = loop ? [...shown, ...shown] : shown;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="absolute -top-16 right-0 z-20 flex gap-2 md:-top-[4.5rem]">
        <FanButton label="Previous trusted advisors" onClick={() => nudge(-1)} />
        <FanButton label="Next trusted advisors" onClick={() => nudge(1)} next />
      </div>
      <div
        ref={scroller}
        tabIndex={0}
        aria-label="Trusted psychic profiles"
        className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-0.5 pt-3 pb-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        onPointerDown={() => setPointing(true)}
        onPointerUp={() => setPointing(false)}
        onPointerCancel={() => setPointing(false)}
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
          const copy = loop && index >= shown.length;
          const place = (index % shown.length) + 1;
          return (
            <div
              key={`${advisor.id}-${copy ? "b" : "a"}`}
              data-trusted-card=""
              className="w-[17.25rem] shrink-0 snap-start sm:w-[18.25rem]"
              aria-hidden={copy ? true : undefined}
            >
              <TrustedShowcaseCard
                advisor={advisor}
                marketingHost={marketingHost}
                rank={trustedPlace(advisor, place)}
                eager={!copy && index < 4}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function trustedPlace(advisor: PublicPsychic, place: number) {
  const stored = advisor.manualRank ?? advisor.monthlyRank;
  if (typeof stored === "number" && Number.isFinite(stored) && stored >= 1) return Math.floor(stored);
  return place;
}

function FanButton({ label, onClick, next = false }: { label: string; onClick: () => void; next?: boolean }) {
  const Icon = next ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-white text-[#6d3054] shadow-[0_8px_20px_-10px_rgba(60,30,40,0.55)]"
    >
      <Icon className="size-5" strokeWidth={2.4} />
    </button>
  );
}

function TrustedShowcaseCard({
  advisor,
  marketingHost,
  rank,
  eager,
}: {
  advisor: PublicPsychic;
  marketingHost: boolean;
  rank: number;
  eager: boolean;
}) {
  const slug = advisor.slug || advisor.id;
  const state = presenceState(advisor);
  const blocked = state === "offline" || state === "busy";
  const chatLabel = state === "offline" ? "Offline" : state === "busy" ? "In Session" : "Chat";
  const specialty = primarySpecialty(advisor) || "Specialty on profile";

  return (
    <article className="flex h-full flex-col rounded-[1.35rem] bg-white p-3.5 shadow-[0_18px_36px_-18px_rgba(55,28,40,0.48)]">
      <Link to="/psychics/$id" params={{ id: slug }} preload={false} className="block min-w-0">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="size-[4.35rem] overflow-hidden rounded-full bg-[#f6f1f4]">
              <AdvisorMedia photo={advisor.photoUrl} alt="" eager={eager} className="outline-none" />
            </div>
            <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-fg">
              #{rank}
            </span>
            <PresenceDot advisor={advisor} className="absolute right-0.5 bottom-0.5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center justify-end gap-1">
              {advisorShowsTrustedBadge(advisor) ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f8eef3] px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  <ShieldCheck className="size-3" strokeWidth={2.4} />
                  Trusted
                </span>
              ) : null}
              {advisor.isNew ? (
                <span className="rounded-full bg-[#fbf6ea] px-1.5 py-0.5 text-[10px] font-semibold text-[#8d6b32]">Rising Star</span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[15px] font-semibold text-[#2a2430]">{advisor.name}</p>
            <p className="truncate text-sm text-[#72687a]">{specialty}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          {advisor.reviews > 0 ? (
            <AdvisorRating advisor={advisor} />
          ) : (
            <span className="text-sm text-[#72687a]">No reviews yet</span>
          )}
          <PresenceBadge advisor={advisor} />
        </div>
        <p className="mt-2 text-sm font-semibold text-[#2a2430]">
          {advisor.rateCoins > 0 ? (
            <>
              {formatUsdPerMin(advisor.rateCoins)}
              <span className="font-medium text-[#72687a]"> · {advisor.rateCoins} coins/min</span>
            </>
          ) : (
            <span className="font-medium text-[#72687a]">Rate on profile</span>
          )}
        </p>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/psychics/$id"
          params={{ id: slug }}
          preload={false}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[#e4d7de] bg-white text-sm font-semibold text-[#2a2430]"
        >
          View Profile
        </Link>
        {blocked ? (
          <span className="inline-flex h-11 items-center justify-center rounded-full bg-[#f4f1f3] text-sm font-semibold text-[#a39aaa]">
            {chatLabel}
          </span>
        ) : (
          <a
            href={appHref(`/advisors/${slug}`, marketingHost)}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-fg"
          >
            <MessageCircle className="size-4" strokeWidth={2.4} />
            Chat
          </a>
        )}
      </div>
    </article>
  );
}

export function TrustedCardFan() {
  const angles = [-34, -18, 0, 18, 34];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 flex justify-center md:top-2">
      <div className="relative h-36 w-64 sm:h-44 sm:w-80">
        {angles.map((angle) => (
          <div
            key={angle}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
          >
            <CardBack featured={angle === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardBack({ featured }: { featured: boolean }) {
  return (
    <svg viewBox="0 0 132 196" className={featured ? "h-40 w-[6.6rem] drop-shadow-[0_14px_18px_rgba(70,30,45,0.28)] sm:h-44 sm:w-28" : "h-36 w-24 drop-shadow-[0_10px_14px_rgba(70,30,45,0.22)] sm:h-40 sm:w-[6.4rem]"}>
      <rect x="5" y="5" width="122" height="186" rx="16" fill="#fffaf7" stroke="#7a3a56" strokeWidth="7" />
      <rect x="16" y="16" width="100" height="164" rx="11" fill="none" stroke="#c4a35a" strokeWidth="2" />
      {featured ? (
        <>
          <path d="M78 72c-16 5-27 20-23 36 12-8 26-6 36 2-3-14-6-28-13-38z" fill="#7a3a56" />
          <path d="M66 48l1.5 4.4 4.6.1-3.6 2.8 1.3 4.4L66 57.2l-4 2.5 1.3-4.4-3.6-2.8 4.6-.1z" fill="#d4af6a" />
          <path d="M96 58l.8 2.3 2.4.1-1.9 1.5.7 2.3-2-1.4-2 1.4.7-2.3-1.9-1.5 2.4-.1z" fill="#d4af6a" />
        </>
      ) : (
        <path d="M74 86c-12 4-20 15-17 27 9-6 19-4 27 1-2-10-5-21-10-28z" fill="#7a3a56" opacity="0.9" />
      )}
    </svg>
  );
}

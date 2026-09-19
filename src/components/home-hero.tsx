import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Coins, Heart } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const SLIDE_MS = 5000;
const SLIDE_COUNT = 2;

export function HomeHero() {
  const [slide, setSlide] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((current) => (current + 1) % SLIDE_COUNT);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [slide]);

  function go(next: number) {
    setSlide(((next % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    startX.current = e.clientX;
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current == null) return;
    const dx = e.clientX - startX.current;
    dragging.current = false;
    startX.current = null;
    if (dx <= -40) go(slide + 1);
    else if (dx >= 40) go(slide - 1);
  }

  return (
    <section id="home-hero" className="relative overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)]">
      <div
        className="flex w-[200%] touch-pan-y transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${slide * 50}%)` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <article className="relative flex min-h-[16.5rem] w-1/2 shrink-0 flex-col px-5 pt-5 pb-8">
          <FreeMinutesSlide />
        </article>
        <article className="relative flex min-h-[16.5rem] w-1/2 shrink-0 flex-col px-5 pt-5 pb-8">
          <MembershipSlide />
        </article>
      </div>
      <div className="pointer-events-auto absolute inset-x-0 bottom-2.5 z-20 flex justify-center gap-1.5">
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={i === 0 ? "Your first 3 minutes" : "Ora Membership"}
            aria-current={slide === i}
            onClick={() => go(i)}
            className={
              slide === i
                ? "h-1.5 w-4 rounded-full bg-primary"
                : "size-1.5 rounded-full bg-faint/55"
            }
          />
        ))}
      </div>
    </section>
  );
}

function FreeMinutesSlide() {
  return (
    <>
      <LotusBloom />
      <GoodEnergyMark className="top-4 right-[4.55rem]" />
      <div className="relative z-10 max-w-[13.5rem]">
        <p className="text-[10px] tracking-[0.2em] text-muted uppercase">
          Guidance · Clarity · A brighter you
        </p>
        <h1 className="mt-2.5 font-display text-[1.7rem] leading-[1.12] font-semibold tracking-tight text-fg">
          Your First
          <br />
          <span className="text-primary">3 Minutes</span> Are Free
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Connect with a trusted psychic and get the clarity you deserve
        </p>
        <Link
          to="/advisors"
          preload={false}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary pr-3.5 pl-5 text-sm font-medium text-primary-fg"
        >
          Start a Reading
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="pointer-events-none absolute top-6 right-3 z-10 w-[4.4rem] text-right text-[10px] leading-[1.35] tracking-wide text-muted">
        <p>Positive</p>
        <p>Energy</p>
        <p className="mt-2.5">Clearer</p>
        <p>Answers</p>
        <p className="mt-2.5">Happier</p>
        <p>You</p>
        <Heart className="mt-3 ml-auto size-4 text-lotus" fill="currentColor" strokeWidth={1.4} />
      </div>
    </>
  );
}

function MembershipSlide() {
  return (
    <>
      <LotusBloom />
      <GoodEnergyMark className="top-4 right-3" />
      <div className="relative z-10 pr-8">
        <p className="text-[10px] tracking-[0.2em] text-muted uppercase">More support · more insights</p>
        <h1 className="mt-2.5 font-display text-[1.7rem] leading-[1.12] font-semibold tracking-tight text-fg [text-wrap:nowrap]">
          Ora
          <br />
          <span className="text-primary">Membership</span>
        </h1>
        <ul className="mt-3 space-y-2">
          <li className="flex items-center gap-2.5 text-[13px] leading-snug text-fg">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blush text-primary">
              <Clock className="size-3.5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="font-medium">3 free minutes</span> every 48 hours
            </span>
          </li>
          <li className="flex items-center gap-2.5 text-[13px] leading-snug text-fg">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blush text-gold">
              <Coins className="size-3.5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="font-medium">50 Ora Coins</span> every month
            </span>
          </li>
        </ul>
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex h-10 shrink-0 items-center rounded-full bg-gold px-3.5 text-sm font-semibold text-gold-fg">
            $25<span className="ml-1 text-[11px] font-medium opacity-80">/month</span>
          </span>
          <Link
            to="/membership"
            preload={false}
            className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-primary px-3 text-sm font-medium text-primary-fg"
          >
            Join Membership
            <ArrowRight className="size-4 shrink-0" />
          </Link>
        </div>
      </div>
    </>
  );
}

function GoodEnergyMark({ className }: { className?: string }) {
  return (
    <p
      className={`pointer-events-none absolute z-[11] w-[6.9rem] text-right text-[1.12rem] leading-[1.12] text-primary/75 ${className ?? ""}`}
      style={{ fontFamily: "var(--font-script)", transform: "rotate(-10deg)" }}
      aria-hidden
    >
      Good Energy Always With You ♡
    </p>
  );
}

function LotusBloom() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="pointer-events-none absolute top-1/2 -right-2 h-[12rem] w-[12rem] -translate-y-1/2 text-lotus"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M100 176c-8-34-36-58-72-70 28 6 48-12 56-40 8 28 28 46 56 40-36 12-64 36-72 70z"
        opacity=".55"
      />
      <path
        fill="currentColor"
        d="M100 168c-22-26-58-36-84-26 34-10 52-36 52-62 16 28 32 44 32 88z"
        opacity=".38"
      />
      <path
        fill="currentColor"
        d="M100 168c22-26 58-36 84-26-34-10-52-36-52-62-16 28-32 44-32 88z"
        opacity=".38"
      />
      <path
        fill="currentColor"
        d="M100 160c-10-42 8-74 36-92-10 34 6 60 34 74-34-2-58 6-70 18z"
        opacity=".28"
      />
      <path
        fill="currentColor"
        d="M100 160c10-42-8-74-36-92 10 34-6 60-34 74 34-2 58 6 70 18z"
        opacity=".28"
      />
      <path
        fill="currentColor"
        d="M100 152c-4-46 18-78 48-96-18 32-4 62 20 82-28 0-52 4-68 14z"
        opacity=".2"
      />
      <circle cx="100" cy="92" r="14" fill="currentColor" opacity=".22" />
    </svg>
  );
}

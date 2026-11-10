import { Link } from "@tanstack/react-router";

export function PublicHero() {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#efe4ea] bg-white px-5 py-8 shadow-[0_18px_40px_-28px_rgba(122,78,108,0.45)] md:px-12 md:py-14">
      <HeroSky />
      <div className="relative z-10 max-w-xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Ora Psychic</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-semibold text-[#2a2430] md:text-6xl">
          A private reading, with a real advisor.
        </h1>
        <p className="mt-4 text-base leading-relaxed font-medium text-[#5c5366] md:text-lg">
          See who is available, their specialty, and the rate on their profile. Start a live chat when you are ready. Your first 3 minutes are free.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/psychics"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-fg"
          >
            Find an Advisor
          </Link>
          <a
            href="#services"
            className="inline-flex h-12 items-center justify-center rounded-full border border-[#e4d3dc] bg-white px-6 text-sm font-semibold text-[#2a2430]"
          >
            Explore Readings
          </a>
        </div>
        <p className="mt-4 text-sm font-medium text-[#72687a]">Entertainment only. Not medical, legal, or financial advice.</p>
      </div>
    </section>
  );
}

function HeroSky() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[46%] max-w-md">
      <svg viewBox="0 0 360 420" className="h-full w-full">
        <defs>
          <radialGradient id="ora-hero-glow" cx="60%" cy="40%" r="55%">
            <stop offset="0" stopColor="#f8efe2" />
            <stop offset="0.55" stopColor="#f7eef4" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="420" fill="url(#ora-hero-glow)" />
        <g fill="none" stroke="#c4a35a" strokeWidth="1.6" opacity="0.85">
          <path d="M250 78c28 18 42 48 36 78-8-22-28-40-56-46 6-12 14-22 20-32z" />
          <circle cx="268" cy="150" r="46" stroke="#7a4e6c" strokeOpacity="0.35" />
        </g>
        <g fill="#c4a35a">
          <path d="M300 64l2.2 6.4 6.6.2-5.2 4 1.9 6.4-5.5-3.8-5.5 3.8 1.9-6.4-5.2-4 6.6-.2z" />
          <path d="M214 120l1.4 4 4.2.1-3.3 2.6 1.2 4-3.5-2.4-3.5 2.4 1.2-4-3.3-2.6 4.2-.1z" opacity="0.8" />
          <path d="M318 188l1.2 3.4 3.5.1-2.8 2.2 1 3.4-2.9-2-2.9 2 1-3.4-2.8-2.2 3.5-.1z" opacity="0.7" />
        </g>
        <circle cx="246" cy="250" r="3" fill="#7a4e6c" opacity="0.35" />
        <circle cx="292" cy="230" r="2" fill="#7a4e6c" opacity="0.28" />
      </svg>
    </div>
  );
}

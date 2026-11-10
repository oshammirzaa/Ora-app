import { Link } from "@tanstack/react-router";

export function PublicHero() {
  return (
    <section className="relative min-h-[28rem] overflow-hidden rounded-[1.75rem] border border-[#efe4ea] bg-[#f6efe8] shadow-[0_18px_40px_-28px_rgba(122,78,108,0.45)] md:min-h-[24rem]">
      <img
        src="/images/hero-owl.jpg"
        alt=""
        width={1600}
        height={900}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[88%_42%] sm:object-[78%_center] md:object-[72%_center]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f8f1ea]/95 via-[#f8f1ea]/78 to-[#f8f1ea]/5 sm:via-[#f8f1ea]/62 md:from-[#fbf6f1]/88 md:via-[#fbf6f1]/42 md:to-transparent" />
      <div className="relative z-10 flex max-w-[19rem] flex-col justify-center px-5 py-8 sm:max-w-xl sm:py-10 md:min-h-[24rem] md:w-[54%] md:max-w-none md:px-12 md:py-14">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#6d3054] uppercase">Ora Psychic</p>
        <h1 className="mt-3 font-display text-[2.15rem] leading-[1.05] font-semibold text-[#6d3054] sm:text-5xl md:text-6xl">
          A private reading, with a real advisor.
        </h1>
        <p className="mt-4 text-sm leading-relaxed font-medium text-[#3a3142] sm:text-base md:text-lg">
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
            className="inline-flex h-12 items-center justify-center rounded-full border border-[#e4d3dc] bg-white/90 px-6 text-sm font-semibold text-[#2a2430]"
          >
            Explore Readings
          </a>
        </div>
        <p className="mt-4 text-sm font-medium text-[#5c5366]">Entertainment only. Not medical, legal, or financial advice.</p>
      </div>
    </section>
  );
}

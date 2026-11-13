import { Link } from "@tanstack/react-router";

export function PublicHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#efe4ea] bg-gradient-to-br from-[#f8f0f5] via-[#f5eef6] to-[#f0e6f0] shadow-sm">
      <div className="absolute inset-0 bg-[url('/images/hero-owl.jpg')] bg-cover bg-right bg-no-repeat opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#faf6f8]/95 via-[#faf6f8]/70 to-transparent" />
      <div className="relative z-10 flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-10 md:min-h-[16rem] md:w-[58%] md:px-10 md:py-12">
        <h1 className="font-display text-[1.85rem] leading-[1.1] font-semibold text-[#5a2d4a] sm:text-4xl md:text-[2.6rem]">
          Find Clarity<br />Guidance and Answers
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[#4a3f4e] sm:text-base">
          Connect with trusted psychics for love, relationships, career, tarot and life direction
        </p>
        <div className="mt-5">
          <Link
            to="/psychics"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#6d3054] px-6 text-sm font-semibold text-white shadow-sm"
          >
            Explore Advisors →
          </Link>
        </div>
      </div>
    </section>
  );
}

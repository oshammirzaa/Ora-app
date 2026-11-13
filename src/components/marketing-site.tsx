import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdvisorScroller } from "@/components/public-psychic-card";
import { PublicFrame } from "@/components/public-frame";
import { PublicHero } from "@/components/public-hero";
import { listAdvisors, listFloor, type Category } from "@/lib/ora";
import { toPublicPsychic, type PublicPsychic } from "@/lib/ora-domains";
import { FLOOR_POLL_MS, mergeFloor, presenceState } from "@/lib/ora-presence";
import { PSYCHIC_CATEGORIES, type PsychicCategoryId } from "@/lib/ora-psychic-categories";
import { sortByAvailability } from "@/lib/ora-presence";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export function MarketingSite({
  advisors: initialAdvisors,
  categories: _categories,
  previewLayout,
  marketingHost,
  supportEmail,
}: {
  advisors: PublicPsychic[];
  categories: Category[];
  previewLayout: boolean;
  marketingHost: boolean;
  supportEmail?: string;
}) {
  const [advisors, setAdvisors] = useState(initialAdvisors);
  void _categories;
  void previewLayout;

  useEffect(() => {
    setAdvisors(initialAdvisors);
  }, [initialAdvisors]);

  useVisibleInterval(
    () => {
      void listFloor()
        .then((floor) => {
          setAdvisors((current) => mergeFloor(current, Array.isArray(floor) ? floor : []));
        })
        .catch(() => undefined);
    },
    FLOOR_POLL_MS,
    true,
    true,
  );

  useVisibleInterval(
    () => {
      void listAdvisors()
        .then((next) => {
          if (!Array.isArray(next)) return;
          setAdvisors(next.map((row) => toPublicPsychic(row)));
        })
        .catch(() => undefined);
    },
    60_000,
    true,
    false,
  );

  function categoryAdvisors(id: PsychicCategoryId, limit = 12) {
    const matched = advisors.filter((a) => (a.psychicCategories || []).includes(id));
    const unique = Array.from(new Map(matched.map((a) => [a.id, a])).values());
    return sortByAvailability(unique).slice(0, limit);
  }

  const trusted = useMemo(() => categoryAdvisors("trusted"), [advisors]);
  const premium = useMemo(() => categoryAdvisors("premium"), [advisors]);
  const rising = useMemo(() => categoryAdvisors("rising"), [advisors]);
  const elite = useMemo(() => categoryAdvisors("elite"), [advisors]);

  return (
    <PublicFrame marketingHost={marketingHost} supportEmail={supportEmail}>
      <main className="bg-[#faf9f8]">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <PublicHero />
        </div>

        <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
          <CategorySection
            title="Trusted Psychics"
            subtitle="Verified and trusted advisors with consistent high ratings and positive reviews."
            advisors={trusted}
            marketingHost={marketingHost}
            board="trusted"
          />
          <CategorySection
            title="Premium Advisors"
            subtitle="Hand-selected premium advisors. Online first."
            advisors={premium}
            marketingHost={marketingHost}
            board="recommended"
          />
          <CategorySection
            title="Rising Stars"
            subtitle="New and fast-growing advisors. Online first."
            advisors={rising}
            marketingHost={marketingHost}
            board="new"
          />
          <CategorySection
            title="Elite Psychics"
            subtitle="Our most experienced and highest-earning advisors."
            advisors={elite}
            marketingHost={marketingHost}
            board="trusted"
          />

          <section className="scroll-mt-24 rounded-[1.75rem] border border-[#efe4ea] bg-white px-5 py-8 md:px-8">
            <h2 className="font-display text-3xl font-semibold text-[#2a2430]">How It Works</h2>
            <ol className="mt-5 grid gap-4 md:grid-cols-3">
              <li className="rounded-2xl bg-[#fbf6ea] p-4">
                <p className="text-sm font-semibold text-primary">1. Choose</p>
                <p className="mt-1 text-sm font-medium text-[#5c5366]">Compare a real photo, specialty, rating, and published rate.</p>
              </li>
              <li className="rounded-2xl bg-[#f8eef3] p-4">
                <p className="text-sm font-semibold text-primary">2. Chat</p>
                <p className="mt-1 text-sm font-medium text-[#5c5366]">Start a private live chat when that advisor is available. Ora does not offer a separate call or video line.</p>
              </li>
              <li className="rounded-2xl bg-[#f6f1f4] p-4">
                <p className="text-sm font-semibold text-primary">3. Minutes, then coins</p>
                <p className="mt-1 text-sm font-medium text-[#5c5366]">Your first 3 minutes are free. After included time, the reading uses coins at the rate on that profile.</p>
              </li>
            </ol>
          </section>

          <section className="pb-2">
            <h2 className="font-display text-3xl font-semibold text-[#2a2430]">About Ora</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed font-medium text-[#5c5366] md:text-base">
              Ora is a private place for a live reading. You see the advisor's photo, specialty, rate, and reviews on this site, then continue in your Ora account when you are ready to talk. Entertainment only.
            </p>
          </section>
        </div>
      </main>
    </PublicFrame>
  );
}

function CategorySection({
  title,
  subtitle,
  advisors,
  marketingHost,
  board,
}: {
  title: string;
  subtitle: string;
  advisors: PublicPsychic[];
  marketingHost: boolean;
  board: "trusted" | "recommended" | "new";
}) {
  if (!advisors.length) return null;
  return (
    <section className="scroll-mt-24">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#2a2430] sm:text-3xl">{title}</h2>
          <p className="mt-0.5 text-sm text-[#72687a]">{subtitle}</p>
        </div>
        <Link to="/psychics" search={{ board }} className="shrink-0 text-sm font-semibold text-[#6d3054]">
          See all advisors →
        </Link>
      </div>
      <AdvisorScroller advisors={advisors} marketingHost={marketingHost} />
    </section>
  );
}

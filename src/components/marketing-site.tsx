import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdvisorScroller } from "@/components/public-psychic-card";
import { PublicCategoryRail } from "@/components/public-category-rail";
import { PublicFrame } from "@/components/public-frame";
import { PublicBanner } from "@/components/public-banner";
import { PublicHero } from "@/components/public-hero";
import { PublicTrustedFan, TrustedCardFan } from "@/components/public-trusted-fan";
import { listAdvisors, listFloor, type Category } from "@/lib/ora";
import { toPublicPsychic, type PublicPsychic } from "@/lib/ora-domains";
import { FLOOR_POLL_MS, mergeFloor, presenceState } from "@/lib/ora-presence";
import { publicCategoryById, serviceCards } from "@/lib/ora-public-categories";
import { advisorMatchesPublicCategory } from "@/lib/ora-reading-listings";
import { newPublicPsychics, recommendedPublicPsychics, trustedPublicPsychics } from "@/lib/ora-public-board";
import { type PsychicCategoryId } from "@/lib/ora-psychic-categories";
import { sortByAvailability } from "@/lib/ora-presence";
import { useVisibleInterval } from "@/lib/use-visible-interval";

const TOPICS = [
  {
    id: "soulmate",
    title: "Who Is My Soulmate?",
    category: "love",
    copy: "A private conversation about connection and what you want from a relationship. A reading is for reflection. It is not a promised match.",
  },
  {
    id: "love-guidance",
    title: "Love & Relationship Guidance",
    category: "love",
    copy: "Talk with advisors who list love and relationships. You choose the person, see their rate, and chat only while they are available.",
  },
  {
    id: "career",
    title: "Career and Financial Clarity",
    category: "career",
    copy: "Explore work and money questions with advisors who publish those specialties. This is not financial or career advice.",
  },
  {
    id: "tarot",
    title: "Explore Tarot Readings",
    category: "tarot",
    copy: "Open profiles that list tarot. Photos, ratings, and per-minute rates come from the advisor record.",
  },
  {
    id: "spirit",
    title: "Spiritual Guidance",
    category: "spiritual",
    copy: "See advisors who list spiritual readings or mediumship. Ora does not guarantee a message or an outcome.",
  },
] as const;

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

  const trusted = useMemo(() => trustedPublicPsychics(advisors, previewLayout).slice(0, 10), [advisors, previewLayout]);
  const recommended = useMemo(() => recommendedPublicPsychics(advisors, previewLayout, 5), [advisors, previewLayout]);
  const newest = useMemo(() => newPublicPsychics(advisors).slice(0, 8), [advisors]);

  function categoryAdvisors(id: PsychicCategoryId, limit = 8) {
    const matched = advisors.filter((a) => (a.psychicCategories || []).includes(id));
    const unique = Array.from(new Map(matched.map((a) => [a.id, a])).values());
    return sortByAvailability(unique).slice(0, limit);
  }
  const elite = useMemo(() => categoryAdvisors("elite"), [advisors]);
  const rising = useMemo(() => categoryAdvisors("rising"), [advisors]);
  const premium = useMemo(() => categoryAdvisors("premium"), [advisors]);
  const featuredTrusted = useMemo(() => categoryAdvisors("trusted"), [advisors]);

  return (
    <PublicFrame marketingHost={marketingHost} supportEmail={supportEmail}>
      <main>
        <div className="mx-auto max-w-6xl px-4 pt-5">
          <PublicHero />
          <div className="mt-4 md:hidden">
            <PublicBanner marketingHost={marketingHost} />
          </div>
          <div className="mt-10">
            <PublicCategoryRail />
          </div>
        </div>

        <section id="advisors" className="relative mt-12 scroll-mt-24 overflow-hidden">
          <img
            src="/images/trusted-meadow.jpg"
            alt=""
            width={1600}
            height={900}
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[78%_22%] sm:object-[70%_30%] md:object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#fff6ee]/80 via-[#fff6ee]/35 to-transparent md:from-[#fff6ee]/55 md:via-[#fff6ee]/10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#fffdfb] via-[#fffdfb]/85 to-transparent" />
          <div className="relative z-10 mx-auto max-w-6xl px-4 pt-8 pb-6 md:pt-12 md:pb-8">
            <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-[#6d3054] uppercase">
              Ora Psychic
              <span className="h-0.5 w-10 rounded-full bg-[#c4a35a]" />
            </p>
            <h2 className="mt-3 max-w-xl font-display text-[2.35rem] leading-[1.02] font-semibold text-[#6d3054] sm:text-5xl md:text-[3.4rem]">
              Our Top 10 Trusted Psychics
            </h2>
            <p className="mt-3 max-w-xl text-sm font-medium text-[#2a2430] md:text-base">
              Ordered by the existing Trusted Psychics ranking, with available advisors first. Only eligible advisors are shown.
            </p>
            <div className="relative mt-2">
              <TrustedCardFan />
              <div className="relative z-10 pt-24 sm:pt-28">
                <PublicTrustedFan advisors={trusted} marketingHost={marketingHost} />
              </div>
            </div>
            <div className="mt-4">
              <Link to="/psychics" search={{ board: "trusted" }} className="text-sm font-semibold text-[#6d3054]">
                View all Trusted Psychics
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
          <OnlineNow advisors={advisors} marketingHost={marketingHost} />

          <FeaturedCategory
            title="Trusted Psychics"
            copy="Verified and trusted advisors with consistent high ratings and positive reviews."
            advisors={featuredTrusted}
            marketingHost={marketingHost}
            board="trusted"
          />
          <FeaturedCategory
            title="Premium Advisors"
            copy="Hand-selected premium advisors. Online first."
            advisors={premium}
            marketingHost={marketingHost}
            board="recommended"
          />
          <FeaturedCategory
            title="Rising Stars"
            copy="New and fast-growing advisors. Online first."
            advisors={rising}
            marketingHost={marketingHost}
            board="new"
          />
          <FeaturedCategory
            title="Elite Psychics"
            copy="Our most experienced and highest-earning advisors."
            advisors={elite}
            marketingHost={marketingHost}
            board="trusted"
          />

          {TOPICS.map((topic) => (
            <TopicBand key={topic.id} topic={topic} advisors={advisors} marketingHost={marketingHost} />
          ))}

          <section id="how-ora-works" className="scroll-mt-24 rounded-[1.75rem] border border-[#efe4ea] bg-white px-5 py-8 md:px-8">
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

          <section id="about" className="pb-2">
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

function FeaturedCategory({
  title,
  copy,
  advisors,
  marketingHost,
  board,
}: {
  title: string;
  copy: string;
  advisors: PublicPsychic[];
  marketingHost: boolean;
  board: "trusted" | "recommended" | "new";
}) {
  if (!advisors.length) return null;
  return (
    <section className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold text-[#2a2430]">{title}</h2>
          <p className="mt-1 text-sm font-medium text-[#72687a]">{copy}</p>
        </div>
        <Link to="/psychics" search={{ board }} className="shrink-0 text-sm font-semibold text-primary">
          See all advisors →
        </Link>
      </div>
      <AdvisorScroller advisors={advisors} marketingHost={marketingHost} showArrows />
    </section>
  );
}

function OnlineNow({ advisors, marketingHost }: { advisors: PublicPsychic[]; marketingHost: boolean }) {
  const [categoryId, setCategoryId] = useState("all");
  const [limit, setLimit] = useState(8);
  const available = advisors.filter((advisor) => presenceState(advisor) === "online");
  const category = categoryId === "all" ? null : publicCategoryById(categoryId);
  const filtered = category ? available.filter((advisor) => advisorMatchesPublicCategory(advisor, category)) : available;
  const shown = filtered.slice(0, limit);

  return (
    <section id="online" className="scroll-mt-24">
      <h2 className="font-display text-3xl font-semibold text-[#2a2430] md:text-4xl">Advisors Online Now</h2>
      <p className="mt-1 text-sm font-medium text-[#5c5366]">
        <span className="font-semibold text-[#2a2430]">{available.length}</span> available to chat. Busy advisors stay marked In Session and are not counted here.
      </p>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <Chip on={categoryId === "all"} onClick={() => { setCategoryId("all"); setLimit(8); }}>
          All
        </Chip>
        {serviceCards().map((item) => (
          <Chip
            key={item.id}
            on={categoryId === item.id}
            onClick={() => {
              setCategoryId(item.id);
              setLimit(8);
            }}
          >
            {item.short}
          </Chip>
        ))}
      </div>
      {shown.length ? <div className="mt-4"><AdvisorScroller advisors={shown} marketingHost={marketingHost} /></div> : (
        <p className="mt-4 text-sm font-medium text-[#72687a]">No advisors are available to chat in this category right now.</p>
      )}
      {filtered.length > shown.length ? (
        <button
          type="button"
          onClick={() => setLimit((current) => current + 8)}
          className="mt-4 inline-flex h-11 items-center rounded-full border border-primary px-5 text-sm font-semibold text-primary"
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}

function Chip({ children, on, onClick }: { children: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "inline-flex h-10 shrink-0 items-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-fg"
          : "inline-flex h-10 shrink-0 items-center rounded-full border border-[#eadfe6] bg-white px-3 text-sm font-semibold text-[#2a2430]"
      }
    >
      {children}
    </button>
  );
}

function TopicBand({
  topic,
  advisors,
  marketingHost,
}: {
  topic: (typeof TOPICS)[number];
  advisors: PublicPsychic[];
  marketingHost: boolean;
}) {
  const ids = topic.id === "soulmate" ? ["soulmate", "love"] : topic.id === "career" ? ["career", "finance"] : topic.id === "spirit" ? ["spiritual", "mediums"] : [topic.category];
  const matched = advisors
    .filter((advisor) => ids.some((id) => {
      const item = publicCategoryById(id);
      return item ? advisorMatchesPublicCategory(advisor, item) : false;
    }))
    .slice(0, 4);
  return (
    <section className="scroll-mt-24">
      <div className="flex items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold text-[#2a2430]">{topic.title}</h2>
          <p className="mt-2 text-sm leading-relaxed font-medium text-[#5c5366]">{topic.copy}</p>
        </div>
        <Link to="/psychics" search={{ category: topic.category }} className="shrink-0 text-sm font-semibold text-primary">
          See advisors
        </Link>
      </div>
      {matched.length ? (
        <div className="mt-4">
          <AdvisorScroller advisors={matched} marketingHost={marketingHost} />
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#72687a]">No live advisors list this focus yet.</p>
      )}
    </section>
  );
}

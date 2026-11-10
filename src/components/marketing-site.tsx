import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdvisorScroller } from "@/components/public-psychic-card";
import { PublicCategoryRail } from "@/components/public-category-rail";
import { PublicFrame } from "@/components/public-frame";
import { PublicHero } from "@/components/public-hero";
import { PublicTrustedFan, TrustedCardFan } from "@/components/public-trusted-fan";
import { listAdvisors, listFloor, type Category } from "@/lib/ora";
import { toPublicPsychic, type PublicPsychic } from "@/lib/ora-domains";
import { FLOOR_POLL_MS, mergeFloor, presenceState } from "@/lib/ora-presence";
import { advisorMatchesCategory, publicCategoryById, serviceCards } from "@/lib/ora-public-categories";
import { newPublicPsychics, recommendedPublicPsychics, trustedPublicPsychics } from "@/lib/ora-public-board";
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

  return (
    <PublicFrame marketingHost={marketingHost} supportEmail={supportEmail}>
      <main>
        <div className="mx-auto max-w-6xl px-4 pt-5">
          <PublicHero />
          <div className="mt-10">
            <PublicCategoryRail />
          </div>
        </div>

        <section id="advisors" className="relative mt-12 scroll-mt-24 overflow-hidden bg-[#fff8f4] py-10 md:py-14">
          <div className="relative z-10 mx-auto max-w-6xl px-4">
            <h2 className="font-display text-3xl font-semibold text-[#2a2430] md:text-4xl">Our Top 10 Trusted Psychics</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium text-[#5c5366]">
              Ordered by the existing Trusted Psychics ranking. Only eligible advisors are shown.
            </p>
            <div className="relative mt-2">
              <TrustedCardFan />
              <div className="relative z-10 pt-24 md:pt-28">
                <PublicTrustedFan advisors={trusted} marketingHost={marketingHost} />
              </div>
            </div>
            <div className="mt-3">
              <Link to="/psychics" search={{ board: "trusted" }} className="text-sm font-semibold text-primary">
                View all Trusted Psychics
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
          <OnlineNow advisors={advisors} marketingHost={marketingHost} />

          {TOPICS.map((topic) => (
            <TopicBand key={topic.id} topic={topic} advisors={advisors} marketingHost={marketingHost} />
          ))}

          <section id="recommended" className="scroll-mt-24">
            <SectionHeading
              title="Recommended Psychics"
              copy="Today's top reviewed advisors, scored from genuine customer reviews."
              search={{ board: "recommended" as const }}
            />
            {recommended.length ? (
              <AdvisorScroller advisors={recommended} marketingHost={marketingHost} />
            ) : (
              <p className="mt-4 text-sm font-medium text-[#72687a]">Recommended psychics appear here from genuine customer reviews.</p>
            )}
          </section>

          <section id="new-psychics" className="scroll-mt-24">
            <SectionHeading
              title="New Psychics"
              copy="Newly approved advisors, newest first."
              search={{ board: "new" as const }}
            />
            {newest.length ? (
              <AdvisorScroller advisors={newest} marketingHost={marketingHost} />
            ) : (
              <p className="mt-4 text-sm font-medium text-[#72687a]">Newly approved psychics appear here after they are activated.</p>
            )}
          </section>

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

function SectionHeading({
  title,
  copy,
  search,
}: {
  title: string;
  copy: string;
  search: { board: "trusted" | "recommended" | "new" };
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-3xl font-semibold text-[#2a2430]">{title}</h2>
        <p className="mt-1 text-sm font-medium text-[#72687a]">{copy}</p>
      </div>
      <Link to="/psychics" search={search} className="shrink-0 text-sm font-semibold text-primary">
        View all
      </Link>
    </div>
  );
}

function OnlineNow({ advisors, marketingHost }: { advisors: PublicPsychic[]; marketingHost: boolean }) {
  const [categoryId, setCategoryId] = useState("all");
  const [limit, setLimit] = useState(8);
  const available = advisors.filter((advisor) => presenceState(advisor) === "online");
  const category = categoryId === "all" ? null : publicCategoryById(categoryId);
  const filtered = category ? available.filter((advisor) => advisorMatchesCategory(advisor.specialties, category)) : available;
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
  const ids = topic.id === "career" ? ["career", "finance"] : topic.id === "spirit" ? ["spiritual", "mediums"] : [topic.category];
  const matched = advisors
    .filter((advisor) => ids.some((id) => {
      const item = publicCategoryById(id);
      return item ? advisorMatchesCategory(advisor.specialties, item) : false;
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

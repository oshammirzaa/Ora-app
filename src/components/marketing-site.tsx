import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CategoryPills, homeCategoryChips } from "@/components/category-pills";
import { OnlineNowCount } from "@/components/chat-now";
import { PublicBanner } from "@/components/public-banner";
import { PublicFrame } from "@/components/public-frame";
import { PublicPsychicCard } from "@/components/public-psychic-card";
import { listAdvisors, listFloor, type Category } from "@/lib/ora";
import { toPublicPsychic, type PublicPsychic } from "@/lib/ora-domains";
import { FLOOR_POLL_MS, mergeFloor, onlineNowCount } from "@/lib/ora-presence";
import {
  filterPublicPsychics,
  newPublicPsychics,
  recommendedPublicPsychics,
  trustedPublicPsychics,
} from "@/lib/ora-public-board";
import { useVisibleInterval } from "@/lib/use-visible-interval";

const HOME_LIMIT = 8;

export function MarketingSite({
  advisors: initialAdvisors,
  categories,
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
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    setAdvisors(initialAdvisors);
  }, [initialAdvisors]);

  useVisibleInterval(
    () => {
      void listFloor()
        .then((floor) => {
          setAdvisors((cur) => mergeFloor(cur, Array.isArray(floor) ? floor : []));
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

  const chips = homeCategoryChips(categories.map((category) => category.name)).filter((name) =>
    ["all", "love", "career", "psychic readings"].includes(name.toLowerCase()) || name === "All",
  );
  const shownChips = chips.length ? chips : ["All", "Love", "Career", "Psychic Readings"];
  const pool = useMemo(() => filterPublicPsychics(advisors, filter), [advisors, filter]);
  const trusted = useMemo(() => trustedPublicPsychics(pool, previewLayout).slice(0, HOME_LIMIT), [pool, previewLayout]);
  const recommended = useMemo(
    () => recommendedPublicPsychics(pool, previewLayout, 40).slice(0, HOME_LIMIT),
    [pool, previewLayout],
  );
  const newest = useMemo(() => newPublicPsychics(pool).slice(0, HOME_LIMIT), [pool]);

  return (
    <PublicFrame marketingHost={marketingHost} supportEmail={supportEmail}>
      <main>
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <PublicBanner marketingHost={marketingHost} />
          <div className="mt-4">
            <CategoryPills chips={shownChips} filter={filter} onChange={setFilter} />
          </div>
          <div className="mt-4">
            <OnlineNowCount count={onlineNowCount(advisors)} />
          </div>
        </div>

        <PsychicSection
          id="trusted"
          title="Trusted Psychics"
          icon={<Crown className="size-5 text-gold" strokeWidth={1.8} />}
          blurb="Top ranked psychics, most free to paid conversions"
          advisors={trusted}
          empty="Trusted Psychics appear here once advisors reach ten genuine free-client sittings."
          viewAll="/psychics"
          marketingHost={marketingHost}
        />
        <PsychicSection
          id="recommended"
          title="Recommended Psychics"
          icon={<Star className="size-5 fill-gold text-gold" />}
          blurb="Highly reviewed by our customers"
          advisors={recommended}
          empty="Recommended psychics appear here from genuine customer reviews."
          viewAll="/psychics?board=recommended"
          marketingHost={marketingHost}
        />
        <PsychicSection
          id="new-psychics"
          title="New Psychics"
          icon={<Sparkles className="size-5 text-primary" strokeWidth={1.8} />}
          blurb="Newly approved advisors, newest first"
          advisors={newest}
          empty="Newly approved psychics appear here after they are activated."
          viewAll="/psychics?board=new"
          marketingHost={marketingHost}
        />

        <section id="about" className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="font-display text-3xl text-fg md:text-4xl">About Ora</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
            Ora is a private place for a live reading. You see the advisor's photo, specialty, rate, and reviews on this site, then continue in the Ora app when you are ready to talk. Your first 3 minutes are free. Entertainment only. Not medical, legal, or financial advice.
          </p>
        </section>
      </main>
    </PublicFrame>
  );
}

function PsychicSection({
  id,
  title,
  icon,
  blurb,
  advisors,
  empty,
  viewAll,
  marketingHost,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  blurb: string;
  advisors: PublicPsychic[];
  empty: string;
  viewAll: string;
  marketingHost: boolean;
}) {
  return (
    <section id={id === "trusted" ? "advisors" : id} className="mx-auto mt-8 max-w-6xl px-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[1.35rem] text-fg md:text-3xl">
            {icon}
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted md:text-sm">{blurb}</p>
        </div>
        <Link
          to="/psychics"
          search={boardSearch(viewAll)}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-muted"
        >
          View All
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {advisors.length ? (
        <ul className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
          {advisors.map((advisor) => (
            <li key={advisor.id} className="w-[11.25rem] shrink-0 snap-start md:w-auto">
              <PublicPsychicCard advisor={advisor} marketingHost={marketingHost} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

function boardSearch(viewAll: string): { board?: "trusted" | "recommended" | "new" } {
  if (viewAll.includes("recommended")) return { board: "recommended" };
  if (viewAll.includes("board=new")) return { board: "new" };
  if (viewAll.endsWith("/psychics")) return { board: "trusted" };
  return {};
}

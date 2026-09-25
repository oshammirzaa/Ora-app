import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Crown, HeartHandshake, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdvisorCard, TalkAgainCard } from "@/components/advisor-cards";
import { AppShell } from "@/components/app-shell";
import { CategoryPills, homeCategoryChips, matchesAdvisorCategory } from "@/components/category-pills";
import { HomeHero } from "@/components/home-hero";
import { OnlineNowCount } from "@/components/chat-now";
import { rememberAdvisors } from "@/lib/client-cache";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isPreviewLayout, listAdvisors, listCategories, listFloor, type Advisor } from "@/lib/ora";
import { listTalkAgain } from "@/lib/ora-favorites";
import { newPsychics } from "@/lib/ora-new";
import { FLOOR_POLL_MS, mergeFloor, onlineNowCount } from "@/lib/ora-presence";
import { recommendByReviews } from "@/lib/ora-recommend";
import { topTrustedPsychics } from "@/lib/ora-rank";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/")({
  staleTime: 120_000,
  loader: async () => {
    const [advisors, categories, previewLayout] = await Promise.all([
      listAdvisors(),
      listCategories(),
      isPreviewLayout(),
    ]);
    rememberAdvisors(advisors);
    return { advisors, categories, previewLayout };
  },
  component: Home,
});

const HOME_GRID = 4;

/** Preview-only layout fill from real advisor rows. Does not invent ranks or reviews. */
function previewFloor(advisors: Advisor[], limit: number, skip = new Set<string>()) {
  return [...advisors]
    .filter((a) => !skip.has(a.id))
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (Number(a.trusted) !== Number(b.trusted)) return a.trusted ? -1 : 1;
      if (b.reviews !== a.reviews) return b.reviews - a.reviews;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function Home() {
  const initial = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [advisors, setAdvisors] = useState(initial.advisors);
  const [categories] = useState(initial.categories);
  const [filter, setFilter] = useState("All");
  const [talkAgain, setTalkAgain] = useState<Advisor[]>([]);
  const previewLayout = initial.previewLayout;

  useEffect(() => {
    setAdvisors(initial.advisors);
    rememberAdvisors(initial.advisors);
  }, [initial]);

  useEffect(() => {
    if (!user) {
      setTalkAgain([]);
      return;
    }
    void listTalkAgain()
      .then(setTalkAgain)
      .catch(() => setTalkAgain([]));
  }, [user]);

  useVisibleInterval(
    () => {
      void listFloor().then((floor) => {
        setAdvisors((cur) => {
          const next = mergeFloor(cur, floor);
          if (next !== cur) rememberAdvisors(next);
          return next;
        });
      });
    },
    FLOOR_POLL_MS,
    true,
    true,
  );

  useVisibleInterval(
    () => {
      void listAdvisors().then((next) => {
        setAdvisors(next);
        rememberAdvisors(next);
      });
    },
    60_000,
    true,
    false,
  );

  const chips = homeCategoryChips(categories.map((c) => c.name));
  const categoryActive = filter !== "All";
  const pool = useMemo(
    () =>
      categoryActive ? advisors.filter((a) => matchesAdvisorCategory(a.specialties, filter)) : advisors,
    [advisors, categoryActive, filter],
  );

  const trustedShown = useMemo(() => {
    const ranked = topTrustedPsychics(pool);
    if (ranked.length) return ranked;
    if (!previewLayout) return [];
    return previewFloor(pool, 10);
  }, [pool, previewLayout]);

  const recommendedAll = useMemo(() => {
    const scored = recommendByReviews(pool, 40);
    if (scored.length) return scored;
    if (!previewLayout) return [];
    return previewFloor(pool, 40, new Set(trustedShown.map((a) => a.id)));
  }, [pool, previewLayout, trustedShown]);
  const recommendedHome = recommendedAll.slice(0, HOME_GRID);

  const newestAll = useMemo(() => newPsychics(pool), [pool]);
  const newestHome = newestAll.slice(0, HOME_GRID);

  const liveNow = onlineNowCount(advisors);

  return (
    <AppShell tab="home">
      <main className="px-4 pt-1 pb-4">
        <HomeHero />

        <div className="mt-4">
          <CategoryPills chips={chips} filter={filter} onChange={setFilter} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <OnlineNowCount count={liveNow} />
          <Link
            to="/advisors"
            preload={false}
            className="inline-flex shrink-0 items-center gap-1 text-sm text-muted"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {talkAgain.length ? (
          <section id="talk-again" className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-display text-[1.35rem] text-fg">
                  <HeartHandshake className="size-5 text-primary" strokeWidth={1.8} />
                  Talk Again
                </h2>
                <p className="mt-0.5 text-xs text-muted">Psychics from your past readings</p>
              </div>
            </div>
            <ul className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
              {talkAgain.map((a) => {
                const live = advisors.find((x) => x.id === a.id);
                return (
                  <li key={a.id}>
                    <TalkAgainCard advisor={live ? { ...a, online: live.online, busy: live.busy } : a} />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section id="trusted" className="mt-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-[1.35rem] text-fg">
                <Crown className="size-5 text-gold" strokeWidth={1.8} />
                Trusted Psychics
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Top ranked psychics, most free to paid conversions
              </p>
            </div>
            <Link
              to="/advisors"
              preload={false}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-muted"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {trustedShown.length ? (
            <ul className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
              {trustedShown.map((a) => (
                <li key={a.id} className="w-[10.75rem] shrink-0">
                  <AdvisorCard advisor={a} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              The last 30 days of Trusted Psychics appear here once advisors reach ten genuine
              free-client sittings.
            </p>
          )}
        </section>

        <section id="recommended" className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-[1.35rem] text-fg">
                <Star className="size-5 fill-gold text-gold" />
                Recommended Psychics
              </h2>
              <p className="mt-0.5 text-xs text-muted">Highly reviewed by our customers</p>
            </div>
            <Link
              to="/advisors"
              search={{ board: "recommended" }}
              preload={false}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-muted"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {recommendedHome.length ? (
            <>
              <TwoRowCards advisors={recommendedHome} />
              <Link
                to="/advisors"
                search={{ board: "recommended" }}
                preload={false}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-fg"
              >
                See all recommended
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Recommended psychics appear here from genuine customer reviews.
            </p>
          )}
        </section>

        <section id="new-psychics" className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-[1.35rem] text-fg">
                <Sparkles className="size-5 text-primary" strokeWidth={1.8} />
                New Psychics
              </h2>
              <p className="mt-0.5 text-xs text-muted">Newly approved advisors, newest first</p>
            </div>
            <Link
              to="/advisors"
              search={{ board: "new" }}
              preload={false}
              className="inline-flex shrink-0 items-center gap-1 text-sm text-muted"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {newestHome.length ? (
            <>
              <TwoRowCards advisors={newestHome} />
              <Link
                to="/advisors"
                search={{ board: "new" }}
                preload={false}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1 rounded-full bg-surface text-sm font-medium text-fg shadow-[var(--shadow-border)]"
              >
                See all new psychics
                <ArrowRight className="size-3.5" />
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Newly approved psychics appear here after the owner activates them.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function TwoRowCards({ advisors }: { advisors: Advisor[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-3">
      {advisors.map((a) => (
        <li key={a.id}>
          <AdvisorCard advisor={a} />
        </li>
      ))}
    </ul>
  );
}

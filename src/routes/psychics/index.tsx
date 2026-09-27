import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CategoryPills, homeCategoryChips } from "@/components/category-pills";
import { OnlineNowCount } from "@/components/chat-now";
import { PublicFrame } from "@/components/public-frame";
import { PublicPsychicCard } from "@/components/public-psychic-card";
import { isPreviewLayout, listAdvisors, listCategories, listFloor } from "@/lib/ora";
import { toPublicPsychic, type PublicPsychic } from "@/lib/ora-domains";
import { emptyMarketingPage } from "@/lib/ora-marketing-copy";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";
import { FLOOR_POLL_MS, mergeFloor, onlineNowCount } from "@/lib/ora-presence";
import { filterPublicPsychics, publicDirectory, type PublicBoard } from "@/lib/ora-public-board";
import { useVisibleInterval } from "@/lib/use-visible-interval";

type PsychicSearch = { board?: PublicBoard };

export const Route = createFileRoute("/psychics/")({
  staleTime: 60_000,
  validateSearch: (search: Record<string, unknown>): PsychicSearch => {
    const board = search.board;
    if (board === "trusted" || board === "recommended" || board === "new") return { board };
    return {};
  },
  loader: async () => {
    const [advisors, categories, previewLayout, host, marketing] = await Promise.all([
      listAdvisors(),
      listCategories(),
      isPreviewLayout(),
      loadMarketingHost().catch(() => ({ marketingHost: false })),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
    ]);
    return {
      advisors: advisors.map((advisor) => toPublicPsychic(advisor)),
      categories,
      previewLayout,
      marketingHost: host.marketingHost,
      supportEmail: marketing.supportEmail,
    };
  },
  head: () => ({
    meta: [
      { title: "Psychic Advisors | Ora Psychic" },
      {
        name: "description",
        content: "Browse live Ora advisors. See photos, specialties, ratings, and per-minute rates before you start a reading.",
      },
      { property: "og:title", content: "Psychic Advisors | Ora Psychic" },
      { property: "og:url", content: "https://orapsychic.com/psychics" },
    ],
    links: [{ rel: "canonical", href: "https://orapsychic.com/psychics" }],
  }),
  component: PsychicDirectory,
});

const TITLES: Record<PublicBoard | "all", string> = {
  all: "Advisors",
  trusted: "Trusted Psychics",
  recommended: "Recommended Psychics",
  new: "New Psychics",
};

function PsychicDirectory() {
  const initial = Route.useLoaderData();
  const { board } = Route.useSearch();
  const [advisors, setAdvisors] = useState(initial.advisors);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    setAdvisors(initial.advisors);
  }, [initial.advisors]);

  useVisibleInterval(
    () => {
      void listFloor()
        .then((floor) => setAdvisors((cur) => mergeFloor(cur, Array.isArray(floor) ? floor : [])))
        .catch(() => undefined);
    },
    FLOOR_POLL_MS,
    true,
    true,
  );

  const chips = homeCategoryChips(initial.categories.map((category) => category.name)).filter((name) =>
    ["all", "love", "career", "psychic readings"].includes(name.toLowerCase()),
  );
  const pool = useMemo(() => filterPublicPsychics(advisors, filter), [advisors, filter]);
  const shown = useMemo(
    () => publicDirectory(pool, board, initial.previewLayout),
    [pool, board, initial.previewLayout],
  );

  return (
    <PublicFrame marketingHost={initial.marketingHost} supportEmail={initial.supportEmail}>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl text-fg">{TITLES[board || "all"]}</h1>
            <p className="mt-2 text-sm text-muted">Live profiles published on Ora. No sample advisors.</p>
          </div>
          <Link to="/" className="text-sm text-primary">
            Back to Ora
          </Link>
        </div>
        <div className="mt-4">
          <CategoryPills chips={chips.length ? chips : ["All", "Love", "Career", "Psychic Readings"]} filter={filter} onChange={setFilter} />
        </div>
        <div className="mt-4">
          <OnlineNowCount count={onlineNowCount(advisors)} />
        </div>
        {shown.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((advisor: PublicPsychic) => (
              <li key={advisor.id}>
                <PublicPsychicCard advisor={advisor} marketingHost={initial.marketingHost} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted">No advisors match this view yet.</p>
        )}
      </main>
    </PublicFrame>
  );
}

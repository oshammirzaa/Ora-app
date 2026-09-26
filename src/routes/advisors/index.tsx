import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdvisorCard, AdvisorRenderBoundary, AdvisorRow } from "@/components/advisor-cards";
import { AppShell } from "@/components/app-shell";
import { CategoryPills, homeCategoryChips, matchesAdvisorCategory } from "@/components/category-pills";
import { OnlineNowCount } from "@/components/chat-now";
import { rememberAdvisors } from "@/lib/client-cache";
import { listAdvisors, listCategories, listFloor } from "@/lib/ora";
import { newPsychics } from "@/lib/ora-new";
import { FLOOR_POLL_MS, mergeFloor, onlineNowCount, presenceSortRank } from "@/lib/ora-presence";
import { recommendByReviews } from "@/lib/ora-recommend";
import { isTrustedPsychicsFilter, selectTrustedPsychics } from "@/lib/ora-rank";
import { useVisibleInterval } from "@/lib/use-visible-interval";

type AdvisorsSearch = { board?: "recommended" | "new" };

export const Route = createFileRoute("/advisors/")({
  staleTime: 120_000,
  validateSearch: (search: Record<string, unknown>): AdvisorsSearch => {
    const board = search.board;
    if (board === "recommended" || board === "new") return { board };
    return {};
  },
  loader: async () => {
    const [advisors, categories] = await Promise.all([listAdvisors(), listCategories()]);
    rememberAdvisors(advisors);
    return { advisors, categories };
  },
  component: AdvisorsIndex,
});

function AdvisorsIndex() {
  const initial = Route.useLoaderData();
  const { board } = Route.useSearch();
  const [advisors, setAdvisors] = useState(initial.advisors);
  const [categories] = useState(initial.categories);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    setAdvisors(initial.advisors);
    rememberAdvisors(initial.advisors);
  }, [initial]);

  useVisibleInterval(
    () => {
      void listFloor()
        .then((floor) => {
          setAdvisors((cur) => {
            const next = mergeFloor(Array.isArray(cur) ? cur : [], Array.isArray(floor) ? floor : []);
            if (next !== cur) rememberAdvisors(next);
            return next;
          });
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
          setAdvisors(next);
          rememberAdvisors(next);
        })
        .catch(() => undefined);
    },
    60_000,
    true,
    false,
  );

  const chips = homeCategoryChips(categories.map((c) => c.name));
  const trustedFilter = isTrustedPsychicsFilter(filter);
  const shown = useMemo(() => {
    try {
      const rows = Array.isArray(advisors) ? advisors : [];
      if (board === "recommended") return recommendByReviews(rows, 40);
      if (board === "new") return newPsychics(rows);
      if (trustedFilter) return selectTrustedPsychics(rows);
      const filtered =
        filter === "All"
          ? rows
          : rows.filter((a) => matchesAdvisorCategory(a?.specialties, filter));
      return [...filtered].sort((a, b) => {
        const presence = presenceSortRank(a) - presenceSortRank(b);
        if (presence) return presence;
        if ((Number(b?.rating) || 0) !== (Number(a?.rating) || 0)) return (Number(b?.rating) || 0) - (Number(a?.rating) || 0);
        return (Number(b?.reviews) || 0) - (Number(a?.reviews) || 0);
      });
    } catch {
      return [];
    }
  }, [advisors, filter, trustedFilter, board]);
  const liveNow = onlineNowCount(advisors);
  const title =
    board === "recommended" ? "Recommended Psychics" : board === "new" ? "New Psychics" : trustedFilter ? "Trusted Psychics" : "All Psychics";
  const subtitle =
    board === "recommended"
      ? "Highly reviewed by our customers."
      : board === "new"
        ? "Newly approved advisors, newest first."
        : trustedFilter
          ? "Last 30 days, ranked by free-to-paid conversion."
          : null;

  return (
    <AppShell tab="home">
      <main className="px-4 pt-3 pb-6">
        <p className="text-xs tracking-wide text-muted uppercase">
          <Link to="/" preload={false} className="text-primary">
            Home
          </Link>
          <span className="text-faint"> / {title}</span>
        </p>
        <h1 className="mt-1 font-display text-3xl text-fg">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {subtitle ? subtitle : <OnlineNowCount count={liveNow} />}
        </p>

        {board ? null : (
          <div className="mt-4">
            <CategoryPills chips={chips} filter={filter} onChange={setFilter} />
          </div>
        )}

        {board === "recommended" || board === "new" || trustedFilter ? (
          shown.length ? (
            <ul className="mt-5 grid grid-cols-2 gap-3">
              {shown.map((a, index) => (
                <li key={a.id}>
                  <AdvisorRenderBoundary>
                    <AdvisorCard advisor={a} showRank={trustedFilter && !board} rank={trustedFilter && !board ? index + 1 : undefined} />
                  </AdvisorRenderBoundary>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted">
              {board === "new"
                ? "Newly approved psychics appear here after the owner activates them."
                : board === "recommended"
                  ? "Recommended psychics appear here from genuine customer reviews."
                  : "Trusted Psychics appear here once advisors reach ten genuine free-client sittings in the last 30 days."}
            </p>
          )
        ) : (
          <ul className="mt-5 space-y-3">
            {shown.map((a) => (
              <li key={a.id}>
                <AdvisorRenderBoundary>
                  <AdvisorRow advisor={a} />
                </AdvisorRenderBoundary>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

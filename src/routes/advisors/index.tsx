import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdvisorCard, AdvisorRow } from "@/components/advisor-cards";
import { AppShell } from "@/components/app-shell";
import { rememberAdvisors } from "@/lib/client-cache";
import { listAdvisors, listCategories, listFloor, type Advisor } from "@/lib/ora";
import { TRUSTED_PSYCHICS, isTrustedPsychicsFilter, topTrustedPsychics } from "@/lib/ora-rank";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/advisors/")({
  staleTime: 120_000,
  loader: async () => {
    const [advisors, categories] = await Promise.all([listAdvisors(), listCategories()]);
    rememberAdvisors(advisors);
    return { advisors, categories };
  },
  component: AdvisorsIndex,
});

function mergeFloor(advisors: Advisor[], floor: { id: string; online: boolean; busy: boolean }[]) {
  const map = new Map(floor.map((f) => [f.id, f]));
  let changed = false;
  const next = advisors.map((a) => {
    const f = map.get(a.id);
    if (!f || (f.online === a.online && f.busy === a.busy)) return a;
    changed = true;
    return { ...a, online: f.online, busy: f.busy };
  });
  return changed ? next : advisors;
}

function AdvisorsIndex() {
  const initial = Route.useLoaderData();
  const [advisors, setAdvisors] = useState(initial.advisors);
  const [categories] = useState(initial.categories);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    setAdvisors(initial.advisors);
    rememberAdvisors(initial.advisors);
  }, [initial]);

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
    8000,
    true,
    false,
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

  const chips = ["All", TRUSTED_PSYCHICS, ...categories.map((c) => c.name)];
  const trustedFilter = isTrustedPsychicsFilter(filter);
  const shown = useMemo(() => {
    if (trustedFilter) return topTrustedPsychics(advisors);
    const filtered =
      filter === "All"
        ? advisors
        : advisors.filter((a) => a.specialties.toLowerCase().includes(filter.toLowerCase()));
    return [...filtered].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviews - a.reviews;
    });
  }, [advisors, filter, trustedFilter]);
  const liveNow = advisors.filter((a) => a.online).length;

  return (
    <AppShell tab="home">
      <main className="px-4 pt-5 pb-6">
        <p className="text-xs tracking-wide text-faint uppercase">
          <Link to="/" preload={false} className="text-primary">
            Home
          </Link>
          <span className="text-faint"> / All psychics</span>
        </p>
        <h1 className="mt-1 font-display text-3xl">{trustedFilter ? "Trusted Psychics" : "All psychics"}</h1>
        <p className="mt-1 text-sm text-muted">
          {trustedFilter ? (
            "This month's free-to-paid conversion Top 10."
          ) : (
            <>
              <span className="tabular-nums text-primary">{liveNow}</span>{" "}
              {liveNow === 1 ? "psychic" : "psychics"} live now
            </>
          )}
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {chips.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "h-9 shrink-0 rounded-full bg-primary px-3 text-sm font-medium text-primary-fg"
                  : "h-9 shrink-0 rounded-full bg-elevated px-3 text-sm text-muted"
              }
            >
              {f}
            </button>
          ))}
        </div>

        {trustedFilter ? (
          shown.length ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((a) => (
                <li key={a.id}>
                  <AdvisorCard advisor={a} showRank />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted">
              This month's Trusted Psychics ranking appears here once advisors reach ten genuine
              free-client sittings.
            </p>
          )
        ) : (
          <ul className="mt-5 space-y-3">
            {shown.map((a) => (
              <li key={a.id}>
                <AdvisorRow advisor={a} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

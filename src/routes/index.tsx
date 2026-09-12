import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdvisorCard, AdvisorRow } from "@/components/advisor-cards";
import { AppShell } from "@/components/app-shell";
import { rememberAdvisors } from "@/lib/client-cache";
import { listAdvisors, listCategories, listFloor, type Advisor } from "@/lib/ora";
import { recommendByReviews } from "@/lib/ora-recommend";
import { TRUSTED_PSYCHICS, isTrustedPsychicsFilter, topTrustedPsychics } from "@/lib/ora-rank";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/")({
  staleTime: 120_000,
  loader: async () => {
    const [advisors, categories] = await Promise.all([listAdvisors(), listCategories()]);
    rememberAdvisors(advisors);
    return { advisors, categories };
  },
  component: Home,
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

function Home() {
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
  const shown = useMemo(
    () =>
      filter === "All"
        ? advisors
        : advisors.filter((a) => a.specialties.toLowerCase().includes(filter.toLowerCase())),
    [advisors, filter],
  );
  const fresh = trustedFilter ? [] : shown.filter((a) => a.isNew && !a.trusted);
  const rest = trustedFilter ? [] : shown.filter((a) => !a.trusted && !a.isNew);
  const liveNow = advisors.filter((a) => a.online).length;
  const topTrusted = useMemo(() => topTrustedPsychics(advisors), [advisors]);
  const recommended = useMemo(
    () => (trustedFilter ? [] : recommendByReviews(advisors, 8)),
    [advisors, trustedFilter],
  );

  return (
    <AppShell tab="home">
      <main className="px-4 pt-5 pb-6">
        <section className="relative overflow-hidden px-2 py-8 text-center">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-[-6%] -translate-y-1/2 select-none font-display text-[6.5rem] leading-none text-primary/10"
          >
            ORA
          </span>
          <MoonMark />
          <LeafMark className="absolute bottom-2 left-[-6px] h-24 w-16 text-faint/70" />
          <LeafMark className="absolute right-[-8px] bottom-6 h-20 w-14 rotate-180 text-faint/60" />
          <StarMark className="absolute top-5 left-[22%] size-2.5 text-primary" />
          <StarMark className="absolute top-10 right-[28%] size-2 text-primary" />
          <StarMark className="absolute bottom-8 left-[30%] size-1.5 text-primary" />
          <StarMark className="absolute top-16 right-[12%] size-1.5 text-faint" />

          <p className="relative text-[10px] tracking-[0.32em] text-primary uppercase">
            Guidance · Clarity · A brighter you
          </p>
          <LotusRule />
          <h1 className="relative mt-3 font-display text-3xl leading-[0.95] tracking-[0.08em] uppercase sm:text-4xl">
            3 Free Minutes
          </h1>
          <p className="relative mt-2 font-display text-xl leading-tight tracking-[0.06em] text-fg uppercase sm:text-2xl">
            On your first sign in
          </p>
          <LotusRule />
          <p className="relative mt-3 text-xs tracking-[0.22em] text-faint uppercase sm:text-sm">
            Then $10 / week or use coins
          </p>
        </section>

        <p className="mt-3 text-center text-sm text-muted">
          <span className="tabular-nums text-primary">{liveNow}</span>{" "}
          {liveNow === 1 ? "psychic" : "psychics"} live now
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

        {recommended.length ? (
          <section className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-xl">Recommended Psychics</h2>
              <Link to="/advisors" preload={false} className="shrink-0 text-sm text-primary">
                View all psychics
              </Link>
            </div>
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {recommended.map((a) => (
                <li key={a.id} className="w-36 shrink-0">
                  <AdvisorCard advisor={a} />
                </li>
              ))}
            </ul>
            <Link
              to="/advisors"
              preload={false}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              View all psychics
            </Link>
          </section>
        ) : null}

        {trustedFilter ? (
          <section className="mt-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="font-display text-xl">Trusted Psychics</h2>
            </div>
            <p className="mt-1 text-xs text-muted">This month's free-to-paid conversion Top 10.</p>
            {topTrusted.length ? (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {topTrusted.map((a) => (
                  <li key={a.id}>
                    <AdvisorCard advisor={a} showRank />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">
                This month's Trusted Psychics ranking appears here once advisors reach ten genuine
                free-client sittings.
              </p>
            )}
          </section>
        ) : null}

        {fresh.length ? (
          <section className="mt-8">
            <h2 className="font-display text-xl">New advisors</h2>
            <p className="mt-1 text-xs text-muted">{fresh.length} just joined the floor.</p>
            <ul className="mt-3 space-y-3">
              {fresh.map((a) => (
                <li key={a.id}>
                  <AdvisorRow advisor={a} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {rest.length ? (
          <section className="mt-8">
            <h2 className="font-display text-xl">More on the floor</h2>
            <ul className="mt-3 space-y-3">
              {rest.map((a) => (
                <li key={a.id}>
                  <AdvisorRow advisor={a} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function LotusRule() {
  return (
    <div className="relative mt-4 flex items-center justify-center gap-3 text-primary" aria-hidden>
      <span className="h-px w-14 bg-primary" />
      <svg viewBox="0 0 48 28" className="h-5 w-8 fill-current">
        <path d="M24 26c0-8-6-12-12-14 8 1 11-5 12-10 1 5 4 11 12 10-6 2-12 6-12 14z" />
        <path d="M24 26c-4-8-12-10-16-8 6-2 8-8 8-12 4 6 8 10 8 20z" opacity=".55" />
        <path d="M24 26c4-8 12-10 16-8-6-2-8-8-8-12-4 6-8 10-8 20z" opacity=".55" />
      </svg>
      <span className="h-px w-14 bg-primary" />
    </div>
  );
}

function MoonMark() {
  return (
    <span className="pointer-events-none absolute top-6 left-1 text-primary" aria-hidden>
      <svg viewBox="0 0 64 64" className="size-14 fill-current sm:size-16">
        <path d="M40 8c-14 5-24 18-24 32 0 11 5 21 13 28C14 62 4 48 4 32 4 14 16 2 34 2c2 0 4 0 6 .4C36 4 38 6 40 8z" />
        <path d="M46 10l1.2 3.8L51 15l-3.8 1.2L46 20l-1.2-3.8L41 15l3.8-1.2z" />
      </svg>
    </span>
  );
}

function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 0 13.8 8.2 22 10 13.8 11.8 12 20 10.2 11.8 2 10 10.2 8.2z"
      />
    </svg>
  );
}

function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 72" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M8 64c18-6 28-24 26-44 10 16 8 38-18 48C12 70 8 68 8 64z"
      />
      <path
        fill="currentColor"
        d="M18 58c10-8 16-22 14-36 8 12 6 28-10 36z"
        opacity=".45"
      />
    </svg>
  );
}

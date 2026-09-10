import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdvisorMedia } from "@/components/advisor-media";
import { AppShell } from "@/components/app-shell";
import { ChatNow, PresenceBadge } from "@/components/chat-now";
import { rememberAdvisors } from "@/lib/client-cache";
import { listAdvisors, listCategories, listFloor, type Advisor } from "@/lib/ora";
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

  const chips = ["All", ...categories.map((c) => c.name)];
  const shown = useMemo(
    () =>
      filter === "All"
        ? advisors
        : advisors.filter((a) => a.specialties.toLowerCase().includes(filter.toLowerCase())),
    [advisors, filter],
  );
  const trusted = shown.filter((a) => a.trusted);
  const fresh = shown.filter((a) => a.isNew && !a.trusted);
  const rest = shown.filter((a) => !a.trusted && !a.isNew);
  const liveNow = advisors.filter((a) => a.online && !a.busy).length;

  return (
    <AppShell tab="home">
      <main className="px-4 pt-5 pb-6">
        <p className="text-xs tracking-wide text-faint uppercase">Live now · {liveNow} advisors</p>
        <h1 className="mt-1 font-display text-3xl">Choose an advisor</h1>
        <p className="mt-1 text-sm text-muted">Three free minutes on first sign-in. Then $10 / week or coins.</p>

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

        {trusted.length ? (
          <section className="mt-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="font-display text-xl">Top trusted</h2>
            </div>
            <p className="mt-1 text-xs text-muted">Highest rated. Longest on the floor.</p>
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {trusted.map((a) => (
                <li key={a.id} className="w-36 shrink-0">
                  <TrustedCard advisor={a} />
                </li>
              ))}
            </ul>
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

function Rating({ advisor }: { advisor: Advisor }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary">
      <Star className="size-3 fill-primary text-primary" />
      {advisor.rating.toFixed(1)}
      <span className="text-faint">({advisor.reviews})</span>
    </span>
  );
}

function TrustedCard({ advisor }: { advisor: Advisor }) {
  return (
    <div>
      <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false} className="block">
        <div className="relative aspect-3/4 overflow-hidden rounded-xl bg-elevated">
          <AdvisorMedia photo={advisor.photoUrl} />
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-xs text-primary">
            <ShieldCheck className="size-3" />
            Trusted
          </span>
          <PresenceBadge advisor={advisor} className="absolute bottom-2 left-2" />
        </div>
        <p className="mt-2 truncate font-display text-base leading-tight">{advisor.name}</p>
        <p className="truncate text-xs text-muted">{advisor.specialties}</p>
        <Rating advisor={advisor} />
      </Link>
      <p className="mt-1 text-xs text-primary">{advisor.rateCoins}c / min</p>
      <ChatNow advisor={advisor} className="mt-2 h-9 w-full px-2 text-xs" />
    </div>
  );
}

function AdvisorRow({ advisor }: { advisor: Advisor }) {
  return (
    <div className="flex gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <Link
        to="/advisors/$id"
        params={{ id: advisor.slug }}
        preload={false}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-elevated"
      >
        <AdvisorMedia photo={advisor.photoUrl} />
        <PresenceBadge advisor={advisor} className="absolute bottom-1 left-1 scale-90" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false}>
          <div className="flex items-center gap-2">
            <p className="font-display text-lg leading-tight">{advisor.name}</p>
            {advisor.isNew ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                New
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted">{advisor.specialties}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <Rating advisor={advisor} />
            <span className="text-xs text-primary">{advisor.rateCoins}c / min</span>
          </div>
        </Link>
        <ChatNow advisor={advisor} className="mt-2 h-9 px-3 text-xs" />
      </div>
    </div>
  );
}

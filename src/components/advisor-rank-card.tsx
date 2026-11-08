import { useEffect, useState } from "react";
import { advisorRankProgress } from "@/lib/ora-advisor-rank-api";
import { RANK_ONE_MESSAGE, formatRankUsd, overtakeMessage } from "@/lib/ora-earnings-rank";
import { useVisibleInterval } from "@/lib/use-visible-interval";

type View = Awaited<ReturnType<typeof advisorRankProgress>>;

export function AdvisorRankCard() {
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    let alive = true;
    void advisorRankProgress()
      .then((next) => {
        if (alive) setView(next);
      })
      .catch(() => {
        if (alive) setView(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useVisibleInterval(() => {
    void advisorRankProgress()
      .then((next) => setView(next))
      .catch(() => undefined);
  }, 60_000, true, false);

  if (!view) return null;
  if (!view.included) {
    return (
      <section className="mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="text-xs tracking-wide text-faint uppercase">Trusted Psychic rank</p>
        <p className="mt-2 text-sm text-muted">{view.message}</p>
        <p className="mt-2 text-sm text-fg">Your earnings {formatRankUsd(view.earningsCents)}</p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-[#ead9b0] bg-[#fffdf8] p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-[#8d6b32] uppercase">Trusted Psychic rank</p>
      {view.leader ? (
        <p className="mt-2 font-display text-2xl text-[#6d3d78]">{RANK_ONE_MESSAGE}</p>
      ) : (
        <>
          <p className="mt-2 font-display text-3xl text-fg">Advisor Rank: #{view.rank}</p>
          <dl className="mt-3 space-y-1 text-sm text-fg">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Your Earnings</dt>
              <dd>{formatRankUsd(view.earningsCents)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Rank #{view.aboveRank} Earnings</dt>
              <dd>{formatRankUsd(view.aboveCents ?? 0)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-medium text-[#6d3d78]">{overtakeMessage(view)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f3e7c8]" aria-hidden>
            <div className="h-full rounded-full bg-[#6d3d78]" style={{ width: `${view.progressPercent}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{view.progressPercent}% of the way to the next rank</p>
        </>
      )}
      {view.leader ? <p className="mt-2 text-sm text-muted">Your earnings {formatRankUsd(view.earningsCents)}</p> : null}
    </section>
  );
}

/** Eligible advisor earnings, in cents. 1 coin = 10 cents. Customer payments are not the rank. */

export const COIN_TO_CENTS = 10;
export const TOP_EARNINGS_RANK = 10;
export const RANK_ONE_MESSAGE = "Congratulations! You are the #1 Trusted Psychic on Ora Psychic!";

export const VOID_EARNING_STATUSES = ["clawed", "reversed", "refunded", "void", "invalid"] as const;

/** Reading earnings counted for rank: the stored advisor share, never the customer's coins. */
export const READING_EARNINGS_SQL = `
select r.id, r.advisor_id, greatest(r.advisor_earned, 0)::int as coins,
       coalesce(r.ended_at, r.started_at) as at
from ora_readings r
where r.status in ('ended', 'completed')
  and coalesce(r.advisor_earned, 0) > 0
  and r.client_id not like 'qa:%'
  and r.client_id not like 'test:%'
  and not exists (
    select 1 from ora_earnings e
    where e.reading_id = r.id
      and e.status in ('clawed', 'reversed', 'refunded', 'void', 'invalid')
  )`;

export const MESSAGE_EARNINGS_SQL = `
select m.id, m.advisor_id, greatest(m.advisor_share_cents, 0)::int as cents, m.created_at as at
from ora_paid_messages m
where m.credited = true and coalesce(m.coins, 0) > 0 and coalesce(m.advisor_share_cents, 0) > 0
  and m.customer_id not like 'qa:%'
  and m.customer_id not like 'test:%'`;

export const TIP_EARNINGS_SQL = `
select t.id, t.advisor_id, greatest(t.advisor_share_coins, 0)::int as coins, t.created_at as at
from ora_customer_tips t
where t.charged = true and t.credited = true and coalesce(t.advisor_share_coins, 0) > 0
  and t.customer_id not like 'qa:%'
  and t.customer_id not like 'test:%'`;

export type EarningSource = "reading" | "message" | "tip";

export type EligibleEarning = {
  advisorId: string;
  source: EarningSource;
  id: string;
  cents: number;
  at: number;
  voided?: boolean;
};

export type AdvisorEarningTotal = {
  advisorId: string;
  cents: number;
  reachedAt: number | null;
};

export type RankedAdvisor = AdvisorEarningTotal & { rank: number };

export type RankProgress = {
  rank: number;
  earningsCents: number;
  aboveRank: number | null;
  aboveCents: number | null;
  centsToNext: number | null;
  progressPercent: number;
  leader: boolean;
};

export function readingCents(advisorEarnedCoins: number) {
  return Math.max(0, Math.trunc(Number(advisorEarnedCoins) || 0)) * COIN_TO_CENTS;
}

export function formatRankUsd(cents: number) {
  const safe = Math.max(0, Math.trunc(Number(cents) || 0));
  const dollars = Math.floor(safe / 100);
  const rem = safe % 100;
  const whole = dollars.toLocaleString("en-US");
  if (rem === 0) return `$${whole}`;
  return `$${whole}.${String(rem).padStart(2, "0")}`;
}

/** One row per source id. Refunded, reversed, and non-positive rows are left out. */
export function eligibleAdvisorTotals(entries: readonly EligibleEarning[]): AdvisorEarningTotal[] {
  const seen = new Set<string>();
  const by = new Map<string, AdvisorEarningTotal>();
  const ordered = [...entries].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (const entry of ordered) {
    if (entry.voided) continue;
    const cents = Math.trunc(Number(entry.cents) || 0);
    if (!entry.advisorId || cents <= 0) continue;
    const key = `${entry.source}:${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = by.get(entry.advisorId) ?? { advisorId: entry.advisorId, cents: 0, reachedAt: null };
    current.cents += cents;
    current.reachedAt = Number.isFinite(entry.at) ? entry.at : current.reachedAt;
    by.set(entry.advisorId, current);
  }
  return [...by.values()];
}

/**
 * Highest eligible earnings is rank 1. Every eligible advisor is ranked, including $0.
 * Ties go to whoever reached that total first, then a stable advisor id.
 */
export function rankEligibleAdvisors(
  totals: readonly AdvisorEarningTotal[],
  eligibleIds?: readonly string[],
): RankedAdvisor[] {
  const rows = totals.map((row) => ({
    advisorId: row.advisorId,
    cents: Math.max(0, Math.trunc(Number(row.cents) || 0)),
    reachedAt: row.reachedAt,
  }));
  if (eligibleIds) {
    const present = new Set(rows.map((row) => row.advisorId));
    for (const id of eligibleIds) {
      if (!id || present.has(id)) continue;
      present.add(id);
      rows.push({ advisorId: id, cents: 0, reachedAt: null });
    }
    const allow = new Set(eligibleIds);
    return assignRanks(rows.filter((row) => allow.has(row.advisorId)));
  }
  return assignRanks(rows);
}

function assignRanks(rows: AdvisorEarningTotal[]): RankedAdvisor[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.cents !== a.cents) return b.cents - a.cents;
    const aAt = a.reachedAt == null ? Number.POSITIVE_INFINITY : a.reachedAt;
    const bAt = b.reachedAt == null ? Number.POSITIVE_INFINITY : b.reachedAt;
    if (aAt !== bAt) return aAt - bAt;
    return a.advisorId.localeCompare(b.advisorId);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Cents needed to pass the advisor directly above. One cent more than their total. */
export function centsToOvertake(mineCents: number, aboveCents: number) {
  const mine = Math.max(0, Math.trunc(mineCents) || 0);
  const above = Math.max(0, Math.trunc(aboveCents) || 0);
  return above - mine + 1;
}

export function rankingProgress(board: readonly RankedAdvisor[], advisorId: string): RankProgress | null {
  const mine = board.find((row) => row.advisorId === advisorId);
  if (!mine) return null;
  if (mine.rank === 1) {
    return {
      rank: 1,
      earningsCents: mine.cents,
      aboveRank: null,
      aboveCents: null,
      centsToNext: null,
      progressPercent: 100,
      leader: true,
    };
  }
  const above = board.find((row) => row.rank === mine.rank - 1);
  if (!above) return null;
  const needed = centsToOvertake(mine.cents, above.cents);
  const goal = mine.cents + needed;
  const progressPercent = goal <= 0 ? 100 : Math.min(100, Math.floor((mine.cents * 100) / goal));
  return {
    rank: mine.rank,
    earningsCents: mine.cents,
    aboveRank: above.rank,
    aboveCents: above.cents,
    centsToNext: needed,
    progressPercent,
    leader: false,
  };
}

export function overtakeMessage(progress: RankProgress) {
  if (progress.leader || progress.centsToNext == null || progress.aboveRank == null) return RANK_ONE_MESSAGE;
  return `Earn ${formatRankUsd(progress.centsToNext)} more to reach Rank #${progress.aboveRank}.`;
}

/** Customer boards receive rank only. Earnings stay off this object. */
export function customerRank(row: { advisorId: string; rank: number; cents?: number }) {
  return {
    advisorId: row.advisorId,
    rank: row.rank >= 1 && row.rank <= TOP_EARNINGS_RANK ? row.rank : null,
  };
}

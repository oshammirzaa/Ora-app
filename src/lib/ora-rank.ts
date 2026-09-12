/** Minimum unique free clients before an advisor can appear in the monthly ranking. */
export const MIN_FREE_CLIENTS = 10;
/** Public Trusted Psychics board is #1–#10. */
export const TOP_RANK_LIMIT = 10;
/** Public category tab for the monthly conversion Top 10. */
export const TRUSTED_PSYCHICS = "Trusted Psychics";

export function isTrustedPsychicsFilter(filter: string) {
  return filter === TRUSTED_PSYCHICS;
}

export function topTrustedPsychics<T extends { monthlyRank: number | null }>(advisors: T[]): T[] {
  return advisors
    .filter((a) => {
      const rank = a.monthlyRank;
      return typeof rank === "number" && rank >= 1 && rank <= TOP_RANK_LIMIT;
    })
    .sort((a, b) => (a.monthlyRank ?? 99) - (b.monthlyRank ?? 99))
    .slice(0, TOP_RANK_LIMIT);
}
/** Drop accidental/cancelled-like flashes that never became a real sitting. */
export const MIN_GENUINE_SECONDS = 30;

export const MONTHLY_RANK_TABLE_SQL = `
create table if not exists ora_monthly_rank (
  month date not null,
  advisor_id text not null,
  eligible_free_clients integer not null default 0,
  converted_paid_clients integer not null default 0,
  conversion_rate numeric(6,4) not null default 0,
  paid_session_revenue integer not null default 0,
  eligible boolean not null default false,
  rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  computed_at timestamptz not null default now(),
  primary key (month, advisor_id)
)`;

export const MONTHLY_RANK_INDEX_SQL = `
create index if not exists ora_monthly_rank_month_rank_idx
  on ora_monthly_rank (month, rank)`;

export type RankSession = {
  id: string;
  clientId: string;
  advisorId: string;
  startedAt: number;
  seconds: number;
  coinsSpent: number;
  bonusUsed: number;
  weeklyUsed: number;
  status: string;
  test?: boolean;
};

export type AdvisorMonthStats = {
  advisorId: string;
  eligibleFreeClients: number;
  convertedPaidClients: number;
  conversionRate: number;
  paidSessionRevenue: number;
  eligible: boolean;
  rank: number | null;
};

export function monthStartUtc(at = Date.now()): string {
  const d = new Date(at);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function monthEndUtc(month: string): string {
  const start = new Date(`${month}T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return end.toISOString();
}

export function isGenuineSession(s: RankSession): boolean {
  if (s.test) return false;
  if (s.status !== "ended") return false;
  if (!Number.isFinite(s.startedAt) || s.startedAt <= 0) return false;
  if (s.seconds < MIN_GENUINE_SECONDS) return false;
  if (s.coinsSpent < 0 || s.bonusUsed < 0 || s.weeklyUsed < 0) return false;
  return true;
}

export function usedFree(s: RankSession): boolean {
  return s.bonusUsed + s.weeklyUsed > 0;
}

export function usedPaid(s: RankSession): boolean {
  return s.coinsSpent > 0;
}

function cmpStats(a: AdvisorMonthStats, b: AdvisorMonthStats) {
  if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
  if (b.convertedPaidClients !== a.convertedPaidClients) return b.convertedPaidClients - a.convertedPaidClients;
  if (b.paidSessionRevenue !== a.paidSessionRevenue) return b.paidSessionRevenue - a.paidSessionRevenue;
  return a.advisorId.localeCompare(b.advisorId);
}

/**
 * Rank advisors for one calendar month from genuine completed sittings.
 * Conversion = unique client used included/free minutes with an advisor, then
 * subsequently spent coins with the same advisor. Counted once per pair/month.
 */
export function rankAdvisorsForMonth(sessions: RankSession[]): AdvisorMonthStats[] {
  const genuine = sessions.filter(isGenuineSession);
  const byAdvisor = new Map<string, RankSession[]>();
  for (const s of genuine) {
    const list = byAdvisor.get(s.advisorId);
    if (list) list.push(s);
    else byAdvisor.set(s.advisorId, [s]);
  }

  const stats: AdvisorMonthStats[] = [];
  for (const [advisorId, list] of byAdvisor) {
    list.sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
    const firstFreeAt = new Map<string, number>();
    for (const s of list) {
      if (!usedFree(s) || firstFreeAt.has(s.clientId)) continue;
      firstFreeAt.set(s.clientId, s.startedAt);
    }
    const converted = new Set<string>();
    for (const s of list) {
      if (!usedPaid(s)) continue;
      const freeAt = firstFreeAt.get(s.clientId);
      if (freeAt == null) continue;
      if (s.startedAt >= freeAt) converted.add(s.clientId);
    }
    const eligibleFreeClients = firstFreeAt.size;
    const convertedPaidClients = converted.size;
    const paidSessionRevenue = list.reduce((n, s) => n + Math.max(0, Math.floor(s.coinsSpent)), 0);
    stats.push({
      advisorId,
      eligibleFreeClients,
      convertedPaidClients,
      conversionRate: eligibleFreeClients ? convertedPaidClients / eligibleFreeClients : 0,
      paidSessionRevenue,
      eligible: eligibleFreeClients >= MIN_FREE_CLIENTS,
      rank: null,
    });
  }

  const eligible = stats.filter((s) => s.eligible).sort(cmpStats);
  eligible.forEach((s, i) => {
    s.rank = i < TOP_RANK_LIMIT ? i + 1 : null;
  });
  return stats.sort((a, b) => {
    if (a.rank == null && b.rank == null) return a.advisorId.localeCompare(b.advisorId);
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });
}

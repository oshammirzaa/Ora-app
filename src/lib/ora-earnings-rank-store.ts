import { getSql, withSqlTransaction } from "@/lib/db";
import {
  MESSAGE_EARNINGS_SQL,
  READING_EARNINGS_SQL,
  TIP_EARNINGS_SQL,
  eligibleAdvisorTotals,
  rankEligibleAdvisors,
  rankingProgress,
  readingCents,
  type EligibleEarning,
  type RankProgress,
} from "@/lib/ora-earnings-rank";

export const EARNINGS_RANK_TABLE_SQL = `
create table if not exists ora_earnings_rank (
  advisor_id text primary key,
  eligible_cents integer not null default 0,
  rank integer,
  reached_at timestamptz,
  computed_at timestamptz not null default now()
)`;

type MoneyRow = { id: string; advisor_id: string; coins?: number; cents?: number; at: string | Date | null };

let tableReady = false;

export async function ensureEarningsRankTable() {
  if (tableReady) return;
  const sql = await getSql();
  await sql.query(EARNINGS_RANK_TABLE_SQL);
  tableReady = true;
}

async function readRows(text: string) {
  try {
    const sql = await getSql();
    return await sql.query<MoneyRow>(text);
  } catch (err) {
    console.error("[ora] earnings rank source", err);
    return [];
  }
}

function atMs(value: string | Date | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export async function refreshEarningsRanks() {
  await ensureEarningsRankTable();
  const sql = await getSql();
  const live = await sql<{ id: string }>`select id from ora_advisors where status = 'live'`;
  const [readings, messages, tips] = await Promise.all([
    readRows(READING_EARNINGS_SQL),
    readRows(MESSAGE_EARNINGS_SQL),
    readRows(TIP_EARNINGS_SQL),
  ]);
  const entries: EligibleEarning[] = [
    ...readings.map((row) => ({
      advisorId: String(row.advisor_id),
      source: "reading" as const,
      id: String(row.id),
      cents: readingCents(Number(row.coins) || 0),
      at: atMs(row.at),
    })),
    ...messages.map((row) => ({
      advisorId: String(row.advisor_id),
      source: "message" as const,
      id: String(row.id),
      cents: Math.max(0, Math.trunc(Number(row.cents) || 0)),
      at: atMs(row.at),
    })),
    ...tips.map((row) => ({
      advisorId: String(row.advisor_id),
      source: "tip" as const,
      id: String(row.id),
      cents: readingCents(Number(row.coins) || 0),
      at: atMs(row.at),
    })),
  ];
  const totals = eligibleAdvisorTotals(entries);
  const liveIds = live.map((row) => row.id);
  const ranked = rankEligibleAdvisors(totals, liveIds);
  const rankedIds = new Set(ranked.map((row) => row.advisorId));
  const extras = totals.filter((row) => row.advisorId && !rankedIds.has(row.advisorId));
  await withSqlTransaction(async (tx) => {
    await tx.query("delete from ora_earnings_rank");
    for (const row of ranked) {
      const reached = row.reachedAt == null ? null : new Date(row.reachedAt).toISOString();
      await tx`
        insert into ora_earnings_rank (advisor_id, eligible_cents, rank, reached_at, computed_at)
        values (${row.advisorId}, ${row.cents}, ${row.rank}, ${reached}::timestamptz, now())
      `;
    }
    for (const row of extras) {
      const reached = row.reachedAt == null ? null : new Date(row.reachedAt).toISOString();
      await tx`
        insert into ora_earnings_rank (advisor_id, eligible_cents, rank, reached_at, computed_at)
        values (${row.advisorId}, ${row.cents}, ${null}, ${reached}::timestamptz, now())
      `;
    }
  });
  return ranked.length;
}

export type AdvisorRankView = RankProgress & { included: true } | {
  included: false;
  earningsCents: number;
  message: string;
};

export async function loadAdvisorRankView(userId: string): Promise<AdvisorRankView | null> {
  await refreshEarningsRanks();
  const sql = await getSql();
  const [advisor] = await sql<{ id: string; status: string }>`
    select id, status from ora_advisors where user_id = ${userId} limit 1
  `;
  if (!advisor) return null;
  const rows = await sql<{ advisor_id: string; eligible_cents: number; rank: number | null }>`
    select advisor_id, eligible_cents::int as eligible_cents, rank::int as rank
    from ora_earnings_rank
  `;
  const board = rows
    .filter((row) => row.rank != null)
    .map((row) => ({
      advisorId: row.advisor_id,
      cents: Number(row.eligible_cents) || 0,
      reachedAt: null,
      rank: Number(row.rank),
    }))
    .sort((a, b) => a.rank - b.rank);
  const progress = rankingProgress(board, advisor.id);
  if (progress && advisor.status === "live") return { ...progress, included: true };
  const own = rows.find((row) => row.advisor_id === advisor.id);
  return {
    included: false,
    earningsCents: Number(own?.eligible_cents) || 0,
    message: "Your ranking appears while your desk is active.",
  };
}

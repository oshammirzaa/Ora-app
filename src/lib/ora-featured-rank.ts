import { parsePsychicCategories, serializePsychicCategories } from "./ora-psychic-categories.ts";
import { cleanManualRank, planManualRanks, type RankChange, type RankCommand, type RankSlot } from "./ora-manual-rank.ts";

export const FEATURED_RANK_CATEGORIES = ["trusted", "premium", "elite"] as const;
export type FeaturedRankCategory = (typeof FEATURED_RANK_CATEGORIES)[number];
export type FeaturedRankMap = Partial<Record<FeaturedRankCategory, number>>;

const SCHEMA = [
  `create table if not exists ora_featured_rank (
    advisor_id text not null,
    category text not null,
    rank integer not null,
    primary key (advisor_id, category)
  )`,
  "create unique index if not exists ora_featured_rank_cat_rank_uidx on ora_featured_rank (category, rank)",
];

/** One-time import of checkbox memberships, only for a category that has no saved ranks yet. */
const BACKFILL = `
insert into ora_featured_rank (advisor_id, category, rank)
select seeded.id, seeded.category, seeded.rank
from (
  select a.id,
         trim(c.category) as category,
         row_number() over (partition by trim(c.category) order by a.name asc, a.id asc)::int as rank
  from ora_advisors a
  cross join lateral unnest(string_to_array(coalesce(a.psychic_categories, ''), ',')) as c(category)
  where a.status = 'live'
    and trim(c.category) in ('trusted', 'premium', 'elite')
) seeded
where not exists (select 1 from ora_featured_rank fr where fr.category = seeded.category)
`;

let schemaReady = false;
let backfillReady = false;
type Query = (text: string, params?: unknown[]) => Promise<unknown>;

export function isFeaturedRankCategory(value: unknown): value is FeaturedRankCategory {
  return value === "trusted" || value === "premium" || value === "elite";
}

export async function ensureFeaturedRankSchema(query: Query) {
  if (!schemaReady) {
    for (const statement of SCHEMA) await query(statement);
    schemaReady = true;
  }
  if (backfillReady) return;
  try {
    await query(BACKFILL);
    backfillReady = true;
  } catch (err) {
    console.error("[ora] featured rank backfill", err);
  }
}

export function parseFeaturedRanks(value: unknown): FeaturedRankMap {
  const out: FeaturedRankMap = {};
  for (const part of String(value ?? "").split(",")) {
    const [category, raw] = part.split(":");
    if (!isFeaturedRankCategory(category)) continue;
    const rank = cleanManualRank(raw);
    if (rank != null) out[category] = rank;
  }
  return out;
}

export function orderByFeaturedRank<T extends { id: string; featuredRanks?: FeaturedRankMap }>(
  rows: readonly T[],
  category: FeaturedRankCategory,
): T[] {
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (seen.has(row.id) || row.featuredRanks?.[category] == null) return false;
      seen.add(row.id);
      return true;
    })
    .sort(
      (a, b) =>
        (a.featuredRanks?.[category] ?? 0) - (b.featuredRanks?.[category] ?? 0) || a.id.localeCompare(b.id),
    );
}

async function dropInactiveFeatured(query: Query, category: FeaturedRankCategory) {
  const stale = (await query(
    `select fr.advisor_id
     from ora_featured_rank fr
     left join ora_advisors a on a.id = fr.advisor_id
     where fr.category = $1 and (a.id is null or a.status <> 'live')`,
    [category],
  )) as { advisor_id: string }[];
  for (const row of stale) {
    const id = String(row.advisor_id);
    const found = (await query(
      "select coalesce(psychic_categories, '') as cats from ora_advisors where id = $1",
      [id],
    )) as { cats?: string }[];
    if (found[0]) {
      const next = parsePsychicCategories(found[0].cats).filter((item) => item !== category);
      await query("update ora_advisors set psychic_categories = $2 where id = $1", [
        id,
        serializePsychicCategories(next),
      ]);
    }
    await query("delete from ora_featured_rank where advisor_id = $1 and category = $2", [id, category]);
  }
}

export async function writeFeaturedRanks(
  query: Query,
  category: FeaturedRankCategory,
  changes: RankChange[],
) {
  if (!changes.length) return;
  const ids = changes.map((change) => change.id);
  const placeholders = ids.map((_, index) => `$${index + 2}`).join(", ");
  await query(
    `delete from ora_featured_rank where category = $1 and advisor_id in (${placeholders})`,
    [category, ...ids],
  );
  const ranked = changes.filter((change): change is RankChange & { newRank: number } => change.newRank != null);
  for (const change of ranked) {
    await query(
      "insert into ora_featured_rank (advisor_id, category, rank) values ($1, $2, $3)",
      [change.id, category, change.newRank],
    );
  }
  for (const change of changes) {
    const found = (await query(
      "select coalesce(psychic_categories, '') as cats from ora_advisors where id = $1",
      [change.id],
    )) as { cats?: string }[];
    const current = parsePsychicCategories(found[0]?.cats);
    const next = new Set(current);
    if (change.newRank == null) next.delete(category);
    else next.add(category);
    await query("update ora_advisors set psychic_categories = $2 where id = $1", [
      change.id,
      serializePsychicCategories([...next]),
    ]);
  }
}

export async function alignFeaturedMembership(query: Query, advisorId: string, categories: readonly string[]) {
  await ensureFeaturedRankSchema(query);
  const wanted = new Set(categories.filter(isFeaturedRankCategory));
  const statusRows = (await query("select status from ora_advisors where id = $1", [advisorId])) as { status: string }[];
  const live = statusRows[0]?.status === "live";
  for (const category of FEATURED_RANK_CATEGORIES) {
    const existing = (await query(
      "select rank::int as rank from ora_featured_rank where advisor_id = $1 and category = $2",
      [advisorId, category],
    )) as { rank: number }[];
    const has = existing.length > 0;
    if (wanted.has(category) && !has) {
      if (!live) continue;
      const counted = (await query(
        `select count(*)::int as n
         from ora_featured_rank fr
         join ora_advisors a on a.id = fr.advisor_id
         where fr.category = $1 and a.status = 'live'`,
        [category],
      )) as { n: number }[];
      const planned = await planFeaturedCategory(query, category, {
        type: "set",
        id: advisorId,
        rank: Number(counted[0]?.n || 0) + 1,
      });
      await writeFeaturedRanks(query, category, planned);
    } else if (!wanted.has(category) && has) {
      if (!live) {
        await query("delete from ora_featured_rank where advisor_id = $1 and category = $2", [advisorId, category]);
        continue;
      }
      const planned = await planFeaturedCategory(query, category, { type: "reset", id: advisorId });
      await writeFeaturedRanks(query, category, planned);
    }
  }
}

export async function planFeaturedCategory(
  query: Query,
  category: FeaturedRankCategory,
  command: RankCommand,
): Promise<RankChange[]> {
  await dropInactiveFeatured(query, category);
  const advisors = (await query("select id, status from ora_advisors")) as { id: string; status: string }[];
  const ranks = (await query(
    "select advisor_id, rank::int as rank from ora_featured_rank where category = $1",
    [category],
  )) as { advisor_id: string; rank: number }[];
  const rankById = new Map(ranks.map((row) => [String(row.advisor_id), Number(row.rank)]));
  const slots: RankSlot[] = advisors.map((row) => ({
    id: String(row.id),
    active: row.status === "live",
    rank: rankById.has(String(row.id)) ? rankById.get(String(row.id))! : null,
  }));
  return planManualRanks(slots, command);
}

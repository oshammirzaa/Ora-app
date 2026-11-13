import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withSqlTransaction } from "@/lib/db";
import { auditLog, requireAdmin } from "@/lib/ora";
import {
  ensureFeaturedRankSchema,
  isFeaturedRankCategory,
  planFeaturedCategory,
  writeFeaturedRanks,
  type FeaturedRankCategory,
} from "@/lib/ora-featured-rank";
import { type RankCommand } from "@/lib/ora-manual-rank";

function cleanId(value: unknown) {
  return String(value || "").trim().slice(0, 64);
}

function parseFeaturedCommand(input: {
  category?: string;
  action?: string;
  advisorId?: string;
  rank?: number;
  ids?: string[];
}): { category: FeaturedRankCategory; command: RankCommand } {
  if (!isFeaturedRankCategory(input.category)) throw new Error("Choose Trusted, Premium, or Elite.");
  const action = String(input.action || "");
  if (action === "order") {
    const ids = (input.ids || []).map((id) => cleanId(id)).filter(Boolean);
    if (!ids.length || ids.length > 500) throw new Error("Choose an advisor order.");
    return { category: input.category, command: { type: "order", ids } };
  }
  const advisorId = cleanId(input.advisorId);
  if (!advisorId) throw new Error("Choose an advisor.");
  if (action === "set") {
    const rank = Number(input.rank);
    if (!Number.isInteger(rank)) throw new Error("Rank must be a whole number.");
    return { category: input.category, command: { type: "set", id: advisorId, rank } };
  }
  if (action === "up" || action === "down" || action === "reset") {
    return { category: input.category, command: { type: action, id: advisorId } };
  }
  throw new Error("Unknown ranking action.");
}

type FeaturedRow = {
  id: string;
  name: string;
  photo_url: string;
  online: boolean;
  rating: number;
  reviews: number;
  email: string;
  category_rank: number | null;
};

async function loadFeaturedBoard(category: FeaturedRankCategory) {
  const sql = await getSql();
  await ensureFeaturedRankSchema((text, params) => sql.query(text, params ?? []));
  const advisors = await sql.query<FeaturedRow>(
    `select a.id, a.name, a.photo_url, a.online, a.rating::float as rating, a.reviews::int as reviews,
            coalesce(p.email, '') as email, fr.rank::int as category_rank
     from ora_advisors a
     left join ora_profiles p on p.user_id = a.user_id
     left join ora_featured_rank fr on fr.advisor_id = a.id and fr.category = $1
     where a.status = 'live'
     order by case when fr.rank is null or fr.rank < 1 then 1 else 0 end, fr.rank asc nulls last, a.name asc`,
    [category],
  );
  return {
    category,
    advisors: advisors.map((row) => ({
      id: String(row.id),
      name: String(row.name || ""),
      photoUrl: String(row.photo_url || ""),
      email: String(row.email || ""),
      online: Boolean(row.online),
      rating: Number(row.rating) || 0,
      reviews: Number(row.reviews) || 0,
      rank: row.category_rank == null ? null : Number(row.category_rank),
    })),
  };
}

export const adminFeaturedBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { category?: string; t?: number }) => {
    if (!isFeaturedRankCategory(input?.category)) throw new Error("Choose Trusted, Premium, or Elite.");
    return { category: input.category, t: Math.floor(Number(input?.t) || Date.now()) };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    return loadFeaturedBoard(data.category);
  });

export const adminSaveFeatured = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseFeaturedCommand)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    const sql = await getSql();
    await ensureFeaturedRankSchema((text, params) => sql.query(text, params ?? []));
    const changes = await withSqlTransaction(async (tx) => {
      const query = (text: string, params?: unknown[]) => tx.query(text, params ?? []);
      await tx.query("select id from ora_advisors for update");
      const planned = await planFeaturedCategory(query, data.category, data.command);
      await writeFeaturedRanks(query, data.category, planned);
      return planned;
    });
    if (changes.length) {
      const detail = changes
        .slice(0, 12)
        .map((change) => `${data.category} ${change.id} ${change.oldRank ?? "—"}→${change.newRank ?? "—"}`)
        .join("; ");
      await auditLog(context.userId, "rank_featured", "advisor", changes[0]?.id || "", detail);
    }
    return loadFeaturedBoard(data.category);
  });

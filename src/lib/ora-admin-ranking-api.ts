import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withSqlTransaction } from "@/lib/db";
import { auditLog, requireAdmin, rid } from "@/lib/ora";
import {
  ensureManualRankSchema,
  planManualRanks,
  writeManualRanks,
  type RankCommand,
  type RankSlot,
} from "@/lib/ora-manual-rank";

function stamp(input?: { t?: number }) {
  return { t: Math.floor(Number(input?.t) || Date.now()) };
}

function cleanId(value: unknown) {
  return String(value || "").trim().slice(0, 64);
}

function parseCommand(input: {
  action?: string;
  advisorId?: string;
  rank?: number;
  ids?: string[];
}): RankCommand {
  const action = String(input.action || "");
  if (action === "order") {
    const ids = (input.ids || []).map((id) => cleanId(id)).filter(Boolean);
    if (!ids.length || ids.length > 500) throw new Error("Choose an advisor order.");
    return { type: "order", ids };
  }
  const advisorId = cleanId(input.advisorId);
  if (!advisorId) throw new Error("Choose an advisor.");
  if (action === "set") {
    const rank = Number(input.rank);
    if (!Number.isInteger(rank)) throw new Error("Rank must be a whole number.");
    return { type: "set", id: advisorId, rank };
  }
  if (action === "up" || action === "down" || action === "reset") return { type: action, id: advisorId };
  throw new Error("Unknown ranking action.");
}

type AdvisorRankRow = {
  id: string;
  name: string;
  photo_url: string;
  status: string;
  online: boolean;
  trusted: boolean | string | null;
  rating: number;
  reviews: number;
  manual_rank: number | null;
  email: string;
};

type HistoryRow = {
  id: string;
  advisor_id: string;
  name: string;
  old_rank: number | null;
  new_rank: number | null;
  changed_by: string;
  created_at: string;
};

async function loadBoard() {
  const sql = await getSql();
  await ensureManualRankSchema((text, params) => sql.query(text, params ?? []));
  const advisors = await sql.query<AdvisorRankRow>(
    `select a.id, a.name, a.photo_url, a.status, a.online, a.trusted, a.rating::float as rating, a.reviews::int as reviews,
            a.manual_rank::int as manual_rank, coalesce(p.email, '') as email
     from ora_advisors a
     left join ora_profiles p on p.user_id = a.user_id
     where a.status = 'live'
     order by case when a.manual_rank is null or a.manual_rank < 1 then 1 else 0 end,
              a.manual_rank asc nulls last, a.name asc`,
  );
  const history = await sql.query<HistoryRow>(
    `select h.id, h.advisor_id, coalesce(a.name, h.advisor_id) as name,
            h.old_rank::int as old_rank, h.new_rank::int as new_rank,
            coalesce(nullif(p.display_name, ''), nullif(p.email, ''), h.actor_id) as changed_by,
            h.created_at::text as created_at
     from ora_advisor_rank_history h
     left join ora_advisors a on a.id = h.advisor_id
     left join ora_profiles p on p.user_id = h.actor_id
     order by h.created_at desc
     limit 200`,
  );
  return {
    advisors: advisors.map((row) => ({
      id: String(row.id),
      name: String(row.name || ""),
      photoUrl: String(row.photo_url || ""),
      email: String(row.email || ""),
      online: Boolean(row.online),
      trusted: row.trusted === true || row.trusted === "t" || row.trusted === "true",
      rating: Number(row.rating) || 0,
      reviews: Number(row.reviews) || 0,
      manualRank: row.manual_rank == null ? null : Number(row.manual_rank),
    })),
    history: history.map((row) => ({
      id: String(row.id),
      advisorId: String(row.advisor_id),
      name: String(row.name || ""),
      oldRank: row.old_rank == null ? null : Number(row.old_rank),
      newRank: row.new_rank == null ? null : Number(row.new_rank),
      changedBy: String(row.changed_by || ""),
      at: String(row.created_at || ""),
    })),
  };
}

export const adminRankingBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "advisors");
    return loadBoard();
  });

export const adminSaveRanking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { action?: string; advisorId?: string; rank?: number; ids?: string[] }) => parseCommand(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    const sql = await getSql();
    await ensureManualRankSchema((text, params) => sql.query(text, params ?? []));
    const changes = await withSqlTransaction(async (tx) => {
      await tx.query("select id from ora_advisors for update");
      const rows = await tx.query<{ id: string; status: string; manual_rank: number | null }>(
        "select id, status, manual_rank::int as manual_rank from ora_advisors",
      );
      const slots: RankSlot[] = rows.map((row) => ({
        id: String(row.id),
        active: row.status === "live",
        rank: row.manual_rank == null ? null : Number(row.manual_rank),
      }));
      const planned = planManualRanks(slots, data);
      await writeManualRanks(
        (text, params) => tx.query(text, params ?? []),
        planned,
        context.userId,
        () => rid("rnk"),
      );
      return planned;
    });
    if (changes.length) {
      const detail = changes
        .slice(0, 12)
        .map((change) => `${change.id} ${change.oldRank ?? "—"}→${change.newRank ?? "—"}`)
        .join("; ");
      await auditLog(context.userId, "rank_advisors", "advisor", changes[0]?.id || "", detail);
    }
    return loadBoard();
  });

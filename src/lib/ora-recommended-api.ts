import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withSqlTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/ora";
import {
  cleanRecommendedDraft,
  unavailableRecommendations,
  type RecommendedPick,
} from "@/lib/ora-recommended";

export const RECOMMENDED_TABLE_SQL = `
create table if not exists ora_recommended_picks (
  state text not null,
  slot integer not null,
  advisor_id text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (state, slot)
)`;

const RECOMMENDED_ADVISOR_INDEX_SQL = `
create unique index if not exists ora_recommended_picks_advisor_idx
  on ora_recommended_picks (state, advisor_id)`;

let ready = false;

async function ensureRecommendedTable() {
  if (ready) return;
  const sql = await getSql();
  await sql.query(RECOMMENDED_TABLE_SQL);
  await sql.query(RECOMMENDED_ADVISOR_INDEX_SQL);
  ready = true;
}

type AdvisorChoice = {
  id: string;
  name: string;
  email: string;
  status: string;
  photo_url: string;
  online: boolean;
  rate_coins: number;
  rating: number;
  reviews: number;
};

async function loadChoices() {
  const sql = await getSql();
  try {
    return await sql.query<AdvisorChoice>(`
      select a.id, a.name, coalesce(u.email, '') as email, a.status, a.photo_url,
             a.online, a.rate_coins::int as rate_coins, a.rating::float as rating, a.reviews::int as reviews
      from ora_advisors a
      left join "user" u on u.id = a.user_id
      order by a.name asc
    `);
  } catch {
    return await sql.query<AdvisorChoice>(`
      select a.id, a.name, '' as email, a.status, a.photo_url,
             a.online, a.rate_coins::int as rate_coins, a.rating::float as rating, a.reviews::int as reviews
      from ora_advisors a
      order by a.name asc
    `);
  }
}

async function loadState(state: "draft" | "live") {
  const sql = await getSql();
  const rows = await sql<{ slot: number; advisor_id: string }>`
    select slot::int as slot, advisor_id from ora_recommended_picks
    where state = ${state}
    order by slot asc
  `;
  return rows.map((row) => ({ slot: Number(row.slot), advisorId: row.advisor_id }));
}

async function writeState(state: "draft" | "live", picks: RecommendedPick[], actorId: string) {
  await withSqlTransaction(async (tx) => {
    await tx`delete from ora_recommended_picks where state = ${state}`;
    for (const pick of picks) {
      await tx`
        insert into ora_recommended_picks (state, slot, advisor_id, updated_at, updated_by)
        values (${state}, ${pick.slot}, ${pick.advisorId}, now(), ${actorId.slice(0, 120)})
      `;
    }
  });
}

function boardPayload(
  choices: AdvisorChoice[],
  draft: RecommendedPick[],
  published: RecommendedPick[],
) {
  const approved = choices.filter((row) => row.status === "live");
  return {
    advisors: approved.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      photoUrl: row.photo_url,
      online: Boolean(row.online),
      rateCoins: Number(row.rate_coins) || 0,
      rating: Number(row.rating) || 0,
      reviews: Number(row.reviews) || 0,
    })),
    draft,
    published,
    alerts: unavailableRecommendations(published, choices),
  };
}

export const adminRecommendedBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "advisors");
    await ensureRecommendedTable();
    const [choices, draft, published] = await Promise.all([loadChoices(), loadState("draft"), loadState("live")]);
    return boardPayload(choices, draft, published);
  });

export const adminSaveRecommendations = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { picks?: { slot?: number; advisorId?: string }[]; publish?: boolean }) => ({
    picks: Array.isArray(input?.picks) ? input.picks.slice(0, 5) : [],
    publish: Boolean(input?.publish),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    await ensureRecommendedTable();
    const choices = await loadChoices();
    const approved = new Set(choices.filter((row) => row.status === "live").map((row) => row.id));
    const picks = cleanRecommendedDraft(data.picks, approved);
    await writeState("draft", picks, context.userId);
    if (data.publish) await writeState("live", picks, context.userId);
    const published = data.publish ? picks : await loadState("live");
    return boardPayload(choices, picks, published);
  });

export const listPublishedRecommendations = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensureRecommendedTable();
    return await loadState("live");
  } catch (err) {
    console.error("[ora] recommendations", err);
    return [];
  }
});

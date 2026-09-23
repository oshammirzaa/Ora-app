import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { reviewAverage, reviewDayBounds } from "@/lib/ora-reviews";

async function ensureReviewDay() {
  const sql = await getSql();
  await sql.query("alter table ora_reviews add column if not exists review_day text");
  await sql.query(
    "create unique index if not exists ora_reviews_client_advisor_day_idx on ora_reviews (client_id, advisor_id, review_day) where review_day is not null and review_day <> ''",
  );
}

function clip(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

async function advisorIdFor(idOrSlug: string) {
  const sql = await getSql();
  const [row] = await sql<{ id: string }>`
    select id from ora_advisors where (id = ${idOrSlug} or slug = ${idOrSlug}) and status = 'live' limit 1
  `;
  return row?.id || "";
}

export const advisorProfileReviews = createServerFn({ method: "GET" })
  .validator((input: { advisorId?: string }) => ({ advisorId: clip(input.advisorId, 80) }))
  .handler(async ({ data }) => {
    if (!data.advisorId) return { rating: 0, count: 0, reviews: [] as PublicReview[] };
    const advisorId = await advisorIdFor(data.advisorId);
    if (!advisorId) return { rating: 0, count: 0, reviews: [] as PublicReview[] };
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      rating: number;
      body: string;
      created_at: string;
      name: string;
    }>`
      select r.id, r.rating, r.body, r.created_at::text as created_at,
             coalesce(nullif(p.display_name, ''), 'Client') as name
      from ora_reviews r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisorId} and r.hidden = false
      order by r.created_at desc
      limit 40
    `.catch(() => []);
    const summary = reviewAverage(rows.map((row) => Number(row.rating) || 0));
    return {
      rating: summary.rating,
      count: summary.count,
      reviews: rows.map((row) => ({
        id: row.id,
        name: row.name || "Client",
        photo: "",
        rating: Math.min(5, Math.max(1, Math.floor(Number(row.rating) || 0))),
        body: String(row.body || ""),
        at: row.created_at,
      })),
    };
  });

type PublicReview = {
  id: string;
  name: string;
  photo: string;
  rating: number;
  body: string;
  at: string;
};

export const myAdvisorReviewToday = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string }) => ({ advisorId: clip(input.advisorId, 80) }))
  .handler(async ({ context, data }) => {
    if (!data.advisorId) return { alreadyToday: false };
    const advisorId = await advisorIdFor(data.advisorId);
    if (!advisorId) return { alreadyToday: false };
    await ensureReviewDay();
    const bounds = reviewDayBounds();
    const sql = await getSql();
    const [row] = await sql<{ id: string }>`
      select id from ora_reviews
      where client_id = ${context.userId}
        and advisor_id = ${advisorId}
        and (
          review_day = ${bounds.day}
          or (
            coalesce(review_day, '') = ''
            and created_at >= ${bounds.start}::timestamptz
            and created_at < ${bounds.end}::timestamptz
          )
        )
      limit 1
    `.catch(() => []);
    return { alreadyToday: Boolean(row?.id) };
  });

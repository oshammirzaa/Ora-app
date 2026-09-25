import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { auditLog, requireAdmin, rid } from "@/lib/ora";
import { advisorRatingFromReviews } from "@/lib/ora-advisor-admin-search";
import { beginViewAs, currentViewAs, ensureViewAsSchema, finishViewAs } from "@/lib/ora-view-as";

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

async function owner(userId: string) {
  await requireAdmin(userId, "advisors");
  await ensureViewAsSchema();
}

function moneyRow(row: { rating: number; hidden?: boolean }) {
  return { rating: Math.min(5, Math.max(1, Math.floor(Number(row.rating) || 0))), hidden: Boolean(row.hidden) };
}

async function refreshAdvisorRating(advisorId: string) {
  const sql = await getSql();
  const rows = await sql<{ rating: number; hidden: boolean }>`
    select rating, coalesce(hidden, false) as hidden from ora_reviews where advisor_id = ${advisorId}
  `.catch(() => []);
  const summary = advisorRatingFromReviews(rows.map(moneyRow));
  await sql`
    update ora_advisors set rating = ${summary.rating}, reviews = ${summary.reviews} where id = ${advisorId}
  `;
  return summary;
}

export const adminViewAsStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const view = await currentViewAs(context.userId);
    if (!view) return { active: false as const, name: "", advisorId: "", startedAt: "" };
    return {
      active: true as const,
      name: view.advisorName,
      advisorId: view.advisorId,
      startedAt: view.startedAt,
    };
  });

export const adminStartViewAs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; reason?: string }) => ({
    advisorId: clip(input?.advisorId, 80),
    reason: clip(input?.reason, 300),
  }))
  .handler(async ({ context, data }) => {
    await owner(context.userId);
    if (!data.advisorId) throw new Error("Choose an advisor.");
    const sql = await getSql();
    const [advisor] = await sql<{ id: string; user_id: string; name: string }>`
      select id, user_id, name from ora_advisors where id = ${data.advisorId} limit 1
    `;
    if (!advisor?.user_id) throw new Error("That advisor has no account to view.");
    const started = await beginViewAs({
      adminId: context.userId,
      advisorId: advisor.id,
      advisorUserId: advisor.user_id,
      advisorName: advisor.name,
      reason: data.reason,
    });
    await auditLog(
      context.userId,
      "view_as_start",
      "advisor",
      advisor.id,
      `${advisor.name} · start ${new Date().toISOString()} · ${started.reason || "no reason"}`,
    );
    return { ok: true as const, name: advisor.name };
  });

export const adminEndViewAs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const view = await currentViewAs(context.userId);
    if (!view) return { ok: true as const };
    const ended = await finishViewAs(context.userId);
    await auditLog(
      context.userId,
      "view_as_end",
      "advisor",
      ended?.advisorId || view.advisorId,
      `${ended?.advisorName || view.advisorName} · start ${view.startedAt} · end ${new Date().toISOString()} · ${view.reason || "no reason"}`,
    );
    return { ok: true as const };
  });

export const adminAdvisorClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; query?: string; offset?: number }) => ({
    advisorId: clip(input?.advisorId, 80),
    query: clip(input?.query, 80).toLowerCase(),
    offset: Math.max(0, Math.floor(Number(input?.offset) || 0)),
  }))
  .handler(async ({ context, data }) => {
    await owner(context.userId);
    if (!data.advisorId) return { conversations: [], total: 0 };
    const sql = await getSql();
    const readings = await sql<{
      id: string;
      client_id: string;
      name: string;
      at: string;
      coins_spent: number;
    }>`
      select r.id, r.client_id, coalesce(nullif(p.display_name, ''), 'Client') as name,
             coalesce(r.ended_at, r.started_at)::text as at, coalesce(r.coins_spent, 0)::int as coins_spent
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${data.advisorId}
      order by coalesce(r.ended_at, r.started_at) desc
      limit 300
    `.catch(() => []);
    const threads = await sql<{
      id: string;
      client_id: string;
      name: string;
      at: string;
      paid: number;
    }>`
      select i.id, i.customer_id as client_id, coalesce(nullif(p.display_name, ''), 'Client') as name,
             i.last_at::text as at,
             case when exists (
               select 1 from ora_paid_messages m
               where m.thread_id = i.id and m.advisor_id = i.advisor_id and m.coins > 0 and m.credited = true
             ) then 1 else 0 end as paid
      from ora_advisor_inbox i
      left join ora_profiles p on p.user_id = i.customer_id
      where i.advisor_id = ${data.advisorId}
      order by i.last_at desc
      limit 300
    `.catch(() => []);
    const rows = [
      ...readings.map((row) => ({
        id: `reading:${row.id}`,
        refId: row.id,
        clientId: row.client_id,
        name: row.name || "Client",
        at: String(row.at || ""),
        kind: "reading" as const,
        paid: Number(row.coins_spent) > 0 ? ("paid" as const) : ("free" as const),
      })),
      ...threads.map((row) => ({
        id: `message:${row.id}`,
        refId: row.id,
        clientId: row.client_id,
        name: row.name || "Client",
        at: String(row.at || ""),
        kind: "message" as const,
        paid: Number(row.paid) > 0 ? ("paid" as const) : ("free" as const),
      })),
    ]
      .filter((row) => {
        if (!data.query) return true;
        return row.name.toLowerCase().includes(data.query) || row.clientId.toLowerCase().includes(data.query);
      })
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
    return { conversations: rows.slice(data.offset, data.offset + 20), total: rows.length };
  });

export const adminAdvisorChat = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; kind?: string; refId?: string; before?: string }) => ({
    advisorId: clip(input?.advisorId, 80),
    kind: input?.kind === "message" ? "message" : "reading",
    refId: clip(input?.refId, 80),
    before: clip(input?.before, 40),
  }))
  .handler(async ({ context, data }) => {
    await owner(context.userId);
    if (!data.advisorId || !data.refId) return { messages: [] as ChatLine[] };
    const sql = await getSql();
    const before = data.before || "9999-12-31T23:59:59.999Z";
    if (data.kind === "reading") {
      const [owned] = await sql<{ id: string }>`
        select id from ora_readings where id = ${data.refId} and advisor_id = ${data.advisorId} limit 1
      `;
      if (!owned) return { messages: [] as ChatLine[] };
      const rows = await sql<{ id: string; role: string; body: string; at: string }>`
        select id, role, body, created_at::text as at
        from ora_messages
        where reading_id = ${data.refId} and created_at < ${before}::timestamptz
        order by created_at desc
        limit 40
      `.catch(() => []);
      return { messages: rows.reverse().map(line) };
    }
    const [owned] = await sql<{ id: string }>`
      select id from ora_advisor_inbox where id = ${data.refId} and advisor_id = ${data.advisorId} limit 1
    `.catch(() => []);
    if (!owned) return { messages: [] as ChatLine[] };
    const rows = await sql<{ id: string; role: string; body: string; at: string }>`
      select id, role, body, created_at::text as at
      from ora_advisor_inbox_messages
      where thread_id = ${data.refId} and advisor_id = ${data.advisorId} and created_at < ${before}::timestamptz
      order by created_at desc
      limit 40
    `.catch(() => []);
    return { messages: rows.reverse().map(line) };
  });

type ChatLine = { id: string; role: string; body: string; at: string };

function line(row: { id: string; role: string; body: string; at: string }): ChatLine {
  return {
    id: row.id,
    role: row.role === "advisor" ? "advisor" : "client",
    body: String(row.body || ""),
    at: String(row.at || ""),
  };
}

export const adminAdvisorReviews = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string }) => ({ advisorId: clip(input?.advisorId, 80) }))
  .handler(async ({ context, data }) => {
    await owner(context.userId);
    if (!data.advisorId) return { reviews: [] as ReviewRow[] };
    const sql = await getSql();
    const [advisor] = await sql<{ id: string; name: string }>`
      select id, name from ora_advisors where id = ${data.advisorId} limit 1
    `;
    if (!advisor) return { reviews: [] as ReviewRow[] };
    const rows = await sql<{
      id: string;
      rating: number;
      body: string;
      at: string;
      client_id: string;
      reading_id: string;
      source: string;
      client_label: string;
      hidden: boolean;
      name: string;
    }>`
      select r.id, r.rating, r.body, r.created_at::text as at, r.client_id, r.reading_id,
             coalesce(r.source, 'customer') as source,
             coalesce(r.client_label, '') as client_label,
             coalesce(r.hidden, false) as hidden,
             coalesce(nullif(r.client_label, ''), nullif(p.display_name, ''), 'Client') as name
      from ora_reviews r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${data.advisorId}
      order by r.created_at desc
      limit 200
    `.catch(() => []);
    return {
      reviews: rows.map((row) => ({
        id: row.id,
        clientName: row.name || "Client",
        clientId: row.client_id,
        rating: Number(row.rating) || 0,
        body: row.body || "",
        at: String(row.at || ""),
        source: row.source === "admin" ? "admin" : "customer",
        readingId: row.reading_id || "",
        advisorName: advisor.name,
        hidden: Boolean(row.hidden),
      })),
    };
  });

type ReviewRow = {
  id: string;
  clientName: string;
  clientId: string;
  rating: number;
  body: string;
  at: string;
  source: string;
  readingId: string;
  advisorName: string;
  hidden: boolean;
};

export const adminSaveAdvisorReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; reviewId?: string; rating?: number; body?: string; clientName?: string }) => ({
    advisorId: clip(input?.advisorId, 80),
    reviewId: clip(input?.reviewId, 80),
    rating: Math.min(5, Math.max(1, Math.floor(Number(input?.rating) || 0))),
    body: clip(input?.body, 1000),
    clientName: clip(input?.clientName, 80),
  }))
  .handler(async ({ context, data }) => {
    await owner(context.userId);
    if (!data.advisorId) throw new Error("Choose an advisor.");
    if (!data.rating) throw new Error("Choose a star rating.");
    const sql = await getSql();
    const [advisor] = await sql<{ id: string; name: string }>`
      select id, name from ora_advisors where id = ${data.advisorId} limit 1
    `;
    if (!advisor) throw new Error("Advisor not found.");
    if (!data.reviewId) {
      const id = rid("rev");
      const readingId = `admin:${id}`;
      await sql`
        insert into ora_reviews (id, reading_id, client_id, advisor_id, rating, body, source, created_by, client_label)
        values (${id}, ${readingId}, ${`admin:${context.userId}`}, ${advisor.id}, ${data.rating}, ${data.body}, 'admin', ${context.userId}, ${data.clientName || "Client"})
      `;
      await sql`
        insert into ora_review_audit (id, review_id, advisor_id, admin_id, action, before_json, after_json)
        values (${rid("raud")}, ${id}, ${advisor.id}, ${context.userId}, 'add', '', ${JSON.stringify({ rating: data.rating, body: data.body, clientName: data.clientName, source: "admin" })})
      `;
      await auditLog(context.userId, "review_add", "review", id, `${advisor.name} · ${data.rating} stars · admin-created`);
      const summary = await refreshAdvisorRating(advisor.id);
      return { ok: true as const, ...summary };
    }
    const [before] = await sql<{
      id: string;
      rating: number;
      body: string;
      source: string;
      client_label: string;
      client_id: string;
    }>`
      select id, rating, body, coalesce(source, 'customer') as source, coalesce(client_label, '') as client_label, client_id
      from ora_reviews where id = ${data.reviewId} and advisor_id = ${advisor.id} limit 1
    `;
    if (!before) throw new Error("Review not found.");
    const nextLabel = before.source === "admin" ? data.clientName || before.client_label : before.client_label;
    await sql`
      update ora_reviews
      set rating = ${data.rating}, body = ${data.body}, client_label = ${nextLabel}
      where id = ${before.id} and advisor_id = ${advisor.id}
    `;
    await sql`
      insert into ora_review_audit (id, review_id, advisor_id, admin_id, action, before_json, after_json)
      values (
        ${rid("raud")}, ${before.id}, ${advisor.id}, ${context.userId}, 'edit',
        ${JSON.stringify({ rating: before.rating, body: before.body, clientName: before.client_label, source: before.source })},
        ${JSON.stringify({ rating: data.rating, body: data.body, clientName: nextLabel, source: before.source })}
      )
    `;
    await auditLog(context.userId, "review_edit", "review", before.id, `${advisor.name} · ${before.rating} -> ${data.rating}`);
    const summary = await refreshAdvisorRating(advisor.id);
    return { ok: true as const, ...summary };
  });

export const adminDeleteAdvisorReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; reviewId?: string }) => ({
    advisorId: clip(input?.advisorId, 80),
    reviewId: clip(input?.reviewId, 80),
  }))
  .handler(async ({ context, data }) => {
    await owner(context.userId);
    const sql = await getSql();
    const [before] = await sql<{ id: string; rating: number; body: string; source: string; client_label: string; advisor_id: string }>`
      select id, rating, body, coalesce(source, 'customer') as source, coalesce(client_label, '') as client_label, advisor_id
      from ora_reviews where id = ${data.reviewId} and advisor_id = ${data.advisorId} limit 1
    `;
    if (!before) throw new Error("Review not found.");
    await sql`
      insert into ora_review_audit (id, review_id, advisor_id, admin_id, action, before_json, after_json)
      values (
        ${rid("raud")}, ${before.id}, ${before.advisor_id}, ${context.userId}, 'delete',
        ${JSON.stringify({ rating: before.rating, body: before.body, clientName: before.client_label, source: before.source })},
        ''
      )
    `;
    await sql`delete from ora_reviews where id = ${before.id} and advisor_id = ${before.advisor_id}`;
    await auditLog(context.userId, "review_delete", "review", before.id, `${before.source} · ${before.rating} stars`);
    const summary = await refreshAdvisorRating(before.advisor_id);
    return { ok: true as const, ...summary };
  });

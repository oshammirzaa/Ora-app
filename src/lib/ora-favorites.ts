import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { mapAdvisor, rid, type Advisor } from "@/lib/ora";
import { ensureChatMediaColumns } from "@/lib/ora-chat-media";
import { publicAdvisorPresence } from "@/lib/ora-advisor-schedule";

let schemaReady = false;

export async function ensureFavoriteExtras() {
  if (schemaReady) return;
  const sql = await getSql();
  await sql`alter table ora_favorites add column if not exists notify_when_online boolean not null default false`;
  await sql`alter table ora_favorites add column if not exists last_seen_available boolean not null default false`;
  await sql`
    create table if not exists ora_customer_alerts (
      id text primary key,
      user_id text not null,
      advisor_id text not null,
      kind text not null,
      title text not null,
      body text not null,
      href text not null,
      created_at timestamptz not null default now(),
      read_at timestamptz
    )
  `;
  schemaReady = true;
}

export type CustomerAlert = {
  id: string;
  advisorId: string;
  advisorSlug: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

function mapAlert(r: {
  id: string;
  advisor_id: string;
  title: string;
  body: string;
  href: string;
  created_at: string;
  read_at: string | null;
}): CustomerAlert {
  const href = String(r.href || "");
  const slug = href.startsWith("/advisors/") ? href.slice("/advisors/".length).split("/")[0] : "";
  return {
    id: r.id,
    advisorId: r.advisor_id,
    advisorSlug: slug,
    title: r.title,
    body: r.body,
    href,
    createdAt: String(r.created_at),
    read: Boolean(r.read_at),
  };
}

export const listFavoriteIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureFavoriteExtras();
    const sql = await getSql();
    const rows = await sql<{ advisor_id: string }>`
      select advisor_id from ora_favorites where user_id = ${context.userId}
    `;
    return { ids: rows.map((r) => r.advisor_id) };
  });

export const setFavoriteNotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string; notify: boolean }) => ({
    advisorId: String(input.advisorId).slice(0, 64),
    notify: Boolean(input.notify),
  }))
  .handler(async ({ context, data }) => {
    await ensureFavoriteExtras();
    const sql = await getSql();
    const [adv] = await sql<{
      id: string;
      online: boolean;
      busy: boolean;
      away?: boolean;
      hours_json?: string;
      schedule_tz?: string;
    }>`
      select a.id, a.online, a.busy,
             coalesce(a.away, false) as away, coalesce(a.hours_json, '') as hours_json, coalesce(a.schedule_tz, '') as schedule_tz
      from ora_advisors a
      where (a.id = ${data.advisorId} or a.slug = ${data.advisorId}) and a.status = 'live'
    `;
    if (!adv) throw new Error("Advisor not available.");
    const [fav] = await sql<{ advisor_id: string }>`
      select advisor_id from ora_favorites where user_id = ${context.userId} and advisor_id = ${adv.id}
    `;
    if (!fav) {
      const [spoken] = await sql<{ id: string }>`
        select id from ora_readings
        where client_id = ${context.userId} and advisor_id = ${adv.id} and status = 'ended'
        limit 1
      `;
      if (!spoken) throw new Error("Save this psychic first.");
      const floor = publicAdvisorPresence(adv);
      const available = floor.online && !floor.busy;
      await sql`
        insert into ora_favorites (user_id, advisor_id, notify_when_online, last_seen_available)
        values (${context.userId}, ${adv.id}, ${data.notify}, ${data.notify ? available : false})
        on conflict (user_id, advisor_id) do update
        set notify_when_online = excluded.notify_when_online,
            last_seen_available = excluded.last_seen_available
      `;
      return { notify: data.notify, saved: true };
    }
    const floor = publicAdvisorPresence(adv);
    const available = floor.online && !floor.busy;
    await sql`
      update ora_favorites
      set notify_when_online = ${data.notify},
          last_seen_available = ${data.notify ? available : false}
      where user_id = ${context.userId} and advisor_id = ${adv.id}
    `;
    return { notify: data.notify, saved: true };
  });

export const pollFavoriteAlerts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureFavoriteExtras();
    const sql = await getSql();
    const rows = await sql<{
      advisor_id: string;
      name: string;
      slug: string;
      online: boolean;
      busy: boolean;
      away?: boolean;
      hours_json?: string;
      schedule_tz?: string;
      last_seen_available: boolean;
      notify_when_online: boolean;
    }>`
      select f.advisor_id, a.name, a.slug, a.online, a.busy,
             coalesce(a.away, false) as away, coalesce(a.hours_json, '') as hours_json, coalesce(a.schedule_tz, '') as schedule_tz,
             f.last_seen_available, f.notify_when_online
      from ora_favorites f
      join ora_advisors a on a.id = f.advisor_id
      where f.user_id = ${context.userId} and a.status = 'live'
    `;
    const created: CustomerAlert[] = [];
    for (const row of rows) {
      const floor = publicAdvisorPresence(row);
      const available = floor.online && !floor.busy;
      const seen = Boolean(row.last_seen_available);
      if (row.notify_when_online && available && !seen) {
        const [dup] = await sql<{ id: string }>`
          select id from ora_customer_alerts
          where user_id = ${context.userId}
            and advisor_id = ${row.advisor_id}
            and kind = 'online'
            and read_at is null
          limit 1
        `;
        if (!dup) {
          const id = rid("alrt");
          const href = `/advisors/${row.slug}`;
          const title = `${row.name} is online now`;
          const body = `${row.name} is online now — start a reading.`;
          await sql`
            insert into ora_customer_alerts (id, user_id, advisor_id, kind, title, body, href)
            values (${id}, ${context.userId}, ${row.advisor_id}, 'online', ${title}, ${body}, ${href})
          `;
          created.push({
            id,
            advisorId: row.advisor_id,
            advisorSlug: row.slug,
            title,
            body,
            href,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
      }
      if (seen !== available) {
        await sql`
          update ora_favorites
          set last_seen_available = ${available}
          where user_id = ${context.userId} and advisor_id = ${row.advisor_id}
        `;
      }
    }
    const inbox = await sql<{
      id: string;
      advisor_id: string;
      title: string;
      body: string;
      href: string;
      created_at: string;
      read_at: string | null;
    }>`
      select id, advisor_id, title, body, href, created_at, read_at
      from ora_customer_alerts
      where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `;
    return {
      created,
      alerts: inbox.map(mapAlert),
      unread: inbox.filter((r) => !r.read_at).length,
    };
  });

export const markAlertRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await ensureFavoriteExtras();
    const sql = await getSql();
    await sql`
      update ora_customer_alerts
      set read_at = coalesce(read_at, now())
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const listTalkAgain = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown> & { last_at: string }>`
      select distinct on (r.advisor_id)
             a.id, a.user_id, a.name, a.slug, a.bio, a.experience, a.specialties, a.rate_coins,
             a.photo_url, a.video_url, a.status, a.trusted, a.is_new, a.rating, a.reviews,
             a.legal_name, a.languages, a.years, a.online, a.busy, a.payout_coins, a.created_at,
             coalesce(a.away, false) as away, coalesce(a.hours_json, '') as hours_json, coalesce(a.schedule_tz, '') as schedule_tz,
             r.ended_at as last_at
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      where r.client_id = ${context.userId}
        and r.status = 'ended'
        and a.status = 'live'
      order by r.advisor_id, r.ended_at desc nulls last, r.started_at desc
    `;
    return rows
      .map((r) => ({ advisor: mapAdvisor(r), lastAt: String(r.last_at) }))
      .sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt))
      .map((r) => r.advisor) as Advisor[];
  });

export const lastReadingWithAdvisor = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: String(input.advisorId).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [adv] = await sql<{ id: string }>`
      select id from ora_advisors where id = ${data.advisorId} or slug = ${data.advisorId} limit 1
    `;
    if (!adv) return { at: "", followUp: "" };
    await ensureChatMediaColumns();
    const [reading] = await sql<{ ended_at: string }>`
      select ended_at::text as ended_at
      from ora_readings
      where client_id = ${context.userId} and advisor_id = ${adv.id} and status = 'ended'
      order by ended_at desc nulls last
      limit 1
    `;
    if (!reading) return { at: "", followUp: "" };
    const [msg] = await sql<{ body: string }>`
      select body from ora_advisor_inbox_messages
      where advisor_id = ${adv.id} and customer_id = ${context.userId} and coalesce(kind, '') = 'followup'
        and recalled_at is null
      order by created_at desc
      limit 1
    `.catch(() => []);
    return { at: String(reading.ended_at || ""), followUp: String(msg?.body || "") };
  });

export const listMyFollowUps = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureChatMediaColumns();
    const rows = await sql<{
      id: string;
      body: string;
      created_at: string;
      advisor_id: string;
      name: string;
      slug: string;
      photo_url: string;
      reading_id: string | null;
    }>`
      select m.id, m.body, m.created_at::text as created_at, a.id as advisor_id, a.name, a.slug, a.photo_url,
             m.reading_id
      from ora_advisor_inbox_messages m
      join ora_advisors a on a.id = m.advisor_id
      where m.customer_id = ${context.userId}
        and m.role = 'advisor'
        and coalesce(m.kind, '') = 'followup'
        and m.recalled_at is null
      order by m.created_at desc
      limit 20
    `.catch(() => []);
    return {
      messages: rows.map((r) => ({
        id: r.id,
        body: r.body,
        at: String(r.created_at),
        advisorId: r.advisor_id,
        advisorName: r.name,
        advisorSlug: r.slug,
        photoUrl: r.photo_url,
        readingId: r.reading_id || "",
      })),
    };
  });

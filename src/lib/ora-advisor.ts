import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { assertActive, rid } from "@/lib/ora";
import {
  advisorAccessGate,
  advisorDeniedMessage,
  advisorDeskKind,
  overlapSeconds,
  panelSplit,
  readingMinutes,
} from "@/lib/ora-advisor-auth";

const PRESENCE_TABLE_SQL = `
create table if not exists ora_advisor_presence (
  id text primary key,
  advisor_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds integer not null default 0,
  source text not null default 'toggle'
)
`;

const ACTIVITY_TABLE_SQL = `
create table if not exists ora_reading_activity (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  reading_id text not null unique,
  started_at timestamptz not null,
  ended_at timestamptz,
  seconds integer not null default 0,
  minutes numeric(12, 2) not null default 0,
  coins_spent integer not null default 0,
  advisor_earnings integer not null default 0,
  platform_revenue integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
`;

export async function ensureAdvisorPanelTables() {
  const sql = await getSql();
  const statements = [
    "alter table ora_advisors add column if not exists last_online_at timestamptz",
    "alter table ora_advisors add column if not exists last_offline_at timestamptz",
    "alter table ora_advisors add column if not exists current_presence_id text not null default ''",
    PRESENCE_TABLE_SQL,
    ACTIVITY_TABLE_SQL,
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] advisor panel schema", err);
    }
  }
  try {
    await sql.query(
      "create unique index if not exists ora_advisor_presence_open_idx on ora_advisor_presence (advisor_id) where ended_at is null",
    );
  } catch {
    /* index is optional — duplicates or pooled-DDL limits must not block login */
  }
}

type AdvisorRow = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  online: boolean;
  busy: boolean;
  last_online_at: string | null;
  last_offline_at: string | null;
  current_presence_id: string;
};

async function loadAdvisorForUser(userId: string) {
  const sql = await getSql();
  const [row] = await sql<AdvisorRow>`
    select id, user_id, name, status, online, busy,
           last_online_at, last_offline_at, current_presence_id
    from ora_advisors where user_id = ${userId}
  `.catch(async () => {
    const [fallback] = await sql<AdvisorRow>`
      select id, user_id, name, status, online, busy,
             null::timestamptz as last_online_at, null::timestamptz as last_offline_at,
             '' as current_presence_id
      from ora_advisors where user_id = ${userId}
    `;
    return fallback ? [fallback] : [];
  });
  return row ?? null;
}

export async function requireApprovedAdvisor(userId: string) {
  await assertActive(userId);
  try {
    await ensureAdvisorPanelTables();
  } catch (err) {
    console.error("[ora] advisor panel schema skipped", err);
  }
  const advisor = await loadAdvisorForUser(userId);
  const gate = advisorAccessGate({
    signedIn: true,
    advisorStatus: advisor?.status,
  });
  if (!gate.ok || !advisor) throw new Error(advisorDeniedMessage(gate.ok ? "not_advisor" : gate.reason));
  return advisor;
}

export async function openAdvisorPresence(advisorId: string, source = "toggle") {
  await ensureAdvisorPanelTables();
  const sql = await getSql();
  const [open] = await sql<{ id: string }>`
    select id from ora_advisor_presence where advisor_id = ${advisorId} and ended_at is null limit 1
  `;
  if (open) {
    await sql`
      update ora_advisors
      set online = true, last_online_at = coalesce(last_online_at, now()), current_presence_id = ${open.id}
      where id = ${advisorId}
    `;
    return open.id;
  }
  const id = rid("on");
  await sql`
    insert into ora_advisor_presence (id, advisor_id, started_at, source)
    values (${id}, ${advisorId}, now(), ${source})
  `;
  await sql`
    update ora_advisors
    set online = true, last_online_at = now(), current_presence_id = ${id}
    where id = ${advisorId}
  `;
  return id;
}

export async function closeAdvisorPresence(advisorId: string) {
  await ensureAdvisorPanelTables();
  const sql = await getSql();
  const [open] = await sql<{ id: string; started_at: string }>`
    select id, started_at from ora_advisor_presence
    where advisor_id = ${advisorId} and ended_at is null
    order by started_at desc limit 1
  `;
  if (open) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1000));
    await sql`
      update ora_advisor_presence
      set ended_at = now(), seconds = ${seconds}
      where id = ${open.id} and ended_at is null
    `;
  }
  await sql`
    update ora_advisors
    set last_offline_at = now(), current_presence_id = ''
    where id = ${advisorId}
  `;
}

export async function syncReadingActivity(readingId: string) {
  if (!readingId) return;
  await ensureAdvisorPanelTables();
  const sql = await getSql();
  const [row] = await sql<{
    id: string;
    advisor_id: string;
    client_id: string;
    started_at: string;
    ended_at: string | null;
    seconds: number;
    coins_spent: number;
    status: string;
  }>`
    select id, advisor_id, client_id, started_at, ended_at, seconds, coins_spent, status
    from ora_readings where id = ${readingId}
  `;
  if (!row) return;
  const split = panelSplit(row.coins_spent);
  const minutes = readingMinutes(row.seconds);
  const endedAt = row.ended_at || (row.status === "ended" ? new Date().toISOString() : null);
  const id = rid("act");
  await sql`
    insert into ora_reading_activity (
      id, advisor_id, customer_id, reading_id, started_at, ended_at, seconds, minutes,
      coins_spent, advisor_earnings, platform_revenue, updated_at
    )
    values (
      ${id}, ${row.advisor_id}, ${row.client_id}, ${row.id}, ${row.started_at}, ${endedAt},
      ${Number(row.seconds)}, ${minutes}, ${Number(row.coins_spent)},
      ${split.advisorEarnings}, ${split.platformRevenue}, now()
    )
    on conflict (reading_id) do update set
      ended_at = excluded.ended_at,
      seconds = excluded.seconds,
      minutes = excluded.minutes,
      coins_spent = excluded.coins_spent,
      advisor_earnings = excluded.advisor_earnings,
      platform_revenue = excluded.platform_revenue,
      updated_at = now()
  `;
}

async function backfillAdvisorActivity(advisorId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from ora_readings
    where advisor_id = ${advisorId} and status = 'ended'
      and id not in (select reading_id from ora_reading_activity where advisor_id = ${advisorId})
    order by started_at desc
    limit 200
  `.catch(() => []);
  for (const row of rows) {
    await syncReadingActivity(row.id);
  }
}

function windowStart(kind: "day" | "week" | "month") {
  const now = new Date();
  if (kind === "day") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (kind === "week") {
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (day - 1));
    return start;
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function sumPresence(
  rows: Array<{ started_at: string; ended_at: string | null; seconds: number }>,
  from: Date,
  to: Date,
) {
  return rows.reduce((n, row) => n + overlapSeconds(row.started_at, row.ended_at, from, to), 0);
}

export const advisorPanelSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await requireApprovedAdvisor(context.userId);
    const sql = await getSql();
    const [profile] = await sql<{ display_name: string; email: string }>`
      select display_name, email from ora_profiles where user_id = ${context.userId}
    `;
    const [photo] = await sql<{ photo_url: string; accepts_chat: boolean }>`
      select photo_url, coalesce(accepts_chat, true) as accepts_chat from ora_advisors where id = ${advisor.id}
    `.catch(async () => {
      const [fallback] = await sql<{ photo_url: string; accepts_chat: boolean }>`
        select photo_url, true as accepts_chat from ora_advisors where id = ${advisor.id}
      `;
      return fallback ? [fallback] : [];
    });
    const [open] = await sql<{ id: string; started_at: string }>`
      select id, started_at from ora_advisor_presence
      where advisor_id = ${advisor.id} and ended_at is null
      order by started_at desc limit 1
    `.catch(() => []);
    const currentSeconds = open
      ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1000))
      : 0;
    return {
      ok: true as const,
      advisorId: advisor.id,
      name: advisor.name || profile?.display_name || "Advisor",
      email: profile?.email || "",
      photoUrl: photo?.photo_url || "",
      acceptsChat: photo?.accepts_chat !== false,
      online: Boolean(advisor.online),
      busy: Boolean(advisor.busy),
      lastOnlineAt: advisor.last_online_at ? String(advisor.last_online_at) : "",
      lastOfflineAt: advisor.last_offline_at ? String(advisor.last_offline_at) : "",
      currentSeconds,
    };
  });

export const advisorOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await requireApprovedAdvisor(context.userId);
    try {
      await backfillAdvisorActivity(advisor.id);
    } catch (err) {
      console.error("[ora] advisor activity backfill", err);
    }
    const sql = await getSql();
    const presence = await sql<{ started_at: string; ended_at: string | null; seconds: number }>`
      select started_at, ended_at, seconds from ora_advisor_presence
      where advisor_id = ${advisor.id}
      order by started_at desc
      limit 400
    `.catch(() => []);
    const now = new Date();
    const today = sumPresence(presence, windowStart("day"), now);
    const week = sumPresence(presence, windowStart("week"), now);
    const month = sumPresence(presence, windowStart("month"), now);
    const [open] = presence.filter((p) => !p.ended_at);
    const currentSeconds = open
      ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1000))
      : 0;
    const [stats] = await sql<{
      readings: number;
      minutes: string | number;
      advisor_earnings: number;
      platform_revenue: number;
    }>`
      select count(*)::int as readings,
             coalesce(sum(minutes), 0) as minutes,
             coalesce(sum(advisor_earnings), 0)::int as advisor_earnings,
             coalesce(sum(platform_revenue), 0)::int as platform_revenue
      from ora_reading_activity where advisor_id = ${advisor.id}
    `.catch(() => [{ readings: 0, minutes: 0, advisor_earnings: 0, platform_revenue: 0 }]);
    const [live] = await sql<{
      id: string;
      display_name: string;
      seconds: number;
      coins_spent: number;
    }>`
      select r.id, coalesce(p.display_name, 'Client') as display_name, r.seconds, r.coins_spent
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id} and r.status = 'live'
      order by r.started_at desc limit 1
    `.catch(() => []);
    const incoming = await sql<{ id: string; display_name: string; created_at: string }>`
      select r.id, coalesce(p.display_name, 'Client') as display_name, r.created_at
      from ora_chat_requests r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id} and r.status = 'pending'
      order by r.created_at asc
    `.catch(() => []);
    return {
      advisorId: advisor.id,
      name: advisor.name,
      online: Boolean(advisor.online),
      busy: Boolean(advisor.busy),
      lastOnlineAt: advisor.last_online_at ? String(advisor.last_online_at) : "",
      lastOfflineAt: advisor.last_offline_at ? String(advisor.last_offline_at) : "",
      currentSeconds,
      onlineToday: today + (advisor.online ? currentSeconds : 0),
      onlineWeek: week + (advisor.online ? currentSeconds : 0),
      onlineMonth: month + (advisor.online ? currentSeconds : 0),
      readings: Number(stats?.readings ?? 0),
      readingMinutes: Number(stats?.minutes ?? 0),
      advisorEarnings: Number(stats?.advisor_earnings ?? 0),
      platformRevenue: Number(stats?.platform_revenue ?? 0),
      live: live
        ? {
            id: live.id,
            clientName: live.display_name,
            seconds: Number(live.seconds),
            coinsSpent: Number(live.coins_spent),
          }
        : null,
      incoming: incoming.map((r) => ({
        id: r.id,
        clientName: r.display_name,
        createdAt: String(r.created_at),
      })),
    };
  });

export const advisorCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await requireApprovedAdvisor(context.userId);
    try {
      await backfillAdvisorActivity(advisor.id);
    } catch (err) {
      console.error("[ora] advisor activity backfill", err);
    }
    const sql = await getSql();
    const rows = await sql<{
      customer_id: string;
      display_name: string;
      readings: number;
      seconds: number;
      advisor_earnings: number;
      last_at: string;
    }>`
      select a.customer_id,
             coalesce(p.display_name, 'Client') as display_name,
             count(*)::int as readings,
             coalesce(sum(a.seconds), 0)::int as seconds,
             coalesce(sum(a.advisor_earnings), 0)::int as advisor_earnings,
             max(a.started_at)::text as last_at
      from ora_reading_activity a
      left join ora_profiles p on p.user_id = a.customer_id
      where a.advisor_id = ${advisor.id}
      group by a.customer_id, p.display_name
      order by max(a.started_at) desc
      limit 80
    `.catch(() => []);
    return {
      customers: rows.map((r) => ({
        id: r.customer_id,
        name: r.display_name,
        readings: Number(r.readings),
        seconds: Number(r.seconds),
        advisorEarnings: Number(r.advisor_earnings),
        lastAt: String(r.last_at),
      })),
    };
  });

export const advisorActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await requireApprovedAdvisor(context.userId);
    try {
      await backfillAdvisorActivity(advisor.id);
    } catch (err) {
      console.error("[ora] advisor activity backfill", err);
    }
    const sql = await getSql();
    const presence = await sql<{
      id: string;
      started_at: string;
      ended_at: string | null;
      seconds: number;
    }>`
      select id, started_at, ended_at, seconds
      from ora_advisor_presence
      where advisor_id = ${advisor.id}
      order by started_at desc
      limit 40
    `.catch(() => []);
    const readings = await sql<{
      id: string;
      reading_id: string;
      customer_id: string;
      display_name: string;
      started_at: string;
      ended_at: string | null;
      seconds: number;
      minutes: string | number;
      coins_spent: number;
      advisor_earnings: number;
      platform_revenue: number;
    }>`
      select a.id, a.reading_id, a.customer_id, coalesce(p.display_name, 'Client') as display_name,
             a.started_at, a.ended_at, a.seconds, a.minutes, a.coins_spent, a.advisor_earnings, a.platform_revenue
      from ora_reading_activity a
      left join ora_profiles p on p.user_id = a.customer_id
      where a.advisor_id = ${advisor.id}
      order by a.started_at desc
      limit 40
    `.catch(() => []);
    return {
      presence: presence.map((p) => ({
        id: p.id,
        startedAt: String(p.started_at),
        endedAt: p.ended_at ? String(p.ended_at) : "",
        seconds: p.ended_at
          ? Number(p.seconds)
          : Math.max(0, Math.floor((Date.now() - new Date(p.started_at).getTime()) / 1000)),
        open: !p.ended_at,
      })),
      readings: readings.map((r) => ({
        id: r.id,
        readingId: r.reading_id,
        customerId: r.customer_id,
        customerName: r.display_name,
        startedAt: String(r.started_at),
        endedAt: r.ended_at ? String(r.ended_at) : "",
        seconds: Number(r.seconds),
        minutes: Number(r.minutes),
        coinsSpent: Number(r.coins_spent),
        advisorEarnings: Number(r.advisor_earnings),
        platformRevenue: Number(r.platform_revenue),
      })),
    };
  });

export async function advisorAdminStats(advisorIds: string[]) {
  if (!advisorIds.length) return new Map<string, AdminAdvisorStats>();
  await ensureAdvisorPanelTables();
  const sql = await getSql();
  const presence = await sql.query<{
    advisor_id: string;
    started_at: string;
    ended_at: string | null;
    seconds: number;
  }>(
    "select advisor_id, started_at, ended_at, seconds from ora_advisor_presence where advisor_id = any($1::text[])",
    [advisorIds],
  ).catch(() => []);
  const activity = await sql.query<{
    advisor_id: string;
    readings: number;
    minutes: string | number;
    advisor_earnings: number;
    platform_revenue: number;
  }>(
    `select advisor_id,
            count(*)::int as readings,
            coalesce(sum(minutes), 0) as minutes,
            coalesce(sum(advisor_earnings), 0)::int as advisor_earnings,
            coalesce(sum(platform_revenue), 0)::int as platform_revenue
     from ora_reading_activity
     where advisor_id = any($1::text[])
     group by advisor_id`,
    [advisorIds],
  ).catch(() => []);
  const now = new Date();
  const monthFrom = windowStart("month");
  const byId = new Map<string, AdminAdvisorStats>();
  for (const id of advisorIds) {
    const rows = presence.filter((p) => p.advisor_id === id);
    const act = activity.find((a) => a.advisor_id === id);
    byId.set(id, {
      onlineMonth: sumPresence(rows, monthFrom, now),
      readings: Number(act?.readings ?? 0),
      readingMinutes: Number(act?.minutes ?? 0),
      advisorEarnings: Number(act?.advisor_earnings ?? 0),
      platformRevenue: Number(act?.platform_revenue ?? 0),
    });
  }
  return byId;
}

export type AdminAdvisorStats = {
  onlineMonth: number;
  readings: number;
  readingMinutes: number;
  advisorEarnings: number;
  platformRevenue: number;
};

export async function ensureApplicationColumns() {
  const sql = await getSql();
  const statements = [
    "alter table ora_applications add column if not exists email text not null default ''",
    "alter table ora_applications add column if not exists phone text not null default ''",
    "alter table ora_applications add column if not exists country text not null default ''",
    "alter table ora_applications add column if not exists availability text not null default ''",
    "alter table ora_applications add column if not exists decided_at timestamptz",
    "alter table ora_applications add column if not exists decided_by text not null default ''",
    "alter table ora_advisors add column if not exists phone text not null default ''",
    "alter table ora_advisors add column if not exists country text not null default ''",
    "alter table ora_advisors add column if not exists availability text not null default ''",
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] application column ensure", err);
    }
  }
}

export async function insertPendingApplication(input: {
  userId: string;
  name: string;
  bio: string;
  experience: string;
  specialties: string;
  rateCoins: number;
  photoUrl: string;
  videoUrl: string;
  legalName: string;
  languages: string;
  years: number;
  email: string;
  phone: string;
  country: string;
  availability: string;
}) {
  const { assertDeployedUsesNeon, getDbSource } = await import("./db");
  const { safeApplicationPhoto } = await import("./ora-advisor-auth");
  assertDeployedUsesNeon();
  await ensureApplicationColumns();
  const sql = await getSql();
  const photoUrl = safeApplicationPhoto(input.photoUrl);
  const videoUrl = safeApplicationPhoto(input.videoUrl);
  const [live] = await sql<{ id: string }>`
    select id from ora_advisors where user_id = ${input.userId} and status = 'live' limit 1
  `;
  if (live) throw new Error("This account is already an approved advisor.");
  await sql`update ora_applications set status = 'withdrawn' where user_id = ${input.userId} and status = 'pending'`;
  const id = rid("app");
  try {
    await sql`
      insert into ora_applications (
        id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, status,
        legal_name, languages, years, email, phone, country, availability
      )
      values (
        ${id}, ${input.userId}, ${input.name}, ${input.bio}, ${input.experience}, ${input.specialties},
        ${input.rateCoins}, ${photoUrl}, ${videoUrl}, 'pending', ${input.legalName}, ${input.languages},
        ${input.years}, ${input.email}, ${input.phone}, ${input.country}, ${input.availability}
      )
    `;
  } catch (err) {
    console.error("[ora] application insert (full columns) failed", err);
    try {
      await sql`
        insert into ora_applications (
          id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, status,
          legal_name, languages, years
        )
        values (
          ${id}, ${input.userId}, ${input.name}, ${input.bio}, ${input.experience}, ${input.specialties},
          ${input.rateCoins}, ${photoUrl}, ${videoUrl}, 'pending', ${input.legalName}, ${input.languages},
          ${input.years}
        )
      `;
    } catch (err2) {
      console.error("[ora] application insert failed", err2);
      throw new Error("Could not save the application to the database. Try again.");
    }
  }
  const [row] = await sql<{ id: string; status: string; email?: string }>`
    select id, status, email from ora_applications where id = ${id}
  `.catch(async () => sql<{ id: string; status: string }>`select id, status from ora_applications where id = ${id}`);
  if (!row?.id || String(row.status) !== "pending") {
    console.error("[ora] application insert did not persist", { id, db: getDbSource() });
    throw new Error("Application did not save. Try again.");
  }
  console.info("[ora] application saved", { id: row.id, db: getDbSource() });
  return { id: row.id, status: "pending" as const, email: String(("email" in row && row.email) || input.email) };
}

export async function listAdvisorApplications() {
  const { assertDeployedUsesNeon } = await import("./db");
  assertDeployedUsesNeon();
  await ensureApplicationColumns();
  const sql = await getSql();
  try {
    const rows = await sql<{
      id: string;
      user_id: string;
      name: string;
      bio: string;
      experience: string;
      specialties: string;
      rate_coins: number;
      photo_url: string;
      video_url: string;
      status: string;
      created_at: string;
      legal_name: string;
      languages: string;
      years: number;
      email: string;
      phone: string;
      country: string;
      availability: string;
    }>`
      select id, user_id, name, bio, experience, specialties, rate_coins,
             case when length(coalesce(photo_url, '')) <= 80000 then photo_url else '' end as photo_url,
             video_url, status, created_at::text as created_at, legal_name, languages, years,
             coalesce(email, '') as email, coalesce(phone, '') as phone,
             coalesce(country, '') as country, coalesce(availability, '') as availability
      from ora_applications
      order by created_at desc
      limit 80
    `;
    return rows;
  } catch {
    const rows = await sql<{
      id: string;
      user_id: string;
      name: string;
      bio: string;
      experience: string;
      specialties: string;
      rate_coins: number;
      photo_url: string;
      video_url: string;
      status: string;
      created_at: string;
      legal_name: string;
      languages: string;
      years: number;
      email: string;
      phone: string;
      country: string;
      availability: string;
    }>`
      select id, user_id, name, bio, experience, specialties, rate_coins,
             case when length(coalesce(photo_url, '')) <= 80000 then photo_url else '' end as photo_url,
             video_url, status, created_at::text as created_at, legal_name, languages, years,
             '' as email, '' as phone, '' as country, '' as availability
      from ora_applications
      order by created_at desc
      limit 80
    `;
    return rows;
  }
}

export const advisorEntryState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertActive(context.userId);
    const advisor = await loadAdvisorForUser(context.userId);
    const sql = await getSql();
    const [app] = await sql<{
      id: string;
      name: string;
      legal_name: string;
      email: string;
      phone: string;
      country: string;
      specialties: string;
      rate_coins: number;
      years: number;
      status: string;
      created_at: string;
      availability: string;
    }>`
      select id, name, legal_name, email, phone, country, specialties, rate_coins, years, status, created_at, availability
      from ora_applications
      where user_id = ${context.userId}
      order by created_at desc
      limit 1
    `.catch(
      async () =>
        sql<{
          id: string;
          name: string;
          legal_name: string;
          email: string;
          phone: string;
          country: string;
          specialties: string;
          rate_coins: number;
          years: number;
          status: string;
          created_at: string;
          availability: string;
        }>`
          select id, name, legal_name, '' as email, '' as phone, '' as country, specialties, rate_coins, years, status, created_at, '' as availability
          from ora_applications
          where user_id = ${context.userId}
          order by created_at desc
          limit 1
        `,
    );
    const application = app
      ? {
          id: app.id,
          name: app.name,
          legalName: app.legal_name,
          email: app.email,
          phone: app.phone,
          country: app.country,
          specialties: app.specialties,
          rateCoins: Number(app.rate_coins),
          years: Number(app.years),
          status: app.status,
          createdAt: String(app.created_at),
          availability: app.availability,
        }
      : null;
    const kind = advisorDeskKind({
      advisorStatus: advisor?.status,
      applicationStatus: application?.status,
    });
    const name = advisor?.name || application?.name || "";
    if (kind === "live") return { kind, name, application };
    if (kind === "paused" || kind === "suspended") return { kind, name, application };
    if (kind === "pending") return { kind, name, application };
    if (kind === "declined") return { kind, name, application };
    return { kind: "none" as const, name, application };
  });

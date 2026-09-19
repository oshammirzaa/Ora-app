import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { addLedger, loadCategories, requireRate, rid } from "@/lib/ora";
import { requireApprovedAdvisor } from "@/lib/ora-advisor";
import { overlapSeconds, panelSplit, readingMinutes } from "@/lib/ora-advisor-auth";
import {
  averageOnlineSeconds,
  classifyClient,
  customerIsActive,
  includeChatRequestAsOrder,
  joinSpecialties,
  matchesInboxFilter,
  matchesOrderFilter,
  normalizeGender,
  orderBucket,
  parseGalleryJson,
  parseQuickReplies,
  serializeGallery,
  statsWindow,
  visibleAdvisorPhoto,
  type GalleryItem,
  type InboxFilter,
  type OrderFilter,
  type StatsRange,
} from "@/lib/ora-advisor-desk-stats";


const NOTE_SQL = `
create table if not exists ora_advisor_notes (
  advisor_id text not null,
  customer_id text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`;

const INBOX_SQL = `
create table if not exists ora_advisor_inbox (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  last_body text not null default '',
  last_role text not null default 'advisor',
  last_at timestamptz not null default now(),
  unread_advisor integer not null default 0,
  unread_customer integer not null default 0,
  unique (advisor_id, customer_id)
)`;

const INBOX_MSG_SQL = `
create table if not exists ora_advisor_inbox_messages (
  id text primary key,
  thread_id text not null,
  advisor_id text not null,
  customer_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
)`;

const GIFT_SQL = `
create table if not exists ora_advisor_gifts (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  seconds integer not null,
  created_at timestamptz not null default now()
)`;

const PAY_SQL = `
create table if not exists ora_advisor_pay_requests (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  coins integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
)`;

const BLOCK_SQL = `
create table if not exists ora_advisor_blocks (
  advisor_id text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`;

const REPLY_SQL = `
create table if not exists ora_advisor_quick_replies (
  id text primary key,
  advisor_id text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
)`;

export async function ensureAdvisorDeskTables() {
  const sql = await getSql();
  const statements = [
    "alter table ora_advisors add column if not exists accepts_chat boolean not null default true",
    "alter table ora_advisors add column if not exists gender text not null default ''",
    "alter table ora_advisors add column if not exists headline text not null default ''",
    "alter table ora_advisors add column if not exists reading_notice text not null default ''",
    "alter table ora_advisors add column if not exists quick_greeting text not null default ''",
    "alter table ora_advisors add column if not exists auto_response text not null default ''",
    "alter table ora_advisors add column if not exists auto_live_greeting text not null default ''",
    "alter table ora_advisors add column if not exists gallery_json text not null default '[]'",
    NOTE_SQL,
    INBOX_SQL,
    INBOX_MSG_SQL,
    GIFT_SQL,
    PAY_SQL,
    BLOCK_SQL,
    REPLY_SQL,
    "create index if not exists ora_advisor_inbox_adv_idx on ora_advisor_inbox (advisor_id, last_at desc)",
    "create index if not exists ora_advisor_inbox_msg_idx on ora_advisor_inbox_messages (thread_id, created_at)",
    "create index if not exists ora_advisor_blocks_adv_idx on ora_advisor_blocks (advisor_id, created_at desc)",
    "create index if not exists ora_advisor_quick_replies_adv_idx on ora_advisor_quick_replies (advisor_id, sort_order, created_at)",
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] advisor desk schema", err);
    }
  }
}


async function advisorDesk(userId: string) {
  const advisor = await requireApprovedAdvisor(userId);
  try {
    await ensureAdvisorDeskTables();
  } catch (err) {
    console.error("[ora] advisor desk schema skipped", err);
  }
  return advisor;
}

function clip(value: unknown, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

export const advisorOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { filter?: string; q?: string }) => ({
    filter: String(input?.filter || "all") as OrderFilter,
    q: clip(input?.q, 80).toLowerCase(),
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const requests = await sql<{
      id: string;
      client_id: string;
      display_name: string;
      status: string;
      created_at: string;
      reading_id: string;
    }>`
      select r.id, r.client_id, coalesce(p.display_name, 'Client') as display_name,
             r.status, r.created_at::text as created_at, coalesce(r.reading_id, '') as reading_id
      from ora_chat_requests r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id}
      order by r.created_at desc
      limit 120
    `.catch(() => []);
    const readings = await sql<{
      id: string;
      client_id: string;
      display_name: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      seconds: number;
    }>`
      select r.id, r.client_id, coalesce(p.display_name, 'Client') as display_name,
             r.status, r.started_at::text as started_at,
             r.ended_at::text as ended_at, r.seconds
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id}
      order by r.started_at desc
      limit 120
    `.catch(() => []);

    const rows = [
      ...requests
        .filter((r) => includeChatRequestAsOrder(r.status, r.reading_id))
        .map((r) => {
          const bucket = orderBucket({ kind: "request", status: r.status });
          return {
            id: r.id,
            customerId: r.client_id,
            customerName: r.display_name,
            photoUrl: "",
            service: "Live text chat",
            status: bucket === "other" ? r.status : bucket,
            bucket,
            at: String(r.created_at),
            readingId: r.reading_id || "",
            kind: "request" as const,
          };
        }),
      ...readings.map((r) => {
        const bucket = orderBucket({ kind: "reading", status: r.status });
        return {
          id: r.id,
          customerId: r.client_id,
          customerName: r.display_name,
          photoUrl: "",
          service: "Live text chat",
          status: bucket === "other" ? r.status : bucket,
          bucket,
          at: String(r.started_at),
          readingId: r.id,
          kind: "reading" as const,
        };
      }),
    ]
      .filter((row) => matchesOrderFilter(row.bucket, data.filter))
      .filter((row) => !data.q || row.customerName.toLowerCase().includes(data.q) || row.id.toLowerCase().includes(data.q))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return { filter: data.filter, orders: rows.slice(0, 80) };
  });

export const advisorClientList = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { q?: string }) => ({ q: clip(input?.q, 80).toLowerCase() }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      customer_id: string;
      display_name: string;
      readings: number;
      seconds: number;
      coins_spent: number;
      advisor_earnings: number;
      platform_revenue: number;
      last_at: string;
    }>`
      select a.customer_id,
             coalesce(p.display_name, 'Client') as display_name,
             count(*)::int as readings,
             coalesce(sum(a.seconds), 0)::int as seconds,
             coalesce(sum(a.coins_spent), 0)::int as coins_spent,
             coalesce(sum(a.advisor_earnings), 0)::int as advisor_earnings,
             coalesce(sum(a.platform_revenue), 0)::int as platform_revenue,
             max(a.started_at)::text as last_at
      from ora_reading_activity a
      left join ora_profiles p on p.user_id = a.customer_id
      where a.advisor_id = ${advisor.id}
      group by a.customer_id, p.display_name
      order by max(a.started_at) desc
      limit 120
    `.catch(async () =>
      sql<{
        customer_id: string;
        display_name: string;
        readings: number;
        seconds: number;
        coins_spent: number;
        advisor_earnings: number;
        platform_revenue: number;
        last_at: string;
      }>`
        select r.client_id as customer_id,
               coalesce(p.display_name, 'Client') as display_name,
               count(*)::int as readings,
               coalesce(sum(r.seconds), 0)::int as seconds,
               coalesce(sum(r.coins_spent), 0)::int as coins_spent,
               coalesce(sum(r.advisor_earned), 0)::int as advisor_earnings,
               coalesce(sum(r.platform_fee), 0)::int as platform_revenue,
               max(r.started_at)::text as last_at
        from ora_readings r
        left join ora_profiles p on p.user_id = r.client_id
        where r.advisor_id = ${advisor.id}
        group by r.client_id, p.display_name
        order by max(r.started_at) desc
        limit 120
      `.catch(() => []),
    );
    const notes = await sql<{ customer_id: string; body: string }>`
      select customer_id, body from ora_advisor_notes where advisor_id = ${advisor.id}
    `.catch(() => []);
    const noteMap = new Map(notes.map((n) => [n.customer_id, n.body]));
    const live = await sql<{ client_id: string }>`
      select client_id from ora_readings where advisor_id = ${advisor.id} and status = 'live'
    `.catch(() => []);
    const liveIds = new Set(live.map((r) => r.client_id));
    const clients = rows
      .map((r) => {
        const readings = Number(r.readings);
        return {
          id: r.customer_id,
          name: r.display_name,
          readings,
          seconds: Number(r.seconds),
          charged: Number(r.coins_spent),
          advisorShare: Number(r.advisor_earnings),
          oraShare: Number(r.platform_revenue),
          lastAt: String(r.last_at),
          repeat: classifyClient(readings) === "repeat",
          note: noteMap.get(r.customer_id) || "",
          live: liveIds.has(r.customer_id),
        };
      })
      .filter((c) => !data.q || c.name.toLowerCase().includes(data.q) || c.note.toLowerCase().includes(data.q));
    return { clients };
  });

export const saveAdvisorClientNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; body: string }) => ({
    customerId: clip(input.customerId, 80),
    body: clip(input.body, 4000),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    await sql`
      insert into ora_advisor_notes (advisor_id, customer_id, body, updated_at)
      values (${advisor.id}, ${data.customerId}, ${data.body}, now())
      on conflict (advisor_id, customer_id) do update set body = excluded.body, updated_at = now()
    `;
    return { ok: true as const };
  });

function sumPresence(
  rows: Array<{ started_at: string; ended_at: string | null; seconds: number }>,
  from: Date | null,
  to: Date,
) {
  if (!from) {
    return rows.reduce((n, row) => {
      const end = row.ended_at ? new Date(row.ended_at).getTime() : to.getTime();
      const start = new Date(row.started_at).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return n;
      return n + Math.max(0, Math.floor((Math.min(end, to.getTime()) - start) / 1000));
    }, 0);
  }
  return rows.reduce((n, row) => n + overlapSeconds(row.started_at, row.ended_at, from, to), 0);
}

function inWindow(iso: string, from: Date | null, to: Date) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (from && t < from.getTime()) return false;
  return t <= to.getTime();
}

export const advisorStatistics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { range?: string; day?: string }) => ({
    range: (["day", "week", "month", "all"].includes(String(input?.range)) ? input?.range : "day") as StatsRange,
    day: clip(input?.day, 12),
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const window = statsWindow(data.range, new Date(), data.day || undefined);
    const presence = await sql<{ started_at: string; ended_at: string | null; seconds: number }>`
      select started_at, ended_at, seconds from ora_advisor_presence
      where advisor_id = ${advisor.id}
      order by started_at desc
      limit 800
    `.catch(() => []);
    const onlineSeconds = sumPresence(presence, window.from, window.to);
    const days = new Set(
      presence
        .filter((p) => inWindow(p.started_at, window.from, window.to) || !p.ended_at)
        .map((p) => new Date(p.started_at).toISOString().slice(0, 10)),
    );
    const requests = await sql<{ status: string; created_at: string }>`
      select status, created_at::text as created_at from ora_chat_requests where advisor_id = ${advisor.id}
    `.catch(() => []);
    const reqIn = requests.filter((r) => inWindow(r.created_at, window.from, window.to));
    const accepted = reqIn.filter((r) => r.status === "accepted").length;
    const declined = reqIn.filter((r) => r.status === "declined" || r.status === "expired").length;
    const activity = await sql<{
      customer_id: string;
      started_at: string;
      ended_at: string | null;
      seconds: number;
      minutes: string | number;
      coins_spent: number;
      advisor_earnings: number;
      status: string | null;
    }>`
      select a.customer_id, a.started_at::text as started_at, a.ended_at::text as ended_at,
             a.seconds, a.minutes, a.coins_spent, a.advisor_earnings, r.status
      from ora_reading_activity a
      left join ora_readings r on r.id = a.reading_id
      where a.advisor_id = ${advisor.id}
    `.catch(async () =>
      sql<{
        customer_id: string;
        started_at: string;
        ended_at: string | null;
        seconds: number;
        minutes: string | number;
        coins_spent: number;
        advisor_earnings: number;
        status: string | null;
      }>`
        select client_id as customer_id, started_at::text as started_at, ended_at::text as ended_at,
               seconds, (seconds::numeric / 60) as minutes, coins_spent, advisor_earned as advisor_earnings, status
        from ora_readings where advisor_id = ${advisor.id}
      `.catch(() => []),
    );
    const actIn = activity.filter((r) => inWindow(r.started_at, window.from, window.to));
    const completed = actIn.filter((r) => (r.status || "ended") === "ended" || Boolean(r.ended_at)).length;
    const cancelled = actIn.filter((r) => r.status === "cancelled" || r.status === "canceled").length;
    const byClient = new Map<string, number>();
    for (const row of actIn) byClient.set(row.customer_id, (byClient.get(row.customer_id) || 0) + 1);
    const firstTime = [...byClient.values()].filter((n) => n === 1).length;
    const repeat = [...byClient.values()].filter((n) => n >= 2).length;
    const minutes = actIn.reduce((n, r) => n + Number(r.minutes || readingMinutes(r.seconds)), 0);
    const earnings = actIn.reduce((n, r) => n + Number(r.advisor_earnings || 0), 0);
    const [open] = presence.filter((p) => !p.ended_at);
    const currentSeconds = open
      ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1000))
      : 0;
    return {
      range: data.range,
      day: data.day,
      onlineSeconds,
      averageOnlineSeconds: averageOnlineSeconds(onlineSeconds, days.size),
      accepted,
      declined,
      completed,
      cancelled,
      totalClients: byClient.size,
      firstTimeClients: firstTime,
      repeatClients: repeat,
      minutes: Math.round(minutes * 100) / 100,
      earnings,
      currentSeconds,
      online: Boolean(advisor.online),
      busy: Boolean(advisor.busy),
    };
  });

export const advisorInboxList = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { filter?: string; q?: string }) => ({
    filter: String(input?.filter || "all") as InboxFilter,
    q: clip(input?.q, 80).toLowerCase(),
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const threads = await sql<{
      id: string;
      customer_id: string;
      display_name: string;
      last_body: string;
      last_role: string;
      last_at: string;
      unread_advisor: number;
    }>`
      select i.id, i.customer_id, coalesce(p.display_name, 'Client') as display_name,
             i.last_body, i.last_role, i.last_at::text as last_at, i.unread_advisor
      from ora_advisor_inbox i
      left join ora_profiles p on p.user_id = i.customer_id
      where i.advisor_id = ${advisor.id}
      order by i.last_at desc
      limit 80
    `.catch(() => []);
    const fromReadings = await sql<{
      customer_id: string;
      display_name: string;
      last_at: string;
      body: string;
    }>`
      select r.client_id as customer_id, coalesce(p.display_name, 'Client') as display_name,
             r.started_at::text as last_at, '' as body
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id}
      order by r.started_at desc
      limit 80
    `.catch(() => []);
    const live = await sql<{ client_id: string }>`
      select client_id from ora_readings where advisor_id = ${advisor.id} and status = 'live'
    `.catch(() => []);
    const liveIds = new Set(live.map((r) => r.client_id));
    const seen = new Set(threads.map((t) => t.customer_id));
    const merged = [
      ...threads.map((t) => ({
        id: t.id,
        customerId: t.customer_id,
        name: t.display_name,
        lastBody: t.last_body,
        lastRole: t.last_role,
        lastAt: t.last_at,
        unread: Number(t.unread_advisor) || 0,
        paying: liveIds.has(t.customer_id),
        active: liveIds.has(t.customer_id) || customerIsActive(t.last_at),
      })),
      ...fromReadings
        .filter((r) => !seen.has(r.customer_id))
        .map((r) => ({
          id: `reading:${r.customer_id}`,
          customerId: r.customer_id,
          name: r.display_name,
          lastBody: r.body || "Live text chat",
          lastRole: "client",
          lastAt: r.last_at,
          unread: 0,
          paying: liveIds.has(r.customer_id),
          active: liveIds.has(r.customer_id) || customerIsActive(r.last_at),
        })),
    ]
      .filter((row) => matchesInboxFilter(row, data.filter))
      .filter((row) => !data.q || row.name.toLowerCase().includes(data.q) || row.lastBody.toLowerCase().includes(data.q))
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    return { threads: merged };
  });

async function loadOrCreateThread(advisorId: string, customerId: string) {
  const sql = await getSql();
  const [existing] = await sql<{ id: string }>`
    select id from ora_advisor_inbox where advisor_id = ${advisorId} and customer_id = ${customerId}
  `;
  if (existing) return existing.id;
  const id = rid("th");
  await sql`
    insert into ora_advisor_inbox (id, advisor_id, customer_id, last_body, last_role, last_at)
    values (${id}, ${advisorId}, ${customerId}, '', 'advisor', now())
  `;
  return id;
}

export const advisorThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string }) => ({ customerId: clip(input.customerId, 80) }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const threadId = await loadOrCreateThread(advisor.id, data.customerId);
    await sql`
      update ora_advisor_inbox set unread_advisor = 0
      where id = ${threadId} and advisor_id = ${advisor.id}
    `;
    const [profile] = await sql<{ display_name: string }>`
      select display_name from ora_profiles where user_id = ${data.customerId}
    `;
    const messages = await sql<{ id: string; role: string; body: string; created_at: string }>`
      select id, role, body, created_at::text as created_at
      from ora_advisor_inbox_messages
      where thread_id = ${threadId}
      order by created_at asc
      limit 200
    `.catch(() => []);
    const [note] = await sql<{ body: string }>`
      select body from ora_advisor_notes where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
    `.catch(() => []);
    const [live] = await sql<{ id: string }>`
      select id from ora_readings
      where advisor_id = ${advisor.id} and client_id = ${data.customerId} and status = 'live'
      limit 1
    `.catch(() => []);
    const [blocked] = await sql<{ n: number }>`
      select 1 as n from ora_advisor_blocks
      where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
      limit 1
    `.catch(() => []);
    return {
      threadId,
      customerId: data.customerId,
      name: profile?.display_name || "Client",
      note: note?.body || "",
      liveReadingId: live?.id || "",
      blocked: Boolean(blocked),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role as "advisor" | "client",
        body: m.body,
        at: m.created_at,
      })),
    };
  });

export const sendAdvisorInboxMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; body: string }) => ({
    customerId: clip(input.customerId, 80),
    body: clip(input.body, 2000),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    if (!data.body) throw new Error("Write a message.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const threadId = await loadOrCreateThread(advisor.id, data.customerId);
    const id = rid("im");
    await sql`
      insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body)
      values (${id}, ${threadId}, ${advisor.id}, ${data.customerId}, 'advisor', ${data.body})
    `;
    await sql`
      update ora_advisor_inbox
      set last_body = ${data.body}, last_role = 'advisor', last_at = now(), unread_customer = unread_customer + 1
      where id = ${threadId}
    `;
    return { id };
  });

export const giftClientMinutes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; seconds?: number }) => ({
    customerId: clip(input.customerId, 80),
    seconds: Math.min(1800, Math.max(30, Math.floor(Number(input.seconds) || 180))),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [wallet] = await sql<{ user_id: string }>`select user_id from ora_wallets where user_id = ${data.customerId}`;
    if (!wallet) throw new Error("That client has no wallet yet.");
    await sql`
      update ora_wallets set bonus_seconds = bonus_seconds + ${data.seconds} where user_id = ${data.customerId}
    `;
    const id = rid("gift");
    await sql`
      insert into ora_advisor_gifts (id, advisor_id, customer_id, seconds)
      values (${id}, ${advisor.id}, ${data.customerId}, ${data.seconds})
    `;
    await addLedger(data.customerId, "gift", 0, data.seconds, `Advisor gift · ${Math.round(data.seconds / 60)} free minutes`, id);
    const threadId = await loadOrCreateThread(advisor.id, data.customerId);
    const mid = rid("im");
    const body = `I sent you ${Math.round(data.seconds / 60)} free minutes.`;
    await sql`
      insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body)
      values (${mid}, ${threadId}, ${advisor.id}, ${data.customerId}, 'advisor', ${body})
    `;
    await sql`
      update ora_advisor_inbox
      set last_body = ${body}, last_role = 'advisor', last_at = now(), unread_customer = unread_customer + 1
      where id = ${threadId}
    `;
    return { ok: true as const, seconds: data.seconds };
  });

export const requestClientPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; coins?: number }) => ({
    customerId: clip(input.customerId, 80),
    coins: Math.min(5000, Math.max(10, Math.floor(Number(input.coins) || 100))),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const id = rid("preq");
    await sql`
      insert into ora_advisor_pay_requests (id, advisor_id, customer_id, coins, status)
      values (${id}, ${advisor.id}, ${data.customerId}, ${data.coins}, 'pending')
    `;
    const threadId = await loadOrCreateThread(advisor.id, data.customerId);
    const mid = rid("im");
    const body = `Payment request: ${data.coins} coins to continue.`;
    await sql`
      insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body)
      values (${mid}, ${threadId}, ${advisor.id}, ${data.customerId}, 'advisor', ${body})
    `;
    await sql`
      update ora_advisor_inbox
      set last_body = ${body}, last_role = 'advisor', last_at = now(), unread_customer = unread_customer + 1
      where id = ${threadId}
    `;
    return { ok: true as const, id, coins: data.coins };
  });

export const setAcceptsChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { accepts: boolean }) => ({ accepts: Boolean(input.accepts) }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    try {
      await sql`update ora_advisors set accepts_chat = ${data.accepts} where id = ${advisor.id}`;
    } catch (err) {
      console.error("[ora] accepts_chat update", err);
      throw new Error("Could not update live chat availability.");
    }
    if (!data.accepts) {
      await sql`update ora_chat_requests set status = 'expired' where advisor_id = ${advisor.id} and status = 'pending'`;
    }
    return { accepts: data.accepts };
  });

export const advisorDeskHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [profile] = await sql<{ display_name: string; email: string }>`
      select display_name, email from ora_profiles where user_id = ${context.userId}
    `;
    const [row] = await sql<{
      photo_url: string;
      rating: number;
      reviews: number;
      accepts_chat: boolean;
      online: boolean;
      busy: boolean;
      name: string;
      is_new: boolean;
    }>`
      select photo_url, rating, reviews, coalesce(accepts_chat, true) as accepts_chat, online, busy, name,
             coalesce(is_new, false) as is_new
      from ora_advisors where id = ${advisor.id}
    `.catch(async () => {
      const [fallback] = await sql<{
        photo_url: string;
        rating: number;
        reviews: number;
        accepts_chat: boolean;
        online: boolean;
        busy: boolean;
        name: string;
        is_new: boolean;
      }>`
        select photo_url, rating, reviews, true as accepts_chat, online, busy, name, coalesce(is_new, false) as is_new
        from ora_advisors where id = ${advisor.id}
      `;
      return fallback ? [fallback] : [];
    });
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const presence = await sql<{ started_at: string; ended_at: string | null; seconds: number }>`
      select started_at, ended_at, seconds from ora_advisor_presence
      where advisor_id = ${advisor.id}
      order by started_at desc
      limit 400
    `.catch(() => []);
    const onlineToday = sumPresence(presence, start, new Date());
    const [open] = await sql<{ started_at: string }>`
      select started_at from ora_advisor_presence
      where advisor_id = ${advisor.id} and ended_at is null
      order by started_at desc limit 1
    `.catch(() => []);
    const currentSeconds = open
      ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1000))
      : 0;
    const todaySeconds = presence.some((p) => !p.ended_at)
      ? onlineToday
      : onlineToday + (open ? overlapSeconds(open.started_at, null, start, new Date()) : 0);
    const requests = await sql<{ status: string }>`
      select status from ora_chat_requests
      where advisor_id = ${advisor.id} and created_at >= ${start.toISOString()}
    `.catch(() => []);
    const accepted = requests.filter((r) => r.status === "accepted").length;
    const declined = requests.filter((r) => r.status === "declined" || r.status === "expired").length;
    const [earn] = await sql<{ today: number }>`
      select coalesce(sum(advisor_earned), 0)::int as today
      from ora_readings
      where advisor_id = ${advisor.id} and started_at >= ${start.toISOString()}
    `.catch(() => [{ today: 0 }]);
    return {
      advisorId: advisor.id,
      name: row?.name || profile?.display_name || advisor.name,
      email: profile?.email || "",
      photoUrl: visibleAdvisorPhoto(row?.photo_url),
      rating: row?.is_new ? 0 : Number(row?.rating ?? 0),
      reviews: row?.is_new ? 0 : Number(row?.reviews ?? 0),
      online: Boolean(row?.online ?? advisor.online),
      busy: Boolean(row?.busy ?? advisor.busy),
      acceptsChat: row?.accepts_chat !== false,
      onlineToday: todaySeconds,
      currentSeconds,
      accepted,
      declined,
      earningsToday: Number(earn?.today ?? 0),
    };
  });

export const advisorRevenueDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      customer_id: string;
      display_name: string;
      started_at: string;
      status: string;
      coins_spent: number;
      advisor_earned: number;
      platform_fee: number;
      seconds: number;
    }>`
      select r.id, r.client_id as customer_id, coalesce(p.display_name, 'Client') as display_name,
             r.started_at::text as started_at, r.status, r.coins_spent, r.advisor_earned, r.platform_fee, r.seconds
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id}
      order by r.started_at desc
      limit 80
    `.catch(() => []);
    return {
      rows: rows.map((r) => {
        const gross = Number(r.coins_spent);
        const split = panelSplit(gross);
        return {
          id: r.id,
          customerId: r.customer_id,
          customerName: r.display_name,
          at: r.started_at,
          status: r.status,
          service: "Live text chat",
          seconds: Number(r.seconds),
          gross,
          advisorShare: Number(r.advisor_earned) || split.advisorEarnings,
          oraShare: Number(r.platform_fee) || split.platformRevenue,
        };
      }),
    };
  });

function clipText(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

export type AdvisorProfileEdit = {
  name: string;
  gender: string;
  headline: string;
  bio: string;
  experience: string;
  specialties: string;
  languages: string;
  years: number;
  rateCoins: number;
  photoUrl: string;
  videoUrl: string;
  gallery: GalleryItem[];
  readingNotice: string;
  quickGreeting: string;
  autoResponse: string;
  autoLiveGreeting: string;
  categories: Array<{ id: string; name: string }>;
};

export const getAdvisorProfileEdit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [row] = await sql<{
      name: string;
      gender: string;
      headline: string;
      bio: string;
      experience: string;
      specialties: string;
      languages: string;
      years: number;
      rate_coins: number;
      photo_url: string;
      video_url: string;
      gallery_json: string;
      reading_notice: string;
      quick_greeting: string;
      auto_response: string;
      auto_live_greeting: string;
    }>`
      select name, coalesce(gender, '') as gender, coalesce(headline, '') as headline, bio, experience, specialties,
             languages, years, rate_coins, photo_url, video_url, coalesce(gallery_json, '[]') as gallery_json,
             coalesce(reading_notice, '') as reading_notice, coalesce(quick_greeting, '') as quick_greeting,
             coalesce(auto_response, '') as auto_response, coalesce(auto_live_greeting, '') as auto_live_greeting
      from ora_advisors where id = ${advisor.id}
    `.catch(async () => {
      const [fallback] = await sql<{
        name: string;
        gender: string;
        headline: string;
        bio: string;
        experience: string;
        specialties: string;
        languages: string;
        years: number;
        rate_coins: number;
        photo_url: string;
        video_url: string;
        gallery_json: string;
        reading_notice: string;
        quick_greeting: string;
        auto_response: string;
        auto_live_greeting: string;
      }>`
        select name, '' as gender, '' as headline, bio, experience, specialties, languages, years, rate_coins,
               photo_url, video_url, '[]' as gallery_json, '' as reading_notice, '' as quick_greeting,
               '' as auto_response, '' as auto_live_greeting
        from ora_advisors where id = ${advisor.id}
      `;
      return fallback ? [fallback] : [];
    });
    const categories = await loadCategories(true).catch(() => []);
    return {
      name: row?.name || advisor.name,
      gender: normalizeGender(row?.gender),
      headline: String(row?.headline || ""),
      bio: String(row?.bio || ""),
      experience: String(row?.experience || ""),
      specialties: String(row?.specialties || ""),
      languages: String(row?.languages || "English"),
      years: Number(row?.years || 0),
      rateCoins: Number(row?.rate_coins || 0),
      photoUrl: visibleAdvisorPhoto(row?.photo_url),
      videoUrl: String(row?.video_url || ""),
      gallery: parseGalleryJson(row?.gallery_json),
      readingNotice: String(row?.reading_notice || ""),
      quickGreeting: String(row?.quick_greeting || ""),
      autoResponse: String(row?.auto_response || ""),
      autoLiveGreeting: String(row?.auto_live_greeting || ""),
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    } satisfies AdvisorProfileEdit;
  });

export const saveAdvisorProfileEdit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    name: string;
    gender?: string;
    headline?: string;
    bio: string;
    experience: string;
    specialties: string;
    languages: string;
    years: number;
    rateCoins: number;
    photoUrl?: string;
    videoUrl?: string;
    gallery?: GalleryItem[];
    readingNotice?: string;
    quickGreeting?: string;
    autoResponse?: string;
    autoLiveGreeting?: string;
  }) => ({
    name: clipText(input.name, 80),
    gender: normalizeGender(input.gender),
    headline: clipText(input.headline, 160),
    bio: clipText(input.bio, 1200),
    experience: clipText(input.experience, 800),
    specialties: joinSpecialties(input.specialties),
    languages: clipText(input.languages, 80) || "English",
    years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
    rateCoins: requireRate(input.rateCoins),
    photoUrl: input.photoUrl ? visibleAdvisorPhoto(String(input.photoUrl).slice(0, 400_000)) : undefined,
    videoUrl: clipText(input.videoUrl, 500),
    gallery: parseGalleryJson(input.gallery),
    readingNotice: clipText(input.readingNotice, 400),
    quickGreeting: clipText(input.quickGreeting, 280),
    autoResponse: clipText(input.autoResponse, 400),
    autoLiveGreeting: clipText(input.autoLiveGreeting, 400),
  }))
  .handler(async ({ context, data }) => {
    if (!data.name) throw new Error("Display name is required.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const gallery = serializeGallery(data.gallery);
    const photo = data.photoUrl || undefined;
    try {
      if (photo) {
        await sql`
          update ora_advisors
          set name = ${data.name}, gender = ${data.gender}, headline = ${data.headline}, bio = ${data.bio},
              experience = ${data.experience}, specialties = ${data.specialties}, languages = ${data.languages},
              years = ${data.years}, rate_coins = ${data.rateCoins}, photo_url = ${photo}, video_url = ${data.videoUrl},
              gallery_json = ${gallery}, reading_notice = ${data.readingNotice}, quick_greeting = ${data.quickGreeting},
              auto_response = ${data.autoResponse}, auto_live_greeting = ${data.autoLiveGreeting}
          where id = ${advisor.id}
        `;
      } else {
        await sql`
          update ora_advisors
          set name = ${data.name}, gender = ${data.gender}, headline = ${data.headline}, bio = ${data.bio},
              experience = ${data.experience}, specialties = ${data.specialties}, languages = ${data.languages},
              years = ${data.years}, rate_coins = ${data.rateCoins}, video_url = ${data.videoUrl},
              gallery_json = ${gallery}, reading_notice = ${data.readingNotice}, quick_greeting = ${data.quickGreeting},
              auto_response = ${data.autoResponse}, auto_live_greeting = ${data.autoLiveGreeting}
          where id = ${advisor.id}
        `;
      }
    } catch (err) {
      console.error("[ora] save advisor profile extras", err);
      if (photo) {
        await sql`
          update ora_advisors
          set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
              languages = ${data.languages}, years = ${data.years}, rate_coins = ${data.rateCoins},
              photo_url = ${photo}, video_url = ${data.videoUrl}
          where id = ${advisor.id}
        `;
      } else {
        await sql`
          update ora_advisors
          set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
              languages = ${data.languages}, years = ${data.years}, rate_coins = ${data.rateCoins}, video_url = ${data.videoUrl}
          where id = ${advisor.id}
        `;
      }
    }
    return { ok: true as const };
  });

export const listAdvisorBlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const rows = await sql<{ customer_id: string; display_name: string; created_at: string }>`
      select b.customer_id, coalesce(p.display_name, 'Client') as display_name, b.created_at::text as created_at
      from ora_advisor_blocks b
      left join ora_profiles p on p.user_id = b.customer_id
      where b.advisor_id = ${advisor.id}
      order by b.created_at desc
      limit 80
    `.catch(() => []);
    return {
      blocked: rows.map((r) => ({
        customerId: r.customer_id,
        name: r.display_name,
        at: r.created_at,
      })),
    };
  });

export const setAdvisorBlock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; blocked: boolean }) => ({
    customerId: clip(input.customerId, 80),
    blocked: Boolean(input.blocked),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    if (data.customerId === context.userId) throw new Error("You cannot block your own account.");
    const sql = await getSql();
    if (data.blocked) {
      await sql`
        insert into ora_advisor_blocks (advisor_id, customer_id, created_at)
        values (${advisor.id}, ${data.customerId}, now())
        on conflict (advisor_id, customer_id) do nothing
      `;
      await sql`
        update ora_chat_requests
        set status = 'expired'
        where advisor_id = ${advisor.id} and client_id = ${data.customerId} and status = 'pending'
      `.catch(() => {});
    } else {
      await sql`
        delete from ora_advisor_blocks where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
      `;
    }
    return { ok: true as const, blocked: data.blocked };
  });

export const listAdvisorQuickReplies = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const rows = await sql<{ id: string; body: string }>`
      select id, body from ora_advisor_quick_replies
      where advisor_id = ${advisor.id}
      order by sort_order asc, created_at asc
      limit 12
    `.catch(() => []);
    return { replies: rows.map((r) => ({ id: r.id, body: r.body })) };
  });

export const saveAdvisorQuickReplies = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { replies: string[] }) => ({
    replies: parseQuickReplies(input.replies),
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    await sql`delete from ora_advisor_quick_replies where advisor_id = ${advisor.id}`;
    let order = 0;
    for (const body of data.replies) {
      const id = rid("qr");
      await sql`
        insert into ora_advisor_quick_replies (id, advisor_id, body, sort_order)
        values (${id}, ${advisor.id}, ${body}, ${order})
      `;
      order += 1;
    }
    return { replies: data.replies.map((body, i) => ({ id: String(i), body })) };
  });

export const listAdvisorReviews = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const rows = await sql<{ id: string; rating: number; body: string; created_at: string }>`
      select id, rating, body, created_at::text as created_at
      from ora_reviews
      where advisor_id = ${advisor.id} and hidden = false
      order by created_at desc
      limit 40
    `.catch(() => []);
    return {
      reviews: rows.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        body: r.body,
        at: r.created_at,
      })),
    };
  });

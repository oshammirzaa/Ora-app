import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { addLedger, loadCategories, requireRate, rid, settleAdvisorEarnings } from "@/lib/ora";
import { requireApprovedAdvisor } from "@/lib/ora-advisor";
import { overlapSeconds, panelSplit, readingMinutes } from "@/lib/ora-advisor-auth";
import {
  averageOnlineSeconds,
  averageReadingSeconds,
  classifyClient,
  clientMessageDeniedReason,
  customerIsActive,
  followUpDeniedReason,
  formatBirthDate,
  includeChatRequestAsOrder,
  isFrequentClient,
  joinSpecialties,
  matchesInboxFilter,
  matchesOrderFilter,
  normalizeGender,
  orderBucket,
  parseAdvisorReportKind,
  parseAdvisorReportReason,
  parseBirthDate,
  parseGalleryJson,
  parseHoursJson,
  parseQuickReplies,
  remainingDailyClientMessages,
  reminderDueAt,
  serializeGallery,
  serializeHoursJson,
  statsWindow,
  summarizeAdvisorDeskWindow,
  visibleAdvisorPhoto,
  visibleClientGender,
  walletBillingKind,
  ADVISOR_DAILY_CLIENT_MESSAGES,
  FOLLOWUP_MAX_CHARS,
  type AdvisorHours,
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

const REMINDER_SQL = `
create table if not exists ora_advisor_reminders (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  due_at timestamptz not null,
  note text not null default '',
  done_at timestamptz,
  created_at timestamptz not null default now()
)`;

const CLIENT_FAV_SQL = `
create table if not exists ora_advisor_client_favorites (
  advisor_id text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`;

const REPORT_SQL = `
create table if not exists ora_advisor_reports (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  kind text not null,
  reason text not null,
  body text not null default '',
  status text not null default 'open',
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
    "alter table ora_advisors add column if not exists hours_json text not null default ''",
    NOTE_SQL,
    INBOX_SQL,
    INBOX_MSG_SQL,
    GIFT_SQL,
    PAY_SQL,
    BLOCK_SQL,
    REPLY_SQL,
    REMINDER_SQL,
    CLIENT_FAV_SQL,
    REPORT_SQL,
    "create index if not exists ora_advisor_inbox_adv_idx on ora_advisor_inbox (advisor_id, last_at desc)",
    "create index if not exists ora_advisor_inbox_msg_idx on ora_advisor_inbox_messages (thread_id, created_at)",
    "alter table ora_advisor_inbox_messages add column if not exists kind text not null default 'message'",
    "alter table ora_advisor_inbox_messages add column if not exists reading_id text",
    "create index if not exists ora_advisor_inbox_followup_idx on ora_advisor_inbox_messages (advisor_id, customer_id, kind, created_at)",
    "create unique index if not exists ora_followup_reading_idx on ora_advisor_inbox_messages (reading_id) where kind = 'followup' and reading_id is not null",
    "create index if not exists ora_advisor_blocks_adv_idx on ora_advisor_blocks (advisor_id, created_at desc)",
    "create index if not exists ora_advisor_quick_replies_adv_idx on ora_advisor_quick_replies (advisor_id, sort_order, created_at)",
    "create index if not exists ora_advisor_reminders_adv_idx on ora_advisor_reminders (advisor_id, done_at, due_at)",
    "create index if not exists ora_advisor_reports_adv_idx on ora_advisor_reports (advisor_id, created_at desc)",
    "create index if not exists ora_advisor_reports_status_idx on ora_advisor_reports (status, created_at desc)",
    "alter table ora_profiles add column if not exists date_of_birth text not null default ''",
    `create table if not exists ora_advisor_note_entries (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  body text not null,
  created_at timestamptz not null default now()
)`,
    "create index if not exists ora_advisor_note_entries_adv_idx on ora_advisor_note_entries (advisor_id, customer_id, created_at desc)",
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

export type IncomingContext = {
  previousReadings: number;
  lastReadingAt: string;
  returning: boolean;
  billingKind: "included" | "paid" | "none";
};

export async function loadIncomingContext(advisorId: string, clientIds: string[]) {
  const ids = [...new Set(clientIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const out = new Map<string, IncomingContext>();
  for (const id of ids) {
    out.set(id, { previousReadings: 0, lastReadingAt: "", returning: false, billingKind: "none" });
  }
  if (!ids.length) return out;
  const sql = await getSql();
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
  const history = await sql.query<{ customer_id: string; readings: number; last_at: string }>(
    `select client_id as customer_id, count(*)::int as readings, max(started_at)::text as last_at
     from ora_readings
     where advisor_id = $1 and client_id in (${placeholders}) and status in ('ended', 'live')
     group by client_id`,
    [advisorId, ...ids],
  ).catch(() => []);
  for (const row of history) {
    const readings = Number(row.readings) || 0;
    out.set(row.customer_id, {
      previousReadings: readings,
      lastReadingAt: String(row.last_at || ""),
      returning: readings >= 1,
      billingKind: out.get(row.customer_id)?.billingKind || "none",
    });
  }
  const wallets = await sql.query<{
    user_id: string;
    coins: number;
    bonus_seconds: number;
    weekly_seconds: number;
    membership_seconds: number | null;
  }>(
    `select user_id, coalesce(coins, 0) as coins, coalesce(bonus_seconds, 0) as bonus_seconds,
            coalesce(weekly_seconds, 0) as weekly_seconds, coalesce(membership_seconds, 0) as membership_seconds
     from ora_wallets where user_id in (${ids.map((_, i) => `$${i + 1}`).join(", ")})`,
    ids,
  ).catch(() => []);
  for (const w of wallets) {
    const included =
      Number(w.bonus_seconds || 0) + Number(w.weekly_seconds || 0) + Number(w.membership_seconds || 0);
    const cur = out.get(w.user_id) || {
      previousReadings: 0,
      lastReadingAt: "",
      returning: false,
      billingKind: "none" as const,
    };
    cur.billingKind = walletBillingKind({ coins: Number(w.coins) || 0, includedSeconds: included });
    out.set(w.user_id, cur);
  }
  return out;
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

    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyByUserIds(rows.map((row) => row.customerId));
    const pendingIds = rows.filter((row) => row.kind === "request" && row.bucket === "pending").map((row) => row.customerId);
    const incoming = await loadIncomingContext(advisor.id, pendingIds).catch(() => new Map());
    return {
      filter: data.filter,
      orders: rows.slice(0, 80).map((row) => {
        const preview = incoming.get(row.customerId);
        return {
          ...row,
          loyaltyTier: loyalty.get(row.customerId)?.tier ?? "none",
          previousReadings: preview?.previousReadings ?? 0,
          lastReadingAt: preview?.lastReadingAt || "",
          returning: Boolean(preview?.returning),
          billingKind: preview?.billingKind || "none",
        };
      }),
    };
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
    const favs = await sql<{ customer_id: string }>`
      select customer_id from ora_advisor_client_favorites where advisor_id = ${advisor.id}
    `.catch(() => []);
    const favIds = new Set(favs.map((f) => f.customer_id));
    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyByUserIds(rows.map((r) => r.customer_id));
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
          frequent: isFrequentClient(readings),
          favorite: favIds.has(r.customer_id),
          note: noteMap.get(r.customer_id) || "",
          live: liveIds.has(r.customer_id),
          loyaltyTier: loyalty.get(r.customer_id)?.tier ?? "none",
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
    if (!(await hasAdvisorSession(advisor.id, data.customerId))) {
      throw new Error("Notes are only for clients you have already read with.");
    }
    await persistAdvisorNote(advisor.id, data.customerId, data.body, data.body ? "append" : "clear");
    return { ok: true as const };
  });

export const addAdvisorClientNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; body: string }) => ({
    customerId: clip(input.customerId, 80),
    body: clip(input.body, 4000),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    if (!data.body) throw new Error("Write a note.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId))) {
      throw new Error("Notes are only for clients you have already read with.");
    }
    const note = await persistAdvisorNote(advisor.id, data.customerId, data.body, "append");
    return { ok: true as const, note };
  });

export const advisorClientProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string }) => ({ customerId: clip(input.customerId, 80) }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId))) {
      throw new Error("Client not found.");
    }
    const sql = await getSql();
    const [profile] = await sql<{
      display_name: string;
      gender: string;
      date_of_birth: string;
    }>`
      select coalesce(display_name, 'Client') as display_name,
             coalesce(gender, '') as gender,
             coalesce(date_of_birth, '') as date_of_birth
      from ora_profiles
      where user_id = ${data.customerId}
    `.catch(async () => {
      const [row] = await sql<{ display_name: string; gender: string }>`
        select coalesce(display_name, 'Client') as display_name, coalesce(gender, '') as gender
        from ora_profiles where user_id = ${data.customerId}
      `.catch(() => []);
      return [{ display_name: row?.display_name || "Client", gender: row?.gender || "", date_of_birth: "" }];
    });
    const readings = await sql<{
      id: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      seconds: number;
      coins_spent: number;
      advisor_earned: number;
      platform_fee: number;
    }>`
      select id, status, started_at::text as started_at, ended_at::text as ended_at,
             coalesce(seconds, 0)::int as seconds, coalesce(coins_spent, 0)::int as coins_spent,
             coalesce(advisor_earned, 0)::int as advisor_earned, coalesce(platform_fee, 0)::int as platform_fee
      from ora_readings
      where advisor_id = ${advisor.id} and client_id = ${data.customerId} and status in ('ended', 'live')
      order by started_at desc
      limit 80
    `.catch(() => []);
    const counted = readings.filter((r) => r.status === "ended" || r.status === "live");
    const readingCount = counted.length;
    const seconds = counted.reduce((n, r) => n + (Number(r.seconds) || 0), 0);
    const charged = counted.reduce((n, r) => n + (Number(r.coins_spent) || 0), 0);
    const paidSeconds = counted.reduce((n, r) => n + (Number(r.coins_spent) > 0 ? Number(r.seconds) || 0 : 0), 0);
    const advisorShare = counted.reduce((n, r) => n + (Number(r.advisor_earned) || 0), 0);
    const oraShare = counted.reduce((n, r) => n + (Number(r.platform_fee) || 0), 0);
    const firstAt = counted.reduce((earliest, r) => {
      const t = String(r.started_at || "");
      if (!earliest) return t;
      return t && new Date(t).getTime() < new Date(earliest).getTime() ? t : earliest;
    }, "");
    const lastAt = counted[0] ? String(counted[0].started_at || "") : "";
    const [fav] = await sql<{ n: number }>`
      select count(*)::int as n from ora_advisor_client_favorites
      where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
    `.catch(() => [{ n: 0 }]);
    const live = counted.some((r) => r.status === "live");
    const notes = await sql<{ id: string; body: string; created_at: string }>`
      select id, body, created_at::text as created_at
      from ora_advisor_note_entries
      where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
      order by created_at desc
      limit 80
    `.catch(() => []);
    let noteRows = notes.map((n) => ({ id: n.id, body: n.body, createdAt: String(n.created_at) }));
    if (!noteRows.length) {
      const [summary] = await sql<{ body: string; updated_at: string }>`
        select body, updated_at::text as updated_at
        from ora_advisor_notes
        where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
        limit 1
      `.catch(() => []);
      if (summary?.body) {
        noteRows = [{ id: "summary", body: summary.body, createdAt: String(summary.updated_at || "") }];
      }
    }
    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyByUserIds([data.customerId]);
    const gender = normalizeGender(profile?.gender);
    const dateOfBirth = parseBirthDate(profile?.date_of_birth);
    return {
      id: data.customerId,
      name: profile?.display_name || "Client",
      loyaltyTier: loyalty.get(data.customerId)?.tier ?? "none",
      gender,
      genderLabel: visibleClientGender(gender),
      dateOfBirth,
      birthDateLabel: formatBirthDate(dateOfBirth),
      clientSince: firstAt,
      lastAt,
      readings: readingCount,
      seconds,
      paidSeconds,
      avgSeconds: averageReadingSeconds(seconds, readingCount),
      charged,
      advisorShare,
      oraShare,
      favorite: Number(fav?.n) > 0,
      live,
      frequent: isFrequentClient(readingCount),
      repeat: classifyClient(readingCount) === "repeat",
      history: counted.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: String(r.started_at || ""),
        endedAt: String(r.ended_at || ""),
        seconds: Number(r.seconds) || 0,
        coinsSpent: Number(r.coins_spent) || 0,
      })),
      notes: noteRows,
    };
  });

async function persistAdvisorNote(
  advisorId: string,
  customerId: string,
  body: string,
  mode: "append" | "clear",
) {
  const sql = await getSql();
  if (mode === "clear") {
    await sql`
      insert into ora_advisor_notes (advisor_id, customer_id, body, updated_at)
      values (${advisorId}, ${customerId}, '', now())
      on conflict (advisor_id, customer_id) do update set body = '', updated_at = now()
    `;
    return { id: "", body: "", createdAt: new Date().toISOString() };
  }
  const id = rid("nte");
  const createdAt = new Date().toISOString();
  await sql`
    insert into ora_advisor_note_entries (id, advisor_id, customer_id, body, created_at)
    values (${id}, ${advisorId}, ${customerId}, ${body}, ${createdAt})
  `;
  await sql`
    insert into ora_advisor_notes (advisor_id, customer_id, body, updated_at)
    values (${advisorId}, ${customerId}, ${body}, now())
    on conflict (advisor_id, customer_id) do update set body = excluded.body, updated_at = now()
  `;
  return { id, body, createdAt };
}

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
      reading_id: string;
      customer_id: string;
      started_at: string;
      ended_at: string | null;
      seconds: number;
      minutes: string | number;
      coins_spent: number;
      advisor_earnings: number;
      status: string | null;
      rate_coins: number;
    }>`
      select a.reading_id, a.customer_id, a.started_at::text as started_at, a.ended_at::text as ended_at,
             a.seconds, a.minutes, a.coins_spent, a.advisor_earnings, r.status,
             coalesce(r.rate_coins, 0)::int as rate_coins
      from ora_reading_activity a
      left join ora_readings r on r.id = a.reading_id
      where a.advisor_id = ${advisor.id}
    `.catch(async () =>
      sql<{
        reading_id: string;
        customer_id: string;
        started_at: string;
        ended_at: string | null;
        seconds: number;
        minutes: string | number;
        coins_spent: number;
        advisor_earnings: number;
        status: string | null;
        rate_coins: number;
      }>`
        select id as reading_id, client_id as customer_id, started_at::text as started_at, ended_at::text as ended_at,
               seconds, (seconds::numeric / 60) as minutes, coins_spent, advisor_earned as advisor_earnings, status,
               coalesce(rate_coins, 0)::int as rate_coins
        from ora_readings where advisor_id = ${advisor.id}
      `.catch(() => []),
    );
    const clawed = await sql<{ reading_id: string }>`
      select reading_id from ora_earnings where advisor_id = ${advisor.id} and status = 'clawed'
    `.catch(() => []);
    const clawedIds = new Set(clawed.map((row) => row.reading_id));
    const deskRows = activity.map((r) => ({
      readingId: r.reading_id,
      customerId: r.customer_id,
      status: String(r.status || "ended"),
      startedAt: String(r.started_at || ""),
      endedAt: String(r.ended_at || ""),
      coinsSpent: Number(r.coins_spent) || 0,
      rateCoins: Number(r.rate_coins) || 0,
    }));
    const summary = summarizeAdvisorDeskWindow(deskRows, window, clawedIds);
    const actIn = activity.filter((r) => inWindow(r.started_at, window.from, window.to));
    const minutes = actIn.reduce((n, r) => n + Number(r.minutes || readingMinutes(r.seconds)), 0);
    const [open] = presence.filter((p) => !p.ended_at);
    const currentSeconds = open
      ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1000))
      : 0;
    const reviews = await sql<{ rating: number }>`
      select rating from ora_reviews where advisor_id = ${advisor.id} and hidden = false
    `.catch(() => []);
    const reviewCount = reviews.length;
    const avgRating = reviewCount
      ? Math.round((reviews.reduce((n, r) => n + Number(r.rating || 0), 0) / reviewCount) * 10) / 10
      : null;
    return {
      range: data.range,
      day: data.day,
      onlineSeconds,
      averageOnlineSeconds: averageOnlineSeconds(onlineSeconds, days.size),
      accepted,
      declined,
      completed: summary.completed,
      cancelled: summary.cancelled,
      totalClients: summary.totalClients,
      firstTimeClients: summary.firstTimeClients,
      repeatClients: summary.repeatClients,
      newClients: summary.newClients,
      paidReadings: summary.paidReadings,
      paidMinutes: summary.paidMinutes,
      minutes: Math.round(minutes * 100) / 100,
      charged: summary.charged,
      earnings: summary.earnings,
      currentSeconds,
      online: Boolean(advisor.online),
      busy: Boolean(advisor.busy),
      reviewCount,
      avgRating,
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
    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyByUserIds(merged.map((row) => row.customerId));
    const sentToday = await countDailyClientMessages(advisor.id);
    return {
      sentToday,
      dailyLimit: ADVISOR_DAILY_CLIENT_MESSAGES,
      remainingToday: remainingDailyClientMessages(sentToday),
      threads: merged.map((row) => ({
        ...row,
        loyaltyTier: loyalty.get(row.customerId)?.tier ?? "none",
      })),
    };
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

async function countDailyClientMessages(advisorId: string) {
  const sql = await getSql();
  const [row] = await sql<{ n: number }>`
    select count(*)::int as n
    from ora_advisor_inbox_messages
    where advisor_id = ${advisorId}
      and role = 'advisor'
      and coalesce(kind, 'message') in ('message', 'followup')
      and created_at >= date_trunc('day', now())
  `.catch(() => [{ n: 0 }]);
  return Number(row?.n) || 0;
}

async function hasAdvisorSession(advisorId: string, customerId: string) {
  const sql = await getSql();
  const [row] = await sql<{ id: string }>`
    select id from ora_readings
    where advisor_id = ${advisorId} and client_id = ${customerId} and status in ('ended', 'live')
    limit 1
  `;
  return Boolean(row);
}

async function loadEndedReadingForFollowUp(advisorId: string, readingId: string) {
  const sql = await getSql();
  const [row] = await sql<{ id: string; client_id: string; status: string }>`
    select id, client_id, status from ora_readings
    where id = ${readingId} and advisor_id = ${advisorId}
    limit 1
  `;
  return row ?? null;
}

async function followUpAlreadySent(readingId: string) {
  const sql = await getSql();
  const [row] = await sql<{ id: string }>`
    select id from ora_advisor_inbox_messages
    where reading_id = ${readingId} and coalesce(kind, '') = 'followup'
    limit 1
  `.catch(() => []);
  return Boolean(row);
}

async function notifyCustomerFollowUp(input: {
  customerId: string;
  advisorId: string;
  advisorName: string;
  body: string;
}) {
  const { ensureFavoriteExtras } = await import("@/lib/ora-favorites");
  await ensureFavoriteExtras();
  const sql = await getSql();
  const [adv] = await sql<{ slug: string; name: string }>`
    select slug, name from ora_advisors where id = ${input.advisorId}
  `;
  const id = rid("alrt");
  const href = `/advisors/${adv?.slug || input.advisorId}`;
  const title = `${adv?.name || input.advisorName} sent a follow-up`;
  const body = input.body.slice(0, 160);
  await sql`
    insert into ora_customer_alerts (id, user_id, advisor_id, kind, title, body, href)
    values (${id}, ${input.customerId}, ${input.advisorId}, 'followup', ${title}, ${body}, ${href})
  `;
  return id;
}

async function postAdvisorClientMessage(input: {
  advisorId: string;
  advisorName: string;
  customerId: string;
  body: string;
  kind: "message" | "followup";
  readingId?: string;
}) {
  const sql = await getSql();
  const threadId = await loadOrCreateThread(input.advisorId, input.customerId);
  const id = rid("im");
  try {
    await sql`
      insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body, kind, reading_id)
      values (
        ${id}, ${threadId}, ${input.advisorId}, ${input.customerId}, 'advisor', ${input.body},
        ${input.kind}, ${input.readingId || null}
      )
    `;
  } catch (err) {
    if (input.kind === "followup") throw new Error("You already sent a follow-up for this reading.");
    throw err;
  }
  await sql`
    update ora_advisor_inbox
    set last_body = ${input.body}, last_role = 'advisor', last_at = now(), unread_customer = unread_customer + 1
    where id = ${threadId}
  `;
  if (input.kind === "followup") {
    await notifyCustomerFollowUp({
      customerId: input.customerId,
      advisorId: input.advisorId,
      advisorName: input.advisorName,
      body: input.body,
    }).catch((err) => console.error("[ora] follow-up alert", err));
  }
  return { id, threadId };
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
    const sentToday = await countDailyClientMessages(advisor.id);
    const remainingToday = remainingDailyClientMessages(sentToday);
    const [openFollow] = await sql<{ id: string }>`
      select r.id
      from ora_readings r
      where r.advisor_id = ${advisor.id}
        and r.client_id = ${data.customerId}
        and r.status = 'ended'
        and not exists (
          select 1 from ora_advisor_inbox_messages m
          where m.reading_id = r.id and coalesce(m.kind, '') = 'followup'
        )
      order by r.ended_at desc nulls last
      limit 1
    `.catch(() => []);
    const { loadLoyaltyForUser } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyForUser(data.customerId);
    return {
      threadId,
      customerId: data.customerId,
      name: profile?.display_name || "Client",
      loyaltyTier: loyalty.tier,
      note: note?.body || "",
      liveReadingId: live?.id || "",
      blocked: Boolean(blocked),
      remainingToday,
      dailyLimit: ADVISOR_DAILY_CLIENT_MESSAGES,
      followUpReadingId: openFollow?.id || "",
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
    const remainingToday = remainingDailyClientMessages(await countDailyClientMessages(advisor.id));
    const hasSession = await hasAdvisorSession(advisor.id, data.customerId);
    const denied = clientMessageDeniedReason({ hasSession, remainingToday });
    if (denied) throw new Error(denied);
    return postAdvisorClientMessage({
      advisorId: advisor.id,
      advisorName: advisor.name,
      customerId: data.customerId,
      body: data.body,
      kind: "message",
    });
  });

export const readingFollowUpState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string }) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }) => {
    if (!data.readingId) throw new Error("Choose a reading.");
    const advisor = await advisorDesk(context.userId);
    const reading = await loadEndedReadingForFollowUp(advisor.id, data.readingId);
    const remainingToday = remainingDailyClientMessages(await countDailyClientMessages(advisor.id));
    const alreadySent = reading ? await followUpAlreadySent(reading.id) : false;
    const hasEndedSession = reading?.status === "ended";
    return {
      readingId: data.readingId,
      customerId: reading?.client_id || "",
      alreadySent,
      remainingToday,
      dailyLimit: ADVISOR_DAILY_CLIENT_MESSAGES,
      canSend: followUpDeniedReason({ hasEndedSession, alreadySent, remainingToday }) == null,
    };
  });

export const sendReadingFollowUp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string; body: string }) => ({
    readingId: clip(input.readingId, 64),
    body: clip(input.body, FOLLOWUP_MAX_CHARS),
  }))
  .handler(async ({ context, data }) => {
    if (!data.readingId) throw new Error("Choose a reading.");
    if (!data.body) throw new Error("Write a follow-up first.");
    const advisor = await advisorDesk(context.userId);
    const reading = await loadEndedReadingForFollowUp(advisor.id, data.readingId);
    const remainingToday = remainingDailyClientMessages(await countDailyClientMessages(advisor.id));
    const alreadySent = reading ? await followUpAlreadySent(reading.id) : false;
    const denied = followUpDeniedReason({
      hasEndedSession: reading?.status === "ended",
      alreadySent,
      remainingToday,
    });
    if (denied) throw new Error(denied);
    if (!reading) throw new Error("Follow-up is only for customers you have already read with.");
    return postAdvisorClientMessage({
      advisorId: advisor.id,
      advisorName: advisor.name,
      customerId: reading.client_id,
      body: data.body,
      kind: "followup",
      readingId: reading.id,
    });
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
      insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body, kind)
      values (${mid}, ${threadId}, ${advisor.id}, ${data.customerId}, 'advisor', ${body}, 'gift')
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
      insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body, kind)
      values (${mid}, ${threadId}, ${advisor.id}, ${data.customerId}, 'advisor', ${body}, 'pay')
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
      from ora_readings r
      where r.advisor_id = ${advisor.id}
        and r.status in ('ended', 'completed')
        and coalesce(r.coins_spent, 0) > 0
        and coalesce(r.ended_at, r.started_at) >= ${start.toISOString()}
        and not exists (select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed')
    `.catch(() => [{ today: 0 }]);
    const [live] = await sql<{ id: string }>`
      select id from ora_readings where advisor_id = ${advisor.id} and status = 'live' limit 1
    `.catch(() => []);
    return {
      advisorId: advisor.id,
      name: row?.name || profile?.display_name || advisor.name,
      email: profile?.email || "",
      photoUrl: visibleAdvisorPhoto(row?.photo_url),
      rating: row?.is_new ? 0 : Number(row?.rating ?? 0),
      reviews: row?.is_new ? 0 : Number(row?.reviews ?? 0),
      online: Boolean(row?.online ?? advisor.online),
      busy: Boolean(row?.busy ?? advisor.busy),
      inLiveReading: Boolean(live),
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
    try {
      await settleAdvisorEarnings(advisor.id);
    } catch (err) {
      console.error("[ora] settle earnings", err);
    }
    const fresh = await sql<{ payout_coins: number; pending_coins: number }>`
      select coalesce(payout_coins, 0)::int as payout_coins, coalesce(pending_coins, 0)::int as pending_coins
      from ora_advisors where id = ${advisor.id}
    `.catch(() => [{ payout_coins: 0, pending_coins: 0 }]);
    const windows = statsWindow("day");
    const week = statsWindow("week");
    const month = statsWindow("month");
    const sums = await sql<{ today: number; week: number; month: number; all_time: number }>`
      select
        coalesce(sum(case when r.started_at >= ${windows.from!.toISOString()} then r.advisor_earned else 0 end), 0)::int as today,
        coalesce(sum(case when r.started_at >= ${week.from!.toISOString()} then r.advisor_earned else 0 end), 0)::int as week,
        coalesce(sum(case when r.started_at >= ${month.from!.toISOString()} then r.advisor_earned else 0 end), 0)::int as month,
        coalesce(sum(r.advisor_earned), 0)::int as all_time
      from ora_readings r
      where r.advisor_id = ${advisor.id}
        and not exists (
          select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed'
        )
    `.catch(() => [{ today: 0, week: 0, month: 0, all_time: 0 }]);
    const payouts = await sql<{ id: string; coins: number; usd: string; status: string; created_at: string }>`
      select id, coins, usd, status, created_at::text as created_at
      from ora_payouts where advisor_id = ${advisor.id}
      order by created_at desc
      limit 40
    `.catch(() => []);
    const requested = payouts
      .filter((p) => p.status === "requested")
      .reduce((n, p) => n + Number(p.coins), 0);
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
      today: Number(sums[0]?.today ?? 0),
      week: Number(sums[0]?.week ?? 0),
      month: Number(sums[0]?.month ?? 0),
      allTime: Number(sums[0]?.all_time ?? 0),
      available: Number(fresh[0]?.payout_coins ?? 0),
      pendingHold: Number(fresh[0]?.pending_coins ?? 0),
      requested,
      payouts: payouts.map((p) => ({
        id: p.id,
        coins: Number(p.coins),
        usd: Number(p.usd),
        status: p.status,
        createdAt: p.created_at,
      })),
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

export const setAdvisorClientFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; favorite: boolean }) => ({
    customerId: clip(input.customerId, 80),
    favorite: Boolean(input.favorite),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId))) {
      throw new Error("Favorites are only for clients you have already read with.");
    }
    const sql = await getSql();
    if (data.favorite) {
      await sql`
        insert into ora_advisor_client_favorites (advisor_id, customer_id, created_at)
        values (${advisor.id}, ${data.customerId}, now())
        on conflict (advisor_id, customer_id) do nothing
      `;
    } else {
      await sql`
        delete from ora_advisor_client_favorites
        where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
      `;
    }
    return { ok: true as const, favorite: data.favorite };
  });

export const listAdvisorReminders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      customer_id: string;
      display_name: string;
      due_at: string;
      note: string;
      done_at: string | null;
    }>`
      select r.id, r.customer_id, coalesce(p.display_name, 'Client') as display_name,
             r.due_at::text as due_at, r.note, r.done_at::text as done_at
      from ora_advisor_reminders r
      left join ora_profiles p on p.user_id = r.customer_id
      where r.advisor_id = ${advisor.id} and r.done_at is null
      order by r.due_at asc
      limit 80
    `.catch(() => []);
    const now = Date.now();
    return {
      reminders: rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        name: r.display_name,
        dueAt: r.due_at,
        note: r.note,
        due: new Date(r.due_at).getTime() <= now,
      })),
    };
  });

export const saveAdvisorReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; preset: string; customAt?: string; note?: string }) => ({
    customerId: clip(input.customerId, 80),
    preset: clip(input.preset, 20),
    customAt: clip(input.customAt, 40),
    note: clip(input.note, 280),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const due = reminderDueAt(data.preset, data.customAt);
    if (!due) throw new Error("Choose when to follow up.");
    const advisor = await advisorDesk(context.userId);
    const owned = await hasAdvisorSession(advisor.id, data.customerId);
    if (!owned) throw new Error("Reminders are only for clients you have already read with.");
    const sql = await getSql();
    const id = rid("rmd");
    await sql`
      insert into ora_advisor_reminders (id, advisor_id, customer_id, due_at, note, created_at)
      values (${id}, ${advisor.id}, ${data.customerId}, ${due.toISOString()}, ${data.note}, now())
    `;
    return { ok: true as const, id, dueAt: due.toISOString() };
  });

export const completeAdvisorReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clip(input.id, 80) }))
  .handler(async ({ context, data }) => {
    if (!data.id) throw new Error("Choose a reminder.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const moved = await sql<{ id: string }>`
      update ora_advisor_reminders
      set done_at = now()
      where id = ${data.id} and advisor_id = ${advisor.id} and done_at is null
      returning id
    `;
    if (!moved.length) throw new Error("Reminder not found.");
    return { ok: true as const };
  });

export const reportAdvisorClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; kind?: string; reason: string; body: string }) => ({
    customerId: clip(input.customerId, 80),
    kind: parseAdvisorReportKind(input.kind),
    reason: parseAdvisorReportReason(input.reason),
    body: clip(input.body, 2000),
  }))
  .handler(async ({ context, data }) => {
    if (!data.customerId) throw new Error("Choose a client.");
    if (data.body.length < 8) throw new Error("Please describe the issue in a little more detail.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId))) {
      throw new Error("Reports are only for clients you have already read with.");
    }
    const sql = await getSql();
    const id = rid("rpt");
    await sql`
      insert into ora_advisor_reports (id, advisor_id, customer_id, kind, reason, body, status, created_at)
      values (${id}, ${advisor.id}, ${data.customerId}, ${data.kind}, ${data.reason}, ${data.body}, 'open', now())
    `;
    return { ok: true as const, id };
  });

export const saveAdvisorHours = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { hours: AdvisorHours }) => ({
    hours: parseHoursJson(input.hours),
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const json = serializeHoursJson(data.hours);
    await sql`update ora_advisors set hours_json = ${json} where id = ${advisor.id}`;
    return { ok: true as const, hours: data.hours };
  });

export const getAdvisorHours = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [row] = await sql<{ hours_json: string }>`
      select coalesce(hours_json, '') as hours_json from ora_advisors where id = ${advisor.id}
    `.catch(() => [{ hours_json: "" }]);
    return { hours: parseHoursJson(row?.hours_json) };
  });

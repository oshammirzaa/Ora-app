// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requireApprovedAdvisor } from "@/lib/ora-advisor";
import { overlapSeconds, readingMinutes } from "@/lib/ora-advisor-auth";
import { addLedger, loadCategories, requireRate, rid, settleAdvisorEarnings } from "@/lib/ora";
import { loadTipEarnings } from "@/lib/ora-tips-api";
import {
  averageOnlineSeconds,
  averageReadingSeconds,
  advisorUtcDayKey,
  ADVISOR_DAILY_CLIENT_MESSAGES,
  ADVISOR_CONSECUTIVE_MESSAGE_LIMIT,
  advisorWaitingForReply,
  classifyClient,
  clientMessageDeniedReason,
  advisorDirectContactDeniedReason,
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
  presenceSecondsInWindow,
  remainingDailyClientMessages,
  reminderDueAt,
  reminderFromLocalParts,
  snoozeDueAt,
  isDuplicateOpenReminder,
  serializeGallery,
  serializeHoursJson,
  statsWindow,
  summarizeAdvisorDeskWindow,
  summarizeIncomingClientHistory,
  clientRecordedEarnings,
  visibleAdvisorPhoto,
  visibleClientGender,
  walletBillingKind,
} from "@/lib/ora-advisor-desk-stats";
import { panelSplit } from "@/lib/ora-split";
import { parseChatMessageBody } from "@/lib/ora-chat-words";
import { summarizeMessageEarnings } from "@/lib/ora-paid-messages";
import { ensureChatMediaColumns } from "@/lib/ora-chat-media";
import { displayChatImage, messagePreview, sanitizeChatImage } from "@/lib/ora-message-media";

export const NOTE_SQL = `
create table if not exists ora_advisor_notes (
  advisor_id text not null,
  customer_id text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`;
export const INBOX_SQL = `
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
export const INBOX_MSG_SQL = `
create table if not exists ora_advisor_inbox_messages (
  id text primary key,
  thread_id text not null,
  advisor_id text not null,
  customer_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
)`;
export const GIFT_SQL = `
create table if not exists ora_advisor_gifts (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  seconds integer not null,
  created_at timestamptz not null default now()
)`;
export const PAY_SQL = `
create table if not exists ora_advisor_pay_requests (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  coins integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
)`;
export const BLOCK_SQL = `
create table if not exists ora_advisor_blocks (
  advisor_id text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`;
export const REPLY_SQL = `
create table if not exists ora_advisor_quick_replies (
  id text primary key,
  advisor_id text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
)`;
export const REMINDER_SQL = `
create table if not exists ora_advisor_reminders (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  due_at timestamptz not null,
  note text not null default '',
  done_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
)`;
export const CLIENT_FAV_SQL = `
create table if not exists ora_advisor_client_favorites (
  advisor_id text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
)`;
export const REPORT_SQL = `
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
    "alter table ora_advisors add column if not exists away boolean not null default false",
    "alter table ora_advisors add column if not exists schedule_tz text not null default ''",
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
    `create table if not exists ora_customer_blocks (
  customer_id text not null,
  advisor_id text not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, advisor_id)
)`,
    "create index if not exists ora_customer_blocks_adv_idx on ora_customer_blocks (advisor_id, created_at desc)",
    "alter table ora_advisor_reports add column if not exists reporter_user_id text not null default ''",
    "alter table ora_advisor_reports add column if not exists reported_user_id text not null default ''",
    "alter table ora_advisor_reports add column if not exists reporter_role text not null default 'advisor'",
    "alter table ora_advisor_reports add column if not exists reading_id text not null default ''",
    "alter table ora_advisor_reports add column if not exists admin_note text not null default ''",
    "alter table ora_advisor_reports add column if not exists reviewed_at timestamptz",
    "alter table ora_advisor_reports add column if not exists resolved_at timestamptz",
    "alter table ora_advisor_reports add column if not exists resolved_by text not null default ''",
    "create index if not exists ora_advisor_quick_replies_adv_idx on ora_advisor_quick_replies (advisor_id, sort_order, created_at)",
    "create index if not exists ora_advisor_reminders_adv_idx on ora_advisor_reminders (advisor_id, done_at, due_at)",
    "alter table ora_advisor_reminders add column if not exists notified_at timestamptz",
    `create table if not exists ora_advisor_daily_messages (
  advisor_id text not null,
  day date not null,
  used integer not null default 0,
  primary key (advisor_id, day)
)`,
    "create index if not exists ora_advisor_inbox_daily_msg_idx on ora_advisor_inbox_messages (advisor_id, role, kind, created_at)",
    "create index if not exists ora_advisor_inbox_outreach_pair_idx on ora_advisor_inbox_messages (advisor_id, customer_id, role, created_at)",
    "create index if not exists ora_advisor_reports_adv_idx on ora_advisor_reports (advisor_id, created_at desc)",
    "create index if not exists ora_advisor_reports_status_idx on ora_advisor_reports (status, created_at desc)",
    "alter table ora_advisor_reports add column if not exists reporter_user_id text not null default ''",
    "alter table ora_advisor_reports add column if not exists reported_user_id text not null default ''",
    "alter table ora_advisor_reports add column if not exists reporter_role text not null default 'advisor'",
    "alter table ora_advisor_reports add column if not exists reading_id text not null default ''",
    "alter table ora_advisor_reports add column if not exists admin_note text not null default ''",
    "alter table ora_advisor_reports add column if not exists reviewed_at timestamptz",
    "alter table ora_advisor_reports add column if not exists resolved_at timestamptz",
    "alter table ora_advisor_reports add column if not exists resolved_by text not null default ''",
    "alter table ora_profiles add column if not exists date_of_birth text not null default ''",
    "alter table ora_profiles add column if not exists outreach_opt_out boolean not null default false",
    `create table if not exists ora_advisor_note_entries (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  body text not null,
  created_at timestamptz not null default now()
)`,
    "create index if not exists ora_advisor_note_entries_adv_idx on ora_advisor_note_entries (advisor_id, customer_id, created_at desc)",
    "create index if not exists ora_readings_advisor_client_completed_idx on ora_readings (advisor_id, client_id) where status in ('ended', 'completed')",
    "create index if not exists ora_favorites_advisor_user_idx on ora_favorites (advisor_id, user_id)",
    "alter table ora_advisor_inbox_messages add column if not exists request_id text",
    `create unique index if not exists ora_inbox_msg_request_idx
  on ora_advisor_inbox_messages (request_id) where request_id is not null`,
    `create table if not exists ora_customer_message_allowance (
  customer_id text not null,
  advisor_id text not null,
  free_used integer not null default 0,
  paid_sent integer not null default 0,
  paid_notice_seen boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (customer_id, advisor_id)
)`,
    `create table if not exists ora_paid_messages (
  id text primary key,
  message_id text not null unique,
  request_id text not null unique,
  customer_id text not null,
  advisor_id text not null,
  thread_id text not null,
  coins integer not null,
  amount_cents integer not null,
  advisor_share_coins integer not null,
  ora_share_coins integer not null,
  advisor_share_cents integer not null,
  ora_share_cents integer not null,
  created_at timestamptz not null default now()
)`,
    "alter table ora_paid_messages add column if not exists credited boolean not null default true",
  ];
  for (const text of statements)
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] advisor desk schema", err);
    }
}
async function advisorDesk(userId) {
  const advisor = await requireApprovedAdvisor(userId);
  try {
    await ensureAdvisorDeskTables();
  } catch (err) {
    console.error("[ora] advisor desk schema skipped", err);
  }
  return advisor;
}
function clip(value, max = 4000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

export async function loadClientPhotos(ids) {
  const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  const out = new Map();
  if (!unique.length) return out;
  const sql = await getSql();
  const placeholders = unique.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await sql
    .query(`select id, image from "user" where id in (${placeholders})`, unique)
    .catch(() => []);
  for (const row of rows) {
    const photo = visibleAdvisorPhoto(row.image);
    if (photo) out.set(String(row.id), photo);
  }
  return out;
}
function emptyIncomingContext() {
  return {
    previousReadings: 0,
    lastReadingAt: "",
    returning: false,
    paidMinutes: 0,
    billingKind: "none",
    favorited: false,
  };
}
export async function loadIncomingContext(advisorId, clientIds) {
  const ids = [...new Set(clientIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const out = new Map();
  for (const id of ids) out.set(id, emptyIncomingContext());
  if (!ids.length) return out;
  const sql = await getSql();
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
  const history = await sql
    .query(
      `select client_id as customer_id,
              count(*)::int as previous_readings,
              coalesce(max(coalesce(ended_at, started_at)), max(started_at))::text as last_reading_at,
              coalesce(sum(
                case when coalesce(coins_spent, 0) > 0 and coalesce(rate_coins, 0) > 0
                  then round((coins_spent::numeric / rate_coins) * 100) / 100
                  else 0 end
              ), 0)::float as paid_minutes
         from ora_readings
         where advisor_id = $1 and client_id in (${placeholders})
           and status in ('ended', 'completed')
         group by client_id`,
      [advisorId, ...ids],
    )
    .catch(async () =>
      sql
        .query(
          `select client_id as customer_id, status, coalesce(coins_spent, 0)::int as coins_spent,
                  0 as rate_coins, started_at::text as started_at, ended_at::text as ended_at
             from ora_readings
             where advisor_id = $1 and client_id in (${placeholders})
               and status in ('ended', 'completed')`,
          [advisorId, ...ids],
        )
        .catch(() => []),
    );
  const grouped = new Map();
  for (const row of history || []) {
    if (row.previous_readings != null && row.status == null) {
      out.set(row.customer_id, {
        ...(out.get(row.customer_id) || emptyIncomingContext()),
        previousReadings: Number(row.previous_readings) || 0,
        lastReadingAt: String(row.last_reading_at || ""),
        returning: Number(row.previous_readings) > 0,
        paidMinutes: Math.round((Number(row.paid_minutes) || 0) * 100) / 100,
      });
      continue;
    }
    const list = grouped.get(row.customer_id) || [];
    list.push(row);
    grouped.set(row.customer_id, list);
  }
  for (const [clientId, rows] of grouped) {
    const summary = summarizeIncomingClientHistory(
      rows.map((row) => ({
        status: row.status,
        coinsSpent: Number(row.coins_spent) || 0,
        rateCoins: Number(row.rate_coins) || 0,
        startedAt: String(row.started_at || ""),
        endedAt: String(row.ended_at || ""),
      })),
    );
    out.set(clientId, { ...(out.get(clientId) || emptyIncomingContext()), ...summary });
  }
  const wallets = await sql
    .query(
      `select user_id, coalesce(coins, 0) as coins, coalesce(bonus_seconds, 0) as bonus_seconds,
            coalesce(weekly_seconds, 0) as weekly_seconds, coalesce(membership_seconds, 0) as membership_seconds
     from ora_wallets where user_id in (${ids.map((_, i) => `$${i + 1}`).join(", ")})`,
      ids,
    )
    .catch(() => []);
  for (const w of wallets) {
    const included =
      Number(w.bonus_seconds || 0) +
      Number(w.weekly_seconds || 0) +
      Number(w.membership_seconds || 0);
    const cur = out.get(w.user_id) || emptyIncomingContext();
    cur.billingKind = walletBillingKind({
      coins: Number(w.coins) || 0,
      includedSeconds: included,
    });
    out.set(w.user_id, cur);
  }
  const favs = await sql
    .query(`select user_id from ora_favorites where advisor_id = $1 and user_id in (${placeholders})`, [
      advisorId,
      ...ids,
    ])
    .catch(() => []);
  for (const row of favs || []) {
    const cur = out.get(row.user_id) || emptyIncomingContext();
    cur.favorited = true;
    out.set(row.user_id, cur);
  }
  return out;
}
export const advisorOrders: any = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    filter: String(input?.filter || "all"),
    q: clip(input?.q, 80).toLowerCase(),
  }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const requests = await sql`
      select r.id, r.client_id, coalesce(p.display_name, 'Client') as display_name,
             r.status, r.created_at::text as created_at, coalesce(r.reading_id, '') as reading_id
      from ora_chat_requests r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id}
      order by r.created_at desc
      limit 120
    `.catch(() => []);
    const readings = await sql`
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
          const bucket = orderBucket({
            kind: "request",
            status: r.status,
          });
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
            kind: "request",
          };
        }),
      ...readings.map((r) => {
        const bucket = orderBucket({
          kind: "reading",
          status: r.status,
        });
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
          kind: "reading",
        };
      }),
    ]
      .filter((row) => matchesOrderFilter(row.bucket, data.filter))
      .filter(
        (row) =>
          !data.q ||
          row.customerName.toLowerCase().includes(data.q) ||
          row.id.toLowerCase().includes(data.q),
      )
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyByUserIds(rows.map((row) => row.customerId));
    const pendingIds = rows
      .filter((row) => row.kind === "request" && row.bucket === "pending")
      .map((row) => row.customerId);
    const incoming = await loadIncomingContext(advisor.id, pendingIds).catch(
      () => new Map(),
    );
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
          paidMinutes: preview?.paidMinutes ?? 0,
          billingKind: preview?.billingKind || "none",
          favorited: Boolean(preview?.favorited),
        };
      }),
    };
  });
export const advisorClientList = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ q: clip(input?.q, 80).toLowerCase() }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const rows = await sql`
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
      sql`
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
    const notes = await sql`
      select customer_id, body from ora_advisor_notes where advisor_id = ${advisor.id}
    `.catch(() => []);
    const noteMap = new Map(notes.map((n) => [n.customer_id, n.body]));
    const live = await sql`
      select client_id from ora_readings where advisor_id = ${advisor.id} and status = 'live'
    `.catch(() => []);
    const liveIds = new Set(live.map((r) => r.client_id));
    const favs = await sql`
      select customer_id from ora_advisor_client_favorites where advisor_id = ${advisor.id}
    `.catch(() => []);
    const favIds = new Set(favs.map((f) => f.customer_id));
    const ids = rows.map((r) => r.customer_id);
    const theyFav = ids.length
      ? await sql
          .query(
            `select user_id from ora_favorites where advisor_id = $1 and user_id in (${ids.map((_, i) => `$${i + 2}`).join(", ")})`,
            [advisor.id, ...ids],
          )
          .catch(() => [])
      : [];
    const theyFavIds = new Set((theyFav || []).map((row) => String(row.user_id)));
    const photos = await loadClientPhotos(ids).catch(() => new Map());
    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyByUserIds(ids);
    const readingShares = await sql`
      select r.client_id as customer_id, coalesce(sum(r.advisor_earned), 0)::int as share
      from ora_readings r
      where r.advisor_id = ${advisor.id}
        and r.status in ('ended', 'completed')
        and not exists (
          select 1 from ora_earnings e
          where e.reading_id = r.id and e.advisor_id = ${advisor.id} and e.status = 'clawed'
        )
      group by r.client_id
    `.catch(() => []);
    const messageShares = await sql`
      select customer_id, coalesce(sum(advisor_share_cents), 0)::int as share
      from ora_paid_messages
      where advisor_id = ${advisor.id} and credited = true and coins > 0
      group by customer_id
    `.catch(() => []);
    const tipShares = await sql`
      select customer_id, coalesce(sum(advisor_share_coins), 0)::int as share
      from ora_customer_tips
      where advisor_id = ${advisor.id} and charged = true and credited = true
      group by customer_id
    `.catch(() => []);
    const readingByClient = new Map(readingShares.map((row) => [row.customer_id, Number(row.share) || 0]));
    const messageByClient = new Map(messageShares.map((row) => [row.customer_id, Number(row.share) || 0]));
    const tipByClient = new Map(tipShares.map((row) => [row.customer_id, Number(row.share) || 0]));
    return {
      clients: rows
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
            yourEarningsCents: clientRecordedEarnings({
              readingShareCoins: readingByClient.get(r.customer_id) || 0,
              messageShareCents: messageByClient.get(r.customer_id) || 0,
              tipShareCoins: tipByClient.get(r.customer_id) || 0,
            }).cents,
            lastAt: String(r.last_at),
            repeat: classifyClient(readings) === "repeat",
            frequent: isFrequentClient(readings),
            favorite: favIds.has(r.customer_id),
            favoritedYou: theyFavIds.has(r.customer_id),
            photoUrl: photos.get(r.customer_id) || "",
            note: noteMap.get(r.customer_id) || "",
            live: liveIds.has(r.customer_id),
            loyaltyTier: loyalty.get(r.customer_id)?.tier ?? "none",
          };
        })
        .filter(
          (c) =>
            !data.q ||
            c.name.toLowerCase().includes(data.q) ||
            c.note.toLowerCase().includes(data.q),
        ),
    };
  });
export const saveAdvisorClientNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    body: clip(input.body, 4000),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId)))
      throw new Error("Notes are only for clients you have already read with.");
    await persistAdvisorNote(
      advisor.id,
      data.customerId,
      data.body,
      data.body ? "append" : "clear",
    );
    return { ok: true };
  });
export const addAdvisorClientNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    body: clip(input.body, 4000),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    if (!data.body) throw new Error("Write a note.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId)))
      throw new Error("Notes are only for clients you have already read with.");
    return {
      ok: true,
      note: await persistAdvisorNote(advisor.id, data.customerId, data.body, "append"),
    };
  });
export const advisorClientProfile: any = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ customerId: clip(input.customerId, 80) }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId)))
      throw new Error("Client not found.");
    const sql = await getSql();
    const [profile] = await sql`
      select coalesce(display_name, 'Client') as display_name,
             coalesce(gender, '') as gender,
             coalesce(date_of_birth, '') as date_of_birth
      from ora_profiles
      where user_id = ${data.customerId}
    `.catch(async () => {
      const [row] = await sql`
        select coalesce(display_name, 'Client') as display_name, coalesce(gender, '') as gender
        from ora_profiles where user_id = ${data.customerId}
      `.catch(() => []);
      return [
        {
          display_name: row?.display_name || "Client",
          gender: row?.gender || "",
          date_of_birth: "",
        },
      ];
    });
    const counted = (
      await sql`
      select id, status, started_at::text as started_at, ended_at::text as ended_at,
             coalesce(seconds, 0)::int as seconds, coalesce(coins_spent, 0)::int as coins_spent,
             coalesce(advisor_earned, 0)::int as advisor_earned, coalesce(platform_fee, 0)::int as platform_fee
      from ora_readings
      where advisor_id = ${advisor.id} and client_id = ${data.customerId} and status in ('ended', 'live')
      order by started_at desc
      limit 80
    `.catch(() => [])
    ).filter((r) => r.status === "ended" || r.status === "live");
    const readingCount = counted.length;
    const seconds = counted.reduce((n, r) => n + (Number(r.seconds) || 0), 0);
    const charged = counted.reduce((n, r) => n + (Number(r.coins_spent) || 0), 0);
    const paidSeconds = counted.reduce(
      (n, r) => n + (Number(r.coins_spent) > 0 ? Number(r.seconds) || 0 : 0),
      0,
    );
    const advisorShare = counted.reduce((n, r) => n + (Number(r.advisor_earned) || 0), 0);
    const oraShare = counted.reduce((n, r) => n + (Number(r.platform_fee) || 0), 0);
    const firstAt = counted.reduce((earliest, r) => {
      const t = String(r.started_at || "");
      if (!earliest) return t;
      return t && new Date(t).getTime() < new Date(earliest).getTime() ? t : earliest;
    }, "");
    const lastAt = counted[0] ? String(counted[0].started_at || "") : "";
    const [fav] = await sql`
      select count(*)::int as n from ora_advisor_client_favorites
      where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
    `.catch(() => [{ n: 0 }]);
    const [theyFav] = await sql`
      select count(*)::int as n from ora_favorites
      where advisor_id = ${advisor.id} and user_id = ${data.customerId}
    `.catch(() => [{ n: 0 }]);
    const photos = await loadClientPhotos([data.customerId]).catch(() => new Map());
    const live = counted.some((r) => r.status === "live");
    let noteRows = (
      await sql`
      select id, body, created_at::text as created_at
      from ora_advisor_note_entries
      where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
      order by created_at desc
      limit 80
    `.catch(() => [])
    ).map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: String(n.created_at),
    }));
    if (!noteRows.length) {
      const [summary] = await sql`
        select body, updated_at::text as updated_at
        from ora_advisor_notes
        where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
        limit 1
      `.catch(() => []);
      if (summary?.body)
        noteRows = [
          {
            id: "summary",
            body: summary.body,
            createdAt: String(summary.updated_at || ""),
          },
        ];
    }
    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const loyalty = await loadLoyaltyByUserIds([data.customerId]);
    const gender = normalizeGender(profile?.gender);
    const dateOfBirth = parseBirthDate(profile?.date_of_birth);
    const { pairBlockFlags } = await import("@/lib/ora-safety-api");
    const flags = await pairBlockFlags(advisor.id, data.customerId);
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
      favoritedYou: Number(theyFav?.n) > 0,
      photoUrl: photos.get(data.customerId) || "",
      live,
      blocked: Boolean(flags.advisorBlockedCustomer || flags.customerBlockedAdvisor),
      blockedByMe: Boolean(flags.advisorBlockedCustomer),
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
async function persistAdvisorNote(advisorId, customerId, body, mode) {
  const sql = await getSql();
  if (mode === "clear") {
    await sql`
      insert into ora_advisor_notes (advisor_id, customer_id, body, updated_at)
      values (${advisorId}, ${customerId}, '', now())
      on conflict (advisor_id, customer_id) do update set body = '', updated_at = now()
    `;
    return {
      id: "",
      body: "",
      createdAt: new Date().toISOString(),
    };
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
  return {
    id,
    body,
    createdAt,
  };
}
function sumPresence(rows, from, to) {
  if (!from)
    return rows.reduce((n, row) => {
      const end = row.ended_at ? new Date(row.ended_at).getTime() : to.getTime();
      const start = new Date(row.started_at).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return n;
      return n + Math.max(0, Math.floor((Math.min(end, to.getTime()) - start) / 1e3));
    }, 0);
  return rows.reduce((n, row) => n + overlapSeconds(row.started_at, row.ended_at, from, to), 0);
}
function inWindow(iso, from, to) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (from && t < from.getTime()) return false;
  return t <= to.getTime();
}
async function loadDeskReadings(advisorId, from, to) {
  const sql = await getSql();
  const toIso = to.toISOString();
  try {
    if (from)
      return await sql`
        select id as reading_id, client_id as customer_id, started_at::text as started_at, ended_at::text as ended_at,
               seconds, (seconds::numeric / 60) as minutes, coins_spent, status,
               coalesce(rate_coins, 0)::int as rate_coins
        from ora_readings
        where advisor_id = ${advisorId}
          and coalesce(ended_at, started_at) >= ${from.toISOString()}::timestamptz
          and coalesce(ended_at, started_at) <= ${toIso}::timestamptz
      `;
    return await sql`
      select id as reading_id, client_id as customer_id, started_at::text as started_at, ended_at::text as ended_at,
             seconds, (seconds::numeric / 60) as minutes, coins_spent, status,
             coalesce(rate_coins, 0)::int as rate_coins
      from ora_readings
      where advisor_id = ${advisorId}
        and coalesce(ended_at, started_at) <= ${toIso}::timestamptz
    `;
  } catch {
    return [];
  }
}
async function loadPriorPaidClientIds(advisorId, clientIds, from) {
  if (!clientIds.length) return [];
  const sql = await getSql();
  try {
    return (
      await sql.query(
        `select distinct r.client_id
       from ora_readings r
       where r.advisor_id = $1
         and r.client_id = any($2::text[])
         and r.status in ('ended', 'completed')
         and r.coins_spent > 0
         and coalesce(r.ended_at, r.started_at) < $3::timestamptz
         and not exists (
           select 1 from ora_earnings e
           where e.reading_id = r.id and e.advisor_id = $1 and e.status = 'clawed'
         )`,
        [advisorId, clientIds, from.toISOString()],
      )
    ).map((row) => row.client_id);
  } catch {
    try {
      return (
        await sql.query(
          `select distinct client_id
         from ora_readings
         where advisor_id = $1
           and client_id = any($2::text[])
           and status in ('ended', 'completed')
           and coins_spent > 0
           and coalesce(ended_at, started_at) < $3::timestamptz`,
          [advisorId, clientIds, from.toISOString()],
        )
      ).map((row) => row.client_id);
    } catch {
      return [];
    }
  }
}
export const advisorStatistics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    range: ["day", "week", "month", "all"].includes(String(input?.range)) ? input?.range : "day",
    day: clip(input?.day, 12),
  }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const window = statsWindow(data.range, new Date(), data.day || void 0);
    const toIso = window.to.toISOString();
    const fromIso = window.from?.toISOString() ?? null;
    const presence = await (async () => {
      try {
        if (fromIso)
          return await sql`
            select started_at::text as started_at, ended_at::text as ended_at, last_seen_at::text as last_seen_at
            from ora_advisor_presence
            where advisor_id = ${advisor.id}
              and started_at <= ${toIso}::timestamptz
              and (ended_at is null or ended_at >= ${fromIso}::timestamptz)
          `;
        return await sql`
          select started_at::text as started_at, ended_at::text as ended_at, last_seen_at::text as last_seen_at
          from ora_advisor_presence
          where advisor_id = ${advisor.id}
            and started_at <= ${toIso}::timestamptz
        `;
      } catch {
        try {
          if (fromIso)
            return await sql`
              select started_at::text as started_at, ended_at::text as ended_at, null::text as last_seen_at
              from ora_advisor_presence
              where advisor_id = ${advisor.id}
                and started_at <= ${toIso}::timestamptz
                and (ended_at is null or ended_at >= ${fromIso}::timestamptz)
            `;
          return await sql`
            select started_at::text as started_at, ended_at::text as ended_at, null::text as last_seen_at
            from ora_advisor_presence
            where advisor_id = ${advisor.id}
              and started_at <= ${toIso}::timestamptz
          `;
        } catch {
          return [];
        }
      }
    })();
    const [liveRow] = await sql`
      select id from ora_readings where advisor_id = ${advisor.id} and status = 'live' limit 1
    `.catch(() => []);
    const onlineSeconds = presenceSecondsInWindow(
      presence.map((p) => ({
        startedAt: String(p.started_at),
        endedAt: p.ended_at,
        lastSeenAt: p.last_seen_at,
      })),
      window,
      { live: Boolean(liveRow) },
    );
    const days = new Set(
      presence
        .filter((p) => inWindow(p.started_at, window.from, window.to) || !p.ended_at)
        .map((p) => new Date(p.started_at).toISOString().slice(0, 10)),
    );
    const requests = await (async () => {
      try {
        if (fromIso)
          return await sql`
            select status, created_at::text as created_at from ora_chat_requests
            where advisor_id = ${advisor.id}
              and created_at >= ${fromIso}::timestamptz
              and created_at <= ${toIso}::timestamptz
          `;
        return await sql`
          select status, created_at::text as created_at from ora_chat_requests
          where advisor_id = ${advisor.id}
            and created_at <= ${toIso}::timestamptz
        `;
      } catch {
        return [];
      }
    })();
    const accepted = requests.filter((r) => r.status === "accepted").length;
    const declined = requests.filter(
      (r) => r.status === "declined" || r.status === "expired",
    ).length;
    const activity = await loadDeskReadings(advisor.id, window.from, window.to);
    const readingIds = activity.map((r) => r.reading_id);
    const clawed = readingIds.length
      ? await sql
          .query(
            "select reading_id from ora_earnings where advisor_id = $1 and status = 'clawed' and reading_id = any($2::text[])",
            [advisor.id, readingIds],
          )
          .catch(() => [])
      : [];
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
    const paidClientIds = [
      ...new Set(
        deskRows
          .filter((row) => Number(row.coinsSpent) > 0 && !clawedIds.has(row.readingId))
          .map((row) => row.customerId)
          .filter(Boolean),
      ),
    ];
    const extraPrior = window.from
      ? await loadPriorPaidClientIds(advisor.id, paidClientIds, window.from)
      : [];
    const summary = summarizeAdvisorDeskWindow(deskRows, window, clawedIds, extraPrior);
    const minutes = activity.reduce(
      (n, r) => n + Number(r.minutes || readingMinutes(r.seconds)),
      0,
    );
    const [open] = presence.filter((p) => !p.ended_at);
    const currentSeconds = open
      ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1e3))
      : 0;
    const reviews = await sql`
      select rating from ora_reviews where advisor_id = ${advisor.id} and hidden = false
    `.catch(() => []);
    const reviewCount = reviews.length;
    const avgRating = reviewCount
      ? Math.round((reviews.reduce((n, r) => n + Number(r.rating || 0), 0) / reviewCount) * 10) / 10
      : null;
    const messageDay = statsWindow("day").from?.toISOString() || new Date(0).toISOString();
    const [messageTotals] = await sql`
      select
        count(*)::int as paid_messages,
        coalesce(sum(coins), 0)::int as charged,
        coalesce(sum(advisor_share_cents), 0)::int as advisor_share,
        coalesce(sum(ora_share_cents), 0)::int as ora_share,
        coalesce(sum(case when created_at >= ${messageDay}::timestamptz then 1 else 0 end), 0)::int as today_paid,
        coalesce(sum(case when created_at >= ${messageDay}::timestamptz then advisor_share_cents else 0 end), 0)::int as today_earnings
      from ora_paid_messages
      where advisor_id = ${advisor.id} and coins > 0
    `.catch(() => [{ paid_messages: 0, charged: 0, advisor_share: 0, ora_share: 0, today_paid: 0, today_earnings: 0 }]);
    const paidRows = await sql`
      select m.customer_id, coalesce(p.display_name, 'Client') as display_name,
             m.created_at::text as created_at, m.coins::int as coins,
             m.advisor_share_cents::int as advisor_share_coins,
             m.ora_share_cents::int as ora_share_coins
      from ora_paid_messages m
      left join ora_profiles p on p.user_id = m.customer_id
      where m.advisor_id = ${advisor.id} and m.coins > 0
      order by m.created_at desc
      limit 80
    `.catch(() => []);
    const [exchangeRow] = await sql`
      select count(*)::int as n
      from ora_advisor_inbox_messages
      where advisor_id = ${advisor.id}
        and coalesce(kind, 'message') = 'message'
    `.catch(() => [{ n: 0 }]);
    const grouped = summarizeMessageEarnings({
      exchanges: Number(exchangeRow?.n) || 0,
      paid: paidRows.map((row) => ({
        customerId: String(row.customer_id || ""),
        customerName: String(row.display_name || "Client"),
        at: String(row.created_at || ""),
        coins: Number(row.coins) || 0,
        advisorShare: Number(row.advisor_share_coins) || 0,
        oraShare: Number(row.ora_share_coins) || 0,
      })),
    });
    const messageEarnings = {
      paidMessages: Number(messageTotals?.paid_messages) || 0,
      exchanges: Number(exchangeRow?.n) || 0,
      charged: Number(messageTotals?.charged) || 0,
      advisorEarnings: Number(messageTotals?.advisor_share) || 0,
      oraShare: Number(messageTotals?.ora_share) || 0,
      todayPaidMessages: Number(messageTotals?.today_paid) || 0,
      todayEarnings: Number(messageTotals?.today_earnings) || 0,
      history: grouped.history,
    };
    const tips = await loadTipEarnings(advisor.id);
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
      messageEarnings,
      tips,
    };
  });
export const advisorInboxList: any = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    filter: String(input?.filter || "all"),
    q: clip(input?.q, 80).toLowerCase(),
  }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const threads = await sql`
      select i.id, i.customer_id, coalesce(p.display_name, 'Client') as display_name,
             i.last_body, i.last_role, i.last_at::text as last_at, i.unread_advisor
      from ora_advisor_inbox i
      left join ora_profiles p on p.user_id = i.customer_id
      where i.advisor_id = ${advisor.id}
      order by i.last_at desc
      limit 80
    `.catch(() => []);
    const fromReadings = await sql`
      select r.client_id as customer_id, coalesce(p.display_name, 'Client') as display_name,
             r.started_at::text as last_at, '' as body
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id}
      order by r.started_at desc
      limit 80
    `.catch(() => []);
    const live = await sql`
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
      .filter(
        (row) =>
          !data.q ||
          row.name.toLowerCase().includes(data.q) ||
          row.lastBody.toLowerCase().includes(data.q),
      )
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
async function loadOrCreateThread(advisorId, customerId) {
  const sql = await getSql();
  const [existing] = await sql`
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
async function countDailyClientMessages(advisorId) {
  const from = statsWindow("day").from?.toISOString() || new Date(0).toISOString();
  const [row] = await (await getSql())`
    select count(*)::int as n
    from ora_advisor_inbox_messages
    where advisor_id = ${advisorId}
      and role = 'advisor'
      and coalesce(kind, 'message') in ('message', 'followup')
      and created_at >= ${from}::timestamptz
  `.catch(() => [{ n: 0 }]);
  return Number(row?.n) || 0;
}
async function consecutiveAdvisorSends(advisorId, customerId) {
  const rows = await (await getSql())`
    select role
    from ora_advisor_inbox_messages
    where advisor_id = ${advisorId}
      and customer_id = ${customerId}
      and coalesce(kind, 'message') in ('message', 'followup', 'tip')
    order by created_at desc
    limit ${ADVISOR_CONSECUTIVE_MESSAGE_LIMIT}
  `.catch(() => []);
  let count = 0;
  for (const row of rows) {
    if (String(row.role) !== "advisor") break;
    count += 1;
  }
  return count;
}
async function loadOutreachContext(advisorId, customerId) {
  const sql = await getSql();
  const { pairBlockFlags } = await import("@/lib/ora-safety-api");
  const flags = await pairBlockFlags(advisorId, customerId);
  const [opt] = await sql`
    select outreach_opt_out from ora_profiles where user_id = ${customerId}
  `.catch(() => []);
  const consecutiveAdvisor = await consecutiveAdvisorSends(advisorId, customerId);
  return {
    blocked: Boolean(flags.advisorBlockedCustomer || flags.customerBlockedAdvisor),
    blockedByMe: Boolean(flags.advisorBlockedCustomer),
    optedOut: Boolean(opt?.outreach_opt_out),
    consecutiveAdvisor,
    waitingForReply: advisorWaitingForReply(consecutiveAdvisor),
    remainingToday: remainingDailyClientMessages(await countDailyClientMessages(advisorId)),
    hasSession: await hasAdvisorSession(advisorId, customerId),
  };
}
export const advisorDailyMessageQuota = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const sentToday = await countDailyClientMessages((await advisorDesk(context.userId)).id);
    return {
      sentToday,
      dailyLimit: ADVISOR_DAILY_CLIENT_MESSAGES,
      remainingToday: remainingDailyClientMessages(sentToday),
      day: advisorUtcDayKey(),
    };
  });
async function hasAdvisorSession(advisorId, customerId) {
  const [row] = await (await getSql())`
    select id from ora_readings
    where advisor_id = ${advisorId} and client_id = ${customerId} and status in ('ended', 'live')
    limit 1
  `;
  return Boolean(row);
}
async function loadEndedReadingForFollowUp(advisorId, readingId) {
  const [row] = await (await getSql())`
    select id, client_id, status from ora_readings
    where id = ${readingId} and advisor_id = ${advisorId}
    limit 1
  `;
  return row ?? null;
}
async function followUpAlreadySent(readingId) {
  const [row] = await (await getSql())`
    select id from ora_advisor_inbox_messages
    where reading_id = ${readingId} and coalesce(kind, '') = 'followup'
    limit 1
  `.catch(() => []);
  return Boolean(row);
}
async function notifyCustomerFollowUp(input) {
  const { ensureFavoriteExtras } = await import("@/lib/ora-favorites");
  await ensureFavoriteExtras();
  const sql = await getSql();
  const [adv] = await sql`
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
async function postAdvisorClientMessage(input) {
  const sql = await getSql();
  await ensureChatMediaColumns();
  const consecutive = await consecutiveAdvisorSends(input.advisorId, input.customerId);
  if (advisorWaitingForReply(consecutive)) throw new Error("Waiting for the client's reply");
  const threadId = await loadOrCreateThread(input.advisorId, input.customerId);
  const id = rid("im");
  const preview = messagePreview(input.body, input.image);
  try {
    await sql`
      insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body, kind, reading_id, image_url)
      values (
        ${id}, ${threadId}, ${input.advisorId}, ${input.customerId}, 'advisor', ${input.body},
        ${input.kind}, ${input.readingId || null}, ${input.image || null}
      )
    `;
  } catch (err) {
    if (input.kind === "followup")
      throw new Error("You already sent a follow-up for this reading.");
    throw err;
  }
  await sql`
    update ora_advisor_inbox
    set last_body = ${preview}, last_role = 'advisor', last_at = now(), unread_customer = unread_customer + 1
    where id = ${threadId}
  `;
  if (input.kind === "followup")
    await notifyCustomerFollowUp({
      customerId: input.customerId,
      advisorId: input.advisorId,
      advisorName: input.advisorName,
      body: input.body,
    }).catch((err) => console.error("[ora] follow-up alert", err));
  return {
    id,
    threadId,
  };
}
export const advisorInboxUnread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const advisor = await advisorDesk(context.userId);
    const [row] = await (await getSql())<{ n: number }>`
      select coalesce(sum(unread_advisor), 0)::int as n
      from ora_advisor_inbox
      where advisor_id = ${advisor.id}
    `.catch(() => [{ n: 0 }]);
    return { unread: Number(row?.n) || 0 };
  });
export const advisorThread: any = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ customerId: clip(input.customerId, 80) }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    await ensureChatMediaColumns();
    const sql = await getSql();
    const threadId = await loadOrCreateThread(advisor.id, data.customerId);
    await sql`
      update ora_advisor_inbox set unread_advisor = 0
      where id = ${threadId} and advisor_id = ${advisor.id}
    `;
    const [profile] = await sql`
      select display_name from ora_profiles where user_id = ${data.customerId}
    `;
    const messages = await sql`
      select m.id, m.role, m.body, m.created_at::text as created_at, m.image_url, m.tip_gift,
             coalesce(pm.coins, 0)::int as paid_coins
      from ora_advisor_inbox_messages m
      left join ora_paid_messages pm on pm.message_id = m.id and pm.coins > 0
      where m.thread_id = ${threadId}
      order by m.created_at asc
      limit 200
    `.catch(() => []);
    const [note] = await sql`
      select body from ora_advisor_notes where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
    `.catch(() => []);
    const [live] = await sql`
      select id from ora_readings
      where advisor_id = ${advisor.id} and client_id = ${data.customerId} and status = 'live'
      limit 1
    `.catch(() => []);
    const outreach = await loadOutreachContext(advisor.id, data.customerId);
    const [openFollow] = await sql`
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
      blocked: outreach.blocked,
      blockedByMe: Boolean(outreach.blockedByMe),
      optedOut: outreach.optedOut,
      waitingForReply: outreach.waitingForReply,
      remainingToday: outreach.remainingToday,
      dailyLimit: ADVISOR_DAILY_CLIENT_MESSAGES,
      followUpReadingId: openFollow?.id || "",
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        body: m.body,
        image: displayChatImage(m.image_url),
        tipGift: String(m.tip_gift || ""),
        at: m.created_at,
        paidCoins: Math.max(0, Math.floor(Number(m.paid_coins) || 0)),
      })),
    };
  });
export const sendAdvisorInboxMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    body: parseChatMessageBody(input.body),
    image: sanitizeChatImage(input.image),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    if (!data.body && !data.image) throw new Error("Write a message.");
    const advisor = await advisorDesk(context.userId);
    const outreach = await loadOutreachContext(advisor.id, data.customerId);
    const denied = clientMessageDeniedReason(outreach);
    if (denied) throw new Error(denied);
    return postAdvisorClientMessage({
      advisorId: advisor.id,
      advisorName: advisor.name,
      customerId: data.customerId,
      body: data.body,
      image: data.image,
      kind: "message",
    });
  });
export const readingFollowUpState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }: any) => {
    if (!data.readingId) throw new Error("Choose a reading.");
    const advisor = await advisorDesk(context.userId);
    const reading = await loadEndedReadingForFollowUp(advisor.id, data.readingId);
    const alreadySent = reading ? await followUpAlreadySent(reading.id) : false;
    const hasEndedSession = reading?.status === "ended";
    const outreach = reading
      ? await loadOutreachContext(advisor.id, reading.client_id)
      : { remainingToday: 0, blocked: false, blockedByMe: false, optedOut: false, consecutiveAdvisor: 0, waitingForReply: false };
    return {
      readingId: data.readingId,
      customerId: reading?.client_id || "",
      alreadySent,
      remainingToday: outreach.remainingToday,
      waitingForReply: Boolean(outreach.waitingForReply),
      dailyLimit: ADVISOR_DAILY_CLIENT_MESSAGES,
      canSend:
        followUpDeniedReason({
          hasEndedSession,
          alreadySent,
          remainingToday: outreach.remainingToday,
          blocked: outreach.blocked,
          optedOut: outreach.optedOut,
          consecutiveAdvisor: outreach.consecutiveAdvisor,
        }) == null,
    };
  });
export const sendReadingFollowUp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    readingId: clip(input.readingId, 64),
    body: parseChatMessageBody(input.body),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.readingId) throw new Error("Choose a reading.");
    if (!data.body) throw new Error("Write a follow-up first.");
    const advisor = await advisorDesk(context.userId);
    const reading = await loadEndedReadingForFollowUp(advisor.id, data.readingId);
    const alreadySent = reading ? await followUpAlreadySent(reading.id) : false;
    const outreach = reading
      ? await loadOutreachContext(advisor.id, reading.client_id)
      : { remainingToday: 0, blocked: false, blockedByMe: false, optedOut: false, consecutiveAdvisor: 0, waitingForReply: false };
    const denied = followUpDeniedReason({
      hasEndedSession: reading?.status === "ended",
      alreadySent,
      remainingToday: outreach.remainingToday,
      blocked: outreach.blocked,
      optedOut: outreach.optedOut,
      consecutiveAdvisor: outreach.consecutiveAdvisor,
    }) || (reading ? clientMessageDeniedReason({ ...outreach, hasSession: true }) : null);
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

export const advisorSessionClientNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }: any) => {
    if (!data.readingId) return { notes: [] as Array<{ id: string; body: string; createdAt: string }> };
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [reading] = await sql`
      select client_id from ora_readings
      where id = ${data.readingId} and advisor_id = ${advisor.id}
      limit 1
    `.catch(() => []);
    if (!reading?.client_id) return { notes: [] };
    let notes = (
      await sql`
        select id, body, created_at::text as created_at
        from ora_advisor_note_entries
        where advisor_id = ${advisor.id} and customer_id = ${reading.client_id}
        order by created_at desc
        limit 5
      `.catch(() => [])
    ).map((n) => ({
      id: String(n.id),
      body: String(n.body || ""),
      createdAt: String(n.created_at || ""),
    }));
    if (!notes.length) {
      const [summary] = await sql`
        select body, updated_at::text as updated_at
        from ora_advisor_notes
        where advisor_id = ${advisor.id} and customer_id = ${reading.client_id}
        limit 1
      `.catch(() => []);
      if (summary?.body) {
        notes = [
          {
            id: "summary",
            body: String(summary.body),
            createdAt: String(summary.updated_at || ""),
          },
        ];
      }
    }
    return { customerId: reading.client_id, notes: notes.filter((n) => n.body.trim()) };
  });

export const giftClientMinutes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    seconds: Math.min(1800, Math.max(30, Math.floor(Number(input.seconds) || 180))),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    const outreach = await loadOutreachContext(advisor.id, data.customerId);
    const denied = advisorDirectContactDeniedReason({
      hasSession: outreach.hasSession,
      blocked: outreach.blocked,
      action: "gift",
    });
    if (denied) throw new Error(denied);
    const sql = await getSql();
    const [wallet] = await sql`select user_id from ora_wallets where user_id = ${data.customerId}`;
    if (!wallet) throw new Error("That client has no wallet yet.");
    await sql`
      update ora_wallets set bonus_seconds = bonus_seconds + ${data.seconds} where user_id = ${data.customerId}
    `;
    const id = rid("gift");
    await sql`
      insert into ora_advisor_gifts (id, advisor_id, customer_id, seconds)
      values (${id}, ${advisor.id}, ${data.customerId}, ${data.seconds})
    `;
    await addLedger(
      data.customerId,
      "gift",
      0,
      data.seconds,
      `Advisor gift · ${Math.round(data.seconds / 60)} free minutes`,
      id,
    );
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
    return {
      ok: true,
      seconds: data.seconds,
    };
  });
export const requestClientPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    coins: Math.min(5e3, Math.max(10, Math.floor(Number(input.coins) || 100))),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    const outreach = await loadOutreachContext(advisor.id, data.customerId);
    const denied = advisorDirectContactDeniedReason({
      hasSession: outreach.hasSession,
      blocked: outreach.blocked,
      action: "pay",
    });
    if (denied) throw new Error(denied);
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
    return {
      ok: true,
      id,
      coins: data.coins,
    };
  });
export const setAcceptsChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ accepts: Boolean(input.accepts) }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    try {
      await sql`update ora_advisors set accepts_chat = ${data.accepts} where id = ${advisor.id}`;
    } catch (err) {
      console.error("[ora] accepts_chat update", err);
      throw new Error("Could not update live chat availability.");
    }
    if (!data.accepts)
      await sql`update ora_chat_requests set status = 'expired' where advisor_id = ${advisor.id} and status = 'pending'`;
    return { accepts: data.accepts };
  });
export const advisorDeskHome: any = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [profile] = await sql`
      select display_name, email from ora_profiles where user_id = ${context.userId}
    `;
    const [row] = await sql`
      select photo_url, rating, reviews, coalesce(accepts_chat, true) as accepts_chat, online, busy, name,
             coalesce(is_new, false) as is_new, coalesce(away, false) as away
      from ora_advisors where id = ${advisor.id}
    `.catch(async () => {
      const [fallback] = await sql`
        select photo_url, rating, reviews, true as accepts_chat, online, busy, name, coalesce(is_new, false) as is_new, false as away
        from ora_advisors where id = ${advisor.id}
      `;
      return fallback ? [fallback] : [];
    });
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const presence = await sql`
      select started_at, ended_at, seconds from ora_advisor_presence
      where advisor_id = ${advisor.id}
      order by started_at desc
      limit 400
    `.catch(() => []);
    const onlineToday = sumPresence(presence, start, new Date());
    const [open] = await sql`
      select started_at from ora_advisor_presence
      where advisor_id = ${advisor.id} and ended_at is null
      order by started_at desc limit 1
    `.catch(() => []);
    const currentSeconds = open
      ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1e3))
      : 0;
    const todaySeconds = presence.some((p) => !p.ended_at)
      ? onlineToday
      : onlineToday +
        (open ? overlapSeconds(open.started_at, null, start, new Date()) : 0);
    const requests = await sql`
      select status from ora_chat_requests
      where advisor_id = ${advisor.id} and created_at >= ${start.toISOString()}
    `.catch(() => []);
    const accepted = requests.filter((r) => r.status === "accepted").length;
    const declined = requests.filter(
      (r) => r.status === "declined" || r.status === "expired",
    ).length;
    const [earn] = await sql`
      select coalesce(sum(advisor_earned), 0)::int as today
      from ora_readings r
      where r.advisor_id = ${advisor.id}
        and r.status in ('ended', 'completed')
        and coalesce(r.coins_spent, 0) > 0
        and coalesce(r.ended_at, r.started_at) >= ${start.toISOString()}
        and not exists (select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed')
    `.catch(() => [{ today: 0 }]);
    const [live] = await sql`
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
      away: Boolean(row?.away),
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
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    try {
      await settleAdvisorEarnings(advisor.id);
    } catch (err) {
      console.error("[ora] settle earnings", err);
    }
    const fresh = await sql`
      select coalesce(payout_coins, 0)::int as payout_coins, coalesce(pending_coins, 0)::int as pending_coins
      from ora_advisors where id = ${advisor.id}
    `.catch(() => [
      {
        payout_coins: 0,
        pending_coins: 0,
      },
    ]);
    const windows = statsWindow("day");
    const week = statsWindow("week");
    const month = statsWindow("month");
    const sums = await sql`
      select
        coalesce(sum(case when r.started_at >= ${windows.from.toISOString()} then r.advisor_earned else 0 end), 0)::int as today,
        coalesce(sum(case when r.started_at >= ${week.from.toISOString()} then r.advisor_earned else 0 end), 0)::int as week,
        coalesce(sum(case when r.started_at >= ${month.from.toISOString()} then r.advisor_earned else 0 end), 0)::int as month,
        coalesce(sum(r.advisor_earned), 0)::int as all_time
      from ora_readings r
      where r.advisor_id = ${advisor.id}
        and not exists (
          select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed'
        )
    `.catch(() => [
      {
        today: 0,
        week: 0,
        month: 0,
        all_time: 0,
      },
    ]);
    const payouts = await sql`
      select id, coins, usd, status, created_at::text as created_at
      from ora_payouts where advisor_id = ${advisor.id}
      order by created_at desc
      limit 40
    `.catch(() => []);
    const requested = payouts
      .filter((p) => p.status === "requested")
      .reduce((n, p) => n + Number(p.coins), 0);
    const rows = await sql`
      select r.id, r.client_id as customer_id, coalesce(p.display_name, 'Client') as display_name,
             r.started_at::text as started_at, r.status, r.coins_spent, r.advisor_earned, r.platform_fee, r.seconds
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${advisor.id}
      order by r.started_at desc
      limit 80
    `.catch(() => []);
    const messageSums = await sql`
      select
        coalesce(sum(case when created_at >= ${windows.from.toISOString()} then advisor_share_cents else 0 end), 0)::int as today,
        coalesce(sum(advisor_share_cents), 0)::int as all_time,
        coalesce(sum(coins), 0)::int as charged,
        coalesce(sum(ora_share_cents), 0)::int as ora_share
      from ora_paid_messages
      where advisor_id = ${advisor.id}
    `.catch(() => [{ today: 0, all_time: 0, charged: 0, ora_share: 0 }]);
    const messageRows = await sql`
      select m.id, m.customer_id, coalesce(p.display_name, 'Client') as display_name,
             m.created_at::text as created_at, m.coins, m.advisor_share_cents as advisor_share_coins, m.ora_share_cents as ora_share_coins
      from ora_paid_messages m
      left join ora_profiles p on p.user_id = m.customer_id
      where m.advisor_id = ${advisor.id}
      order by m.created_at desc
      limit 40
    `.catch(() => []);
    return {
      today: Number(sums[0]?.today ?? 0),
      week: Number(sums[0]?.week ?? 0),
      month: Number(sums[0]?.month ?? 0),
      allTime: Number(sums[0]?.all_time ?? 0),
      available: Number(fresh[0]?.payout_coins ?? 0),
      pendingHold: Number(fresh[0]?.pending_coins ?? 0),
      requested,
      messageToday: Number(messageSums[0]?.today ?? 0),
      messageAllTime: Number(messageSums[0]?.all_time ?? 0),
      messageCharged: Number(messageSums[0]?.charged ?? 0),
      messageOraShare: Number(messageSums[0]?.ora_share ?? 0),
      messageRows: messageRows.map((r) => ({
        id: r.id,
        customerName: r.display_name,
        at: r.created_at,
        gross: Number(r.coins) || 0,
        advisorShare: Number(r.advisor_share_coins) || 0,
        oraShare: Number(r.ora_share_coins) || 0,
      })),
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
function clipText(value, max) {
  return String(value || "")
    .trim()
    .slice(0, max);
}
export const getAdvisorProfileEdit: any = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [row] = await sql`
      select name, coalesce(gender, '') as gender, coalesce(headline, '') as headline, bio, experience, specialties,
             languages, years, rate_coins, photo_url, video_url, coalesce(gallery_json, '[]') as gallery_json,
             coalesce(reading_notice, '') as reading_notice, coalesce(quick_greeting, '') as quick_greeting,
             coalesce(auto_response, '') as auto_response, coalesce(auto_live_greeting, '') as auto_live_greeting
      from ora_advisors where id = ${advisor.id}
    `.catch(async () => {
      const [fallback] = await sql`
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
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
      })),
    };
  });
export const saveAdvisorProfileEdit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    name: clipText(input.name, 80),
    gender: normalizeGender(input.gender),
    headline: clipText(input.headline, 160),
    bio: clipText(input.bio, 1200),
    experience: clipText(input.experience, 800),
    specialties: joinSpecialties(input.specialties),
    languages: clipText(input.languages, 80) || "English",
    years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
    rateCoins: requireRate(input.rateCoins),
    photoUrl: input.photoUrl ? visibleAdvisorPhoto(String(input.photoUrl).slice(0, 400000)) : void 0,
    videoUrl: clipText(input.videoUrl, 500),
    gallery: parseGalleryJson(input.gallery),
    readingNotice: clipText(input.readingNotice, 400),
    quickGreeting: clipText(input.quickGreeting, 280),
    autoResponse: clipText(input.autoResponse, 400),
    autoLiveGreeting: clipText(input.autoLiveGreeting, 400),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.name) throw new Error("Display name is required.");
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const gallery = serializeGallery(data.gallery);
    const photo = data.photoUrl || void 0;
    try {
      if (photo)
        await sql`
          update ora_advisors
          set name = ${data.name}, gender = ${data.gender}, headline = ${data.headline}, bio = ${data.bio},
              experience = ${data.experience}, specialties = ${data.specialties}, languages = ${data.languages},
              years = ${data.years}, rate_coins = ${data.rateCoins}, photo_url = ${photo}, video_url = ${data.videoUrl},
              gallery_json = ${gallery}, reading_notice = ${data.readingNotice}, quick_greeting = ${data.quickGreeting},
              auto_response = ${data.autoResponse}, auto_live_greeting = ${data.autoLiveGreeting}
          where id = ${advisor.id}
        `;
      else
        await sql`
          update ora_advisors
          set name = ${data.name}, gender = ${data.gender}, headline = ${data.headline}, bio = ${data.bio},
              experience = ${data.experience}, specialties = ${data.specialties}, languages = ${data.languages},
              years = ${data.years}, rate_coins = ${data.rateCoins}, video_url = ${data.videoUrl},
              gallery_json = ${gallery}, reading_notice = ${data.readingNotice}, quick_greeting = ${data.quickGreeting},
              auto_response = ${data.autoResponse}, auto_live_greeting = ${data.autoLiveGreeting}
          where id = ${advisor.id}
        `;
    } catch (err) {
      console.error("[ora] save advisor profile extras", err);
      if (photo)
        await sql`
          update ora_advisors
          set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
              languages = ${data.languages}, years = ${data.years}, rate_coins = ${data.rateCoins},
              photo_url = ${photo}, video_url = ${data.videoUrl}
          where id = ${advisor.id}
        `;
      else
        await sql`
          update ora_advisors
          set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
              languages = ${data.languages}, years = ${data.years}, rate_coins = ${data.rateCoins}, video_url = ${data.videoUrl}
          where id = ${advisor.id}
        `;
    }
    return { ok: true };
  });
export const listAdvisorBlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    return {
      blocked: (
        await (await getSql())`
      select b.customer_id, coalesce(p.display_name, 'Client') as display_name, b.created_at::text as created_at
      from ora_advisor_blocks b
      left join ora_profiles p on p.user_id = b.customer_id
      where b.advisor_id = ${advisor.id}
      order by b.created_at desc
      limit 80
    `.catch(() => [])
      ).map((r) => ({
        customerId: r.customer_id,
        name: r.display_name,
        at: r.created_at,
      })),
    };
  });
export const setAdvisorBlock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    blocked: Boolean(input.blocked),
  }))
  .handler(async ({ context, data }: any) => {
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
    } else
      await sql`
        delete from ora_advisor_blocks where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
      `;
    return {
      ok: true,
      blocked: data.blocked,
    };
  });
export const listAdvisorQuickReplies = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    return {
      replies: (
        await (await getSql())`
      select id, body from ora_advisor_quick_replies
      where advisor_id = ${advisor.id}
      order by sort_order asc, created_at asc
      limit 12
    `.catch(() => [])
      ).map((r) => ({
        id: r.id,
        body: r.body,
      })),
    };
  });
export const saveAdvisorQuickReplies = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ replies: parseQuickReplies(input.replies) }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    await sql`delete from ora_advisor_quick_replies where advisor_id = ${advisor.id}`;
    let order = 0;
    for (const body of data.replies) {
      await sql`
        insert into ora_advisor_quick_replies (id, advisor_id, body, sort_order)
        values (${rid("qr")}, ${advisor.id}, ${body}, ${order})
      `;
      order += 1;
    }
    return {
      replies: data.replies.map((body, i) => ({
        id: String(i),
        body,
      })),
    };
  });
export const listAdvisorReviews = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    return {
      reviews: (
        await (await getSql())`
      select id, rating, body, created_at::text as created_at
      from ora_reviews
      where advisor_id = ${advisor.id} and hidden = false
      order by created_at desc
      limit 40
    `.catch(() => [])
      ).map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        body: r.body,
        at: r.created_at,
      })),
    };
  });
export const setAdvisorClientFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    favorite: Boolean(input.favorite),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId)))
      throw new Error("Favorites are only for clients you have already read with.");
    const sql = await getSql();
    if (data.favorite)
      await sql`
        insert into ora_advisor_client_favorites (advisor_id, customer_id, created_at)
        values (${advisor.id}, ${data.customerId}, now())
        on conflict (advisor_id, customer_id) do nothing
      `;
    else
      await sql`
        delete from ora_advisor_client_favorites
        where advisor_id = ${advisor.id} and customer_id = ${data.customerId}
      `;
    return {
      ok: true,
      favorite: data.favorite,
    };
  });
export const listAdvisorReminders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    const rows = await (await getSql())`
      select r.id, r.customer_id, coalesce(p.display_name, 'Client') as display_name,
             r.due_at::text as due_at, r.note, r.done_at::text as done_at,
             r.notified_at::text as notified_at
      from ora_advisor_reminders r
      left join ora_profiles p on p.user_id = r.customer_id
      where r.advisor_id = ${advisor.id}
      order by case when r.done_at is null then 0 else 1 end, r.due_at asc
      limit 120
    `.catch(() => []);
    const ids = rows.map((r) => r.customer_id);
    const { loadLoyaltyByUserIds } = await import("@/lib/ora-loyalty");
    const [photos, loyalty] = await Promise.all([
      loadClientPhotos(ids).catch(() => new Map()),
      loadLoyaltyByUserIds(ids).catch(() => new Map()),
    ]);
    const now = Date.now();
    return {
      reminders: rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        name: r.display_name,
        dueAt: r.due_at,
        note: r.note,
        doneAt: r.done_at || "",
        notifiedAt: r.notified_at || "",
        due: !r.done_at && new Date(r.due_at).getTime() <= now,
        photoUrl: photos.get(r.customer_id) || "",
        loyaltyTier: loyalty.get(r.customer_id)?.tier ?? "none",
      })),
    };
  });
export const saveAdvisorReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    id: clip(input.id, 80),
    customerId: clip(input.customerId, 80),
    preset: clip(input.preset, 20),
    customAt: clip(input.customAt, 40),
    date: clip(input.date, 12),
    time: clip(input.time, 8),
    note: clip(input.note, 280),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    const due = data.date
      ? reminderFromLocalParts(data.date, data.time)
      : reminderDueAt(data.preset, data.customAt);
    if (!due) throw new Error("Choose a follow-up date and time.");
    const advisor = await advisorDesk(context.userId);
    if (!(await hasAdvisorSession(advisor.id, data.customerId)))
      throw new Error("Reminders are only for clients you have already read with.");
    const sql = await getSql();
    if (data.id) {
      if (
        !(
          await sql`
        update ora_advisor_reminders
        set due_at = ${due.toISOString()}, note = ${data.note}, customer_id = ${data.customerId}, notified_at = null
        where id = ${data.id} and advisor_id = ${advisor.id} and done_at is null
        returning id
      `
        ).length
      )
        throw new Error("Reminder not found or already completed.");
      return {
        ok: true,
        id: data.id,
        dueAt: due.toISOString(),
      };
    }
    const open = await sql`
      select id, customer_id, note, due_at::text as due_at, done_at::text as done_at
      from ora_advisor_reminders
      where advisor_id = ${advisor.id} and customer_id = ${data.customerId} and done_at is null
    `.catch(() => []);
    const match = open.find((row) =>
      isDuplicateOpenReminder(
        { customerId: row.customer_id, note: row.note, dueAt: row.due_at, doneAt: row.done_at },
        { customerId: data.customerId, note: data.note, dueAt: due },
      ),
    );
    if (match) {
      return { ok: true, id: match.id, dueAt: match.due_at, duplicate: true };
    }
    const id = rid("rmd");
    await sql`
      insert into ora_advisor_reminders (id, advisor_id, customer_id, due_at, note, created_at)
      values (${id}, ${advisor.id}, ${data.customerId}, ${due.toISOString()}, ${data.note}, now())
    `;
    return {
      ok: true,
      id,
      dueAt: due.toISOString(),
    };
  });
export const completeAdvisorReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ id: clip(input.id, 80) }))
  .handler(async ({ context, data }: any) => {
    if (!data.id) throw new Error("Choose a reminder.");
    const advisor = await advisorDesk(context.userId);
    if (
      !(
        await (await getSql())`
      update ora_advisor_reminders
      set done_at = now()
      where id = ${data.id} and advisor_id = ${advisor.id} and done_at is null
      returning id
    `
      ).length
    )
      throw new Error("Reminder not found.");
    return { ok: true };
  });
export const snoozeAdvisorReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    id: clip(input.id, 80),
    preset: clip(input.preset, 20),
    customAt: clip(input.customAt, 40),
    date: clip(input.date, 12),
    time: clip(input.time, 8),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.id) throw new Error("Choose a reminder.");
    const due = data.date
      ? reminderFromLocalParts(data.date, data.time)
      : snoozeDueAt(data.preset, data.customAt);
    if (!due) throw new Error("Choose when to snooze until.");
    const advisor = await advisorDesk(context.userId);
    if (
      !(
        await (await getSql())`
      update ora_advisor_reminders
      set due_at = ${due.toISOString()}, notified_at = null, done_at = null
      where id = ${data.id} and advisor_id = ${advisor.id} and done_at is null
      returning id
    `
      ).length
    )
      throw new Error("Reminder not found.");
    return { ok: true, dueAt: due.toISOString() };
  });
export const ackAdvisorReminderDue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ id: clip(input.id, 80) }))
  .handler(async ({ context, data }: any) => {
    if (!data.id) return { ok: true };
    const advisor = await advisorDesk(context.userId);
    await (await getSql())`
      update ora_advisor_reminders
      set notified_at = coalesce(notified_at, now())
      where id = ${data.id} and advisor_id = ${advisor.id} and done_at is null
    `;
    return { ok: true };
  });
export const deleteAdvisorReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ id: clip(input.id, 80) }))
  .handler(async ({ context, data }: any) => {
    if (!data.id) throw new Error("Choose a reminder.");
    const advisor = await advisorDesk(context.userId);
    if (
      !(
        await (await getSql())`
      delete from ora_advisor_reminders
      where id = ${data.id} and advisor_id = ${advisor.id}
      returning id
    `
      ).length
    )
      throw new Error("Reminder not found.");
    return { ok: true };
  });
export const reportAdvisorClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({
    customerId: clip(input.customerId, 80),
    kind: parseAdvisorReportKind(input.kind),
    reason: parseAdvisorReportReason(input.reason),
    body: clip(input.body, 2000),
    readingId: clip(input.readingId, 80),
  }))
  .handler(async ({ context, data }: any) => {
    if (!data.customerId) throw new Error("Choose a client.");
    if (data.body.length > 2000) throw new Error("That note is too long.");
    const advisor = await advisorDesk(context.userId);
    if (data.customerId === context.userId) throw new Error("You cannot report your own account.");
    if (!(await hasAdvisorSession(advisor.id, data.customerId)))
      throw new Error("Reports are only for clients you have already read with.");
    const { createAdvisorSafetyReport } = await import("@/lib/ora-safety-api");
    const id = await createAdvisorSafetyReport({
      advisorId: advisor.id,
      advisorUserId: context.userId,
      customerId: data.customerId,
      kind: data.kind,
      reason: data.reason,
      body: data.body,
      readingId: data.readingId,
    });
    return {
      ok: true,
      id,
    };
  });
export const saveAdvisorHours = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ hours: parseHoursJson(input.hours) }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    data.hours.configured = true;
    await (await getSql())`
      update ora_advisors
      set hours_json = ${serializeHoursJson(data.hours)},
          schedule_tz = ${data.hours.timezone || "UTC"}
      where id = ${advisor.id}
    `;
    return {
      ok: true,
      hours: parseHoursJson(data.hours),
    };
  });
export const getAdvisorHours = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }: any) => {
    const advisor = await advisorDesk(context.userId);
    const [row] = await (await getSql())`
      select coalesce(hours_json, '') as hours_json,
             coalesce(away, false) as away,
             coalesce(schedule_tz, '') as schedule_tz
      from ora_advisors where id = ${advisor.id}
    `.catch(() => [{ hours_json: "", away: false, schedule_tz: "" }]);
    const hours = parseHoursJson(row?.hours_json);
    if (row?.schedule_tz) hours.timezone = String(row.schedule_tz);
    return { hours, away: Boolean(row?.away), timezone: hours.timezone };
  });
export const setAdvisorAway = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: any) => ({ away: Boolean(input.away) }))
  .handler(async ({ context, data }: any) => {
    const advisor = await advisorDesk(context.userId);
    const sql = await getSql();
    const [live] = await sql`
      select id from ora_readings where advisor_id = ${advisor.id} and status = 'live' limit 1
    `.catch(() => []);
    await sql`update ora_advisors set away = ${data.away} where id = ${advisor.id}`;
    if (data.away) {
      await sql`update ora_chat_requests set status = 'expired' where advisor_id = ${advisor.id} and status = 'pending'`;
    }
    return { ok: true, away: data.away, liveKept: Boolean(live) };
  });

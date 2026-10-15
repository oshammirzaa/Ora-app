import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withSqlTransaction, type Sql } from "@/lib/db";
import { auditLog, loadSettings, requireAdmin, rid, splitCoins, submitChatRequest } from "@/lib/ora";
import { ensureFavoriteExtras } from "@/lib/ora-favorites";
import { premiumFlags, resolvePremiumFlags, type PremiumFlag, type PremiumFlags } from "@/lib/ora-feature-flags";
import {
  AFFIRM_CATEGORIES,
  BADGE_DEFS,
  EXTENSION_MINUTES,
  MOODS,
  ORACLE,
  PREMIUM_NOTE,
  QUEUE_DEFAULTS,
  TAROT,
  TIMELINE_KINDS,
  affirmationFor,
  badgeSnapshot,
  checkInStreak,
  compatibilityReport,
  extensionDecision,
  extensionQuote,
  extensionRefundCoins,
  localDateKey,
  moonAgeDays,
  moonCopy,
  moonPhaseId,
  moodSupport,
  offerExpired,
  oracleDeal,
  parseBirth,
  parseInterests,
  premiumAccess,
  queuePosition,
  safeTimeZone,
  signLabel,
  tarotFor,
  upcomingMoonEvents,
  vaultBodyAllowed,
  waitEstimateMinutes,
  yearsSince,
  type AffirmCategory,
  type MoonPhaseId,
} from "@/lib/ora-premium-rules";

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

async function readJson<T>(sql: Sql, key: string, fallback: T): Promise<T> {
  const rows = await sql<{ value_json: string }>`select value_json from ora_advanced_settings where key = ${key}`.catch(() => []);
  if (!rows[0]?.value_json) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(rows[0].value_json) as Partial<T>) };
  } catch {
    return fallback;
  }
}

async function writeJson(sql: Sql, key: string, value: unknown) {
  const json = JSON.stringify(value);
  await sql`
    insert into ora_advanced_settings (key, value_json, updated_at)
    values (${key}, ${json}, now())
    on conflict (key) do update set value_json = excluded.value_json, updated_at = now()
  `;
}

async function flagsFor(sql: Sql): Promise<PremiumFlags> {
  const stored = await readJson<Partial<PremiumFlags>>(sql, "premiumFlags", {});
  return resolvePremiumFlags(premiumFlags(), stored);
}

async function queueSettings(sql: Sql) {
  const row = await readJson(sql, "premiumQueue", QUEUE_DEFAULTS);
  return {
    enabled: row.enabled !== false,
    maxLength: Math.min(50, Math.max(1, Math.floor(Number(row.maxLength) || QUEUE_DEFAULTS.maxLength))),
    inviteSeconds: Math.min(180, Math.max(20, Math.floor(Number(row.inviteSeconds) || QUEUE_DEFAULTS.inviteSeconds))),
  };
}

type ContentBag = {
  tarot?: Record<string, Partial<{ meaning: string; love: string; career: string; reflection: string; guidance: string }>>;
  moods?: Record<string, { message?: string; exercise?: string }>;
  moon?: Record<string, { theme?: string; prompt?: string; journal?: string; affirmation?: string }>;
  affirmations?: Partial<Record<AffirmCategory, string[]>>;
};

async function contentFor(sql: Sql) {
  return readJson<ContentBag>(sql, "premiumContent", {});
}

function withTarotCopy(card: (typeof TAROT)[number], bag: ContentBag) {
  const extra = bag.tarot?.[card.id];
  if (!extra) return card;
  return {
    ...card,
    meaning: clip(extra.meaning || card.meaning, 500),
    love: clip(extra.love || card.love, 500),
    career: clip(extra.career || card.career, 500),
    reflection: clip(extra.reflection || card.reflection, 500),
    guidance: clip(extra.guidance || card.guidance, 500),
  };
}

async function membershipOf(sql: Sql, userId: string) {
  const [row] = await sql<{ membership_active: boolean; membership_plan: string | null; membership_renews_at: string | null }>`
    select membership_active, membership_plan, membership_renews_at
    from ora_wallets where user_id = ${userId}
  `.catch(() => []);
  const plan = row?.membership_plan === "mini" || row?.membership_plan === "membership" ? row.membership_plan : "";
  const renewsAt = row?.membership_renews_at ? new Date(row.membership_renews_at).toISOString() : "";
  return {
    allowed: premiumAccess({ active: Boolean(row?.membership_active), plan, renewsAt }),
    plan,
    renewsAt,
  };
}

async function gate(sql: Sql, userId: string, flag: PremiumFlag) {
  const flags = await flagsFor(sql);
  const mem = await membershipOf(sql, userId);
  if (!flags[flag]) return { ok: false as const, reason: "off" as const, plan: mem.plan, flags };
  if (!mem.allowed) return { ok: false as const, reason: "locked" as const, plan: mem.plan, flags };
  return { ok: true as const, reason: "ready" as const, plan: mem.plan, flags };
}

async function zoneFor(sql: Sql, userId: string, requested?: string) {
  const saved = await sql<{ timezone: string }>`select timezone from ora_premium_prefs where user_id = ${userId}`.catch(() => []);
  const tz = safeTimeZone(requested || saved[0]?.timezone || "UTC");
  if (requested) {
    await sql`
      insert into ora_premium_prefs (user_id, timezone, updated_at)
      values (${userId}, ${tz}, now())
      on conflict (user_id) do update set timezone = excluded.timezone, updated_at = now()
    `;
  }
  return tz;
}

async function notifyUser(sql: Sql, input: { userId: string; advisorId?: string; kind: string; title: string; body: string; href: string; dedupe: string }) {
  await ensureFavoriteExtras();
  const id = rid("alrt");
  await sql`
    insert into ora_customer_alerts (id, user_id, advisor_id, kind, title, body, href, dedupe_key)
    values (${id}, ${input.userId}, ${input.advisorId || ""}, ${input.kind}, ${input.title}, ${input.body}, ${input.href}, ${input.dedupe})
    on conflict (user_id, dedupe_key) where dedupe_key <> '' do nothing
  `.catch(() => []);
}

async function syncBadges(sql: Sql, userId: string, timeZone: string) {
  const today = localDateKey(Date.now(), timeZone);
  const [readings] = await sql<{ n: number }>`
    select count(*)::int as n from ora_readings where client_id = ${userId} and status = 'ended'
  `.catch(() => [{ n: 0 }]);
  const moods = await sql<{ local_date: string }>`
    select local_date from ora_mood_checkins where user_id = ${userId}
  `.catch(() => []);
  const [tarot] = await sql<{ n: number }>`
    select count(*)::int as n from ora_daily_tarot where user_id = ${userId} and revealed_at is not null
  `.catch(() => [{ n: 0 }]);
  const [moon] = await sql<{ n: number }>`
    select count(*)::int as n from ora_moon_views where user_id = ${userId}
  `.catch(() => [{ n: 0 }]);
  const [journal] = await sql<{ n: number }>`
    select count(*)::int as n from ora_journals where user_id = ${userId}
  `.catch(() => [{ n: 0 }]);
  const [profile] = await sql<{ created_at: string }>`
    select created_at from ora_profiles where user_id = ${userId}
  `.catch(() => []);
  const snap = badgeSnapshot({
    endedReadings: Number(readings?.n || 0),
    checkInStreak: checkInStreak(moods.map((row) => row.local_date), today),
    tarotReveals: Number(tarot?.n || 0),
    moonDays: Number(moon?.n || 0),
    journalEntries: Number(journal?.n || 0),
    memberYears: yearsSince(profile?.created_at || ""),
  });
  const earnedNow: string[] = [];
  for (const badge of snap) {
    if (!badge.earned) continue;
    const inserted = await sql<{ badge_id: string }>`
      insert into ora_customer_badges (user_id, badge_id)
      values (${userId}, ${badge.id})
      on conflict do nothing
      returning badge_id
    `.catch(() => []);
    if (inserted[0]) earnedNow.push(badge.id);
  }
  for (const id of earnedNow) {
    const def = BADGE_DEFS.find((badge) => badge.id === id);
    await notifyUser(sql, {
      userId,
      kind: "badge",
      title: "You've Earned a New Badge",
      body: def ? def.name : "A new achievement is on your profile.",
      href: "/spirit/badges",
      dedupe: `badge:${id}`,
    });
  }
  const owned = await sql<{ badge_id: string; earned_at: string }>`
    select badge_id, earned_at from ora_customer_badges where user_id = ${userId}
  `.catch(() => []);
  const ownedMap = new Map(owned.map((row) => [row.badge_id, row.earned_at]));
  return snap.map((badge) => ({
    id: badge.id,
    name: badge.name,
    detail: badge.detail,
    target: badge.target,
    progress: badge.progress,
    earned: ownedMap.has(badge.id) || badge.earned,
    earnedAt: ownedMap.get(badge.id) ? String(ownedMap.get(badge.id)) : "",
  }));
}

async function promoteAdvisor(sql: Sql, advisorId: string) {
  const settings = await queueSettings(sql);
  if (!settings.enabled) return;
  await sql`
    update ora_waiting_queue
    set status = 'expired', updated_at = now()
    where advisor_id = ${advisorId} and status = 'offered' and offer_expires_at <= now()
  `;
  const [advisor] = await sql<{ id: string; slug: string; name: string; online: boolean; busy: boolean; accepts_chat: boolean }>`
    select id, slug, name, online, busy, coalesce(accepts_chat, true) as accepts_chat
    from ora_advisors where id = ${advisorId} and status = 'live'
  `;
  if (!advisor || !advisor.online || advisor.busy || advisor.accepts_chat === false) return;
  const [openOffer] = await sql<{ id: string }>`
    select id from ora_waiting_queue where advisor_id = ${advisorId} and status = 'offered' limit 1
  `;
  if (openOffer) return;
  const waiting = await sql<{ id: string; customer_id: string }>`
    select id, customer_id from ora_waiting_queue
    where advisor_id = ${advisorId} and status = 'waiting'
    order by created_at asc, id asc
  `;
  for (const row of waiting) {
    const mem = await membershipOf(sql, row.customer_id);
    if (!mem.allowed) {
      await sql`update ora_waiting_queue set status = 'expired', updated_at = now() where id = ${row.id}`;
      continue;
    }
    const expires = new Date(Date.now() + settings.inviteSeconds * 1000).toISOString();
    const updated = await sql<{ id: string }>`
      update ora_waiting_queue
      set status = 'offered', offer_expires_at = ${expires}, updated_at = now()
      where id = ${row.id} and status = 'waiting'
      returning id
    `;
    if (!updated.length) continue;
    await notifyUser(sql, {
      userId: row.customer_id,
      advisorId: advisor.id,
      kind: "queue",
      title: "Your Psychic Is Available",
      body: `${advisor.name} can take you now. You have ${settings.inviteSeconds} seconds to accept.`,
      href: `/spirit/queue?advisor=${advisor.slug || advisor.id}`,
      dedupe: `queue:${row.id}`,
    });
    return;
  }
}

export const getPremiumAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const flags = await flagsFor(sql);
    const mem = await membershipOf(sql, context.userId);
    return { flags, allowed: mem.allowed, plan: mem.plan, renewsAt: mem.renewsAt, note: PREMIUM_NOTE };
  });

export const saveCompatibility = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { selfName: string; selfBirth: string; partnerName: string; partnerBirth: string; status?: string }) => ({
    selfName: clip(input.selfName, 80),
    selfBirth: clip(input.selfBirth, 10),
    partnerName: clip(input.partnerName, 80),
    partnerBirth: clip(input.partnerBirth, 10),
    status: clip(input.status, 40),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "love");
    if (!access.ok) return { state: access.reason, plan: access.plan, report: null };
    if (!parseBirth(data.selfBirth) || !parseBirth(data.partnerBirth) || data.selfName.length < 1 || data.partnerName.length < 1) {
      throw new Error("Enter both names and valid birth dates.");
    }
    const [count] = await sql<{ n: number }>`
      select count(*)::int as n from ora_compatibility_reports
      where user_id = ${context.userId} and created_at > now() - interval '1 hour'
    `;
    if (Number(count?.n || 0) >= 12) throw new Error("You can save a few reports each hour. Try again later.");
    const report = compatibilityReport(data);
    if (!report) throw new Error("Those dates could not be read.");
    const id = rid("cmp");
    await sql`
      insert into ora_compatibility_reports (
        id, user_id, self_name, self_birth, partner_name, partner_birth, relationship_status,
        overall, emotional, communication, romantic, long_term, report_json
      ) values (
        ${id}, ${context.userId}, ${data.selfName}, ${data.selfBirth}, ${data.partnerName}, ${data.partnerBirth}, ${data.status},
        ${report.overall}, ${report.emotional}, ${report.communication}, ${report.romantic}, ${report.longTerm}, ${JSON.stringify(report)}
      )
    `;
    return {
      state: "ready" as const,
      plan: access.plan,
      report: { id, ...report, selfName: data.selfName, partnerName: data.partnerName, status: data.status, selfSignLabel: signLabel(report.selfSign), partnerSignLabel: signLabel(report.partnerSign) },
    };
  });

export const listCompatibility = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "love");
    if (!access.ok) return { state: access.reason, plan: access.plan, reports: [] as const };
    const rows = await sql<{
      id: string;
      self_name: string;
      partner_name: string;
      overall: number;
      relationship_status: string;
      created_at: string;
      report_json: string;
    }>`
      select id, self_name, partner_name, overall, relationship_status, created_at, report_json
      from ora_compatibility_reports where user_id = ${context.userId}
      order by created_at desc limit 30
    `;
    return {
      state: "ready" as const,
      plan: access.plan,
      reports: rows.map((row) => {
        const parsed = JSON.parse(row.report_json) as ReturnType<typeof compatibilityReport>;
        return {
          id: row.id,
          selfName: row.self_name,
          partnerName: row.partner_name,
          status: row.relationship_status,
          overall: row.overall,
          createdAt: String(row.created_at),
          report: parsed,
          selfSignLabel: parsed ? signLabel(parsed.selfSign) : "",
          partnerSignLabel: parsed ? signLabel(parsed.partnerSign) : "",
        };
      }),
    };
  });

export const deleteCompatibility = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clip(input.id, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "love");
    if (!access.ok) return { state: access.reason, plan: access.plan };
    await sql`delete from ora_compatibility_reports where id = ${data.id} and user_id = ${context.userId}`;
    return { state: "ready" as const, plan: access.plan };
  });

export const tarotState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timeZone?: string }) => ({ timeZone: clip(input.timeZone, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "tarot");
    if (!access.ok) return { state: access.reason, plan: access.plan, revealed: false, history: [] };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const day = localDateKey(Date.now(), zone);
    const card = withTarotCopy(tarotFor(context.userId, day), await contentFor(sql));
    await sql`
      insert into ora_daily_tarot (user_id, local_date, card_id)
      values (${context.userId}, ${day}, ${card.id})
      on conflict (user_id, local_date) do nothing
    `;
    const [today] = await sql<{ card_id: string; revealed_at: string | null }>`
      select card_id, revealed_at from ora_daily_tarot where user_id = ${context.userId} and local_date = ${day}
    `;
    const prefs = await sql<{ notify_tarot: boolean }>`select notify_tarot from ora_premium_prefs where user_id = ${context.userId}`.catch(() => []);
    if (prefs[0]?.notify_tarot && !today?.revealed_at) {
      await notifyUser(sql, {
        userId: context.userId,
        kind: "tarot",
        title: "Your Daily Tarot Card Is Ready",
        body: "Your daily tarot card is ready to reveal.",
        href: "/spirit/tarot",
        dedupe: `tarot:${day}`,
      });
    }
    const history = await sql<{ local_date: string; card_id: string }>`
      select local_date, card_id from ora_daily_tarot
      where user_id = ${context.userId} and revealed_at is not null and local_date <> ${day}
      order by local_date desc limit 21
    `;
    const bag = await contentFor(sql);
    const revealed = Boolean(today?.revealed_at);
    const shown = TAROT.find((item) => item.id === today?.card_id) || card;
    return {
      state: "ready" as const,
      plan: access.plan,
      date: day,
      revealed,
      card: revealed ? withTarotCopy(shown, bag) : null,
      history: history.map((row) => {
        const found = TAROT.find((item) => item.id === row.card_id);
        return { date: row.local_date, card: found ? withTarotCopy(found, bag) : null };
      }),
    };
  });

export const revealTarot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timeZone?: string }) => ({ timeZone: clip(input.timeZone, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "tarot");
    if (!access.ok) return { state: access.reason, plan: access.plan, card: null };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const day = localDateKey(Date.now(), zone);
    const card = withTarotCopy(tarotFor(context.userId, day), await contentFor(sql));
    await sql`
      insert into ora_daily_tarot (user_id, local_date, card_id, revealed_at)
      values (${context.userId}, ${day}, ${card.id}, now())
      on conflict (user_id, local_date) do update
      set revealed_at = coalesce(ora_daily_tarot.revealed_at, now())
    `;
    const [today] = await sql<{ card_id: string }>`
      select card_id from ora_daily_tarot where user_id = ${context.userId} and local_date = ${day}
    `;
    const shown = TAROT.find((item) => item.id === today?.card_id) || card;
    await syncBadges(sql, context.userId, zone);
    return { state: "ready" as const, plan: access.plan, card: withTarotCopy(shown, await contentFor(sql)) };
  });

async function unlockVault(sql: Sql, userId: string) {
  const due = await sql<{ id: string; advisor_id: string }>`
    select id, advisor_id from ora_future_messages
    where customer_id = ${userId} and status = 'locked' and hidden = false and unlock_at <= now()
  `;
  for (const row of due) {
    const updated = await sql<{ id: string }>`
      update ora_future_messages
      set status = 'unlocked', unlocked_at = now()
      where id = ${row.id} and status = 'locked'
      returning id
    `;
    if (!updated.length) continue;
    await notifyUser(sql, {
      userId,
      advisorId: row.advisor_id,
      kind: "vault",
      title: "Your Future Message Has Unlocked",
      body: "Your future message from your psychic is now ready to open.",
      href: "/spirit/vault",
      dedupe: `vault:${row.id}`,
    });
  }
}

export const listVault = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "vault");
    if (!access.ok) return { state: access.reason, plan: access.plan, messages: [] };
    await unlockVault(sql, context.userId);
    const rows = await sql<{
      id: string;
      body: string;
      status: string;
      unlock_at: string;
      advisor_name: string;
      photo_url: string;
    }>`
      select m.id, m.body, m.status, m.unlock_at, a.name as advisor_name, a.photo_url
      from ora_future_messages m
      join ora_advisors a on a.id = m.advisor_id
      where m.customer_id = ${context.userId} and m.hidden = false
      order by m.unlock_at asc
    `;
    return {
      state: "ready" as const,
      plan: access.plan,
      messages: rows.map((row) => ({
        id: row.id,
        advisorName: row.advisor_name,
        photoUrl: row.photo_url || "",
        unlockAt: String(row.unlock_at),
        status: row.status,
        body: row.status === "unlocked" ? row.body : "",
      })),
    };
  });

export const deleteVaultMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clip(input.id, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "vault");
    if (!access.ok) return { state: access.reason };
    await sql`delete from ora_future_messages where id = ${data.id} and customer_id = ${context.userId}`;
    return { state: "ready" as const };
  });

export const scheduleFutureMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string; body: string; days: number }) => ({
    readingId: clip(input.readingId, 64),
    body: clip(input.body, 2000),
    days: Number(input.days),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const flags = await flagsFor(sql);
    if (!flags.vault) throw new Error("Future messages are switched off.");
    if (![7, 15, 30].includes(data.days)) throw new Error("Choose 7, 15, or 30 days.");
    if (!vaultBodyAllowed(data.body)) throw new Error("Write a personal note. Do not ask for payment or an off-app contact.");
    const { requireApprovedAdvisor } = await import("./ora-advisor");
    const advisor = await requireApprovedAdvisor(context.userId);
    const [reading] = await sql<{ id: string; client_id: string; status: string }>`
      select id, client_id, status from ora_readings
      where id = ${data.readingId} and advisor_id = ${advisor.id} and status in ('live', 'ended')
    `;
    if (!reading) throw new Error("A future message can only be left from a reading with this client.");
    const mem = await membershipOf(sql, reading.client_id);
    if (!mem.allowed) throw new Error("This client does not have an active Ora Membership.");
    const [existing] = await sql<{ n: number }>`
      select count(*)::int as n from ora_future_messages
      where reading_id = ${reading.id} and hidden = false
    `;
    if (Number(existing?.n || 0) >= 3) throw new Error("This reading already has three future messages.");
    const unlockAt = new Date(Date.now() + data.days * 86_400_000).toISOString();
    const id = rid("fut");
    await sql`
      insert into ora_future_messages (id, advisor_id, customer_id, reading_id, body, unlock_at, status)
      values (${id}, ${advisor.id}, ${reading.client_id}, ${reading.id}, ${data.body}, ${unlockAt}, 'locked')
    `;
    await auditLog(context.userId, "future_message", "reading", reading.id, `${data.days}d`);
    return { id, unlockAt };
  });

export const listAdvisorVault = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { requireApprovedAdvisor } = await import("./ora-advisor");
    const advisor = await requireApprovedAdvisor(context.userId);
    const rows = await sql<{ id: string; body: string; status: string; unlock_at: string; customer: string }>`
      select m.id, m.body, m.status, m.unlock_at, coalesce(p.display_name, 'Client') as customer
      from ora_future_messages m
      left join ora_profiles p on p.user_id = m.customer_id
      where m.advisor_id = ${advisor.id} and m.hidden = false
      order by m.created_at desc limit 30
    `;
    return rows.map((row) => ({ id: row.id, body: row.body, status: row.status, unlockAt: String(row.unlock_at), customer: row.customer }));
  });

export const listTimeline = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "timeline");
    if (!access.ok) return { state: access.reason, plan: access.plan, events: [] };
    const rows = await sql<{
      id: string;
      event_date: string;
      title: string;
      kind: string;
      notes: string;
      reading_id: string;
      expected: boolean;
      happened: string;
      shared: boolean;
    }>`
      select id, event_date, title, kind, notes, reading_id, expected, happened, shared
      from ora_relationship_events where user_id = ${context.userId}
      order by event_date desc, created_at desc
    `;
    return { state: "ready" as const, plan: access.plan, events: rows.map(mapEvent) };
  });

function mapEvent(row: {
  id: string;
  event_date: string;
  title: string;
  kind: string;
  notes: string;
  reading_id: string;
  expected: boolean;
  happened: string;
  shared: boolean;
}) {
  return {
    id: row.id,
    date: row.event_date,
    title: row.title,
    kind: row.kind,
    notes: row.notes,
    readingId: row.reading_id,
    expected: Boolean(row.expected),
    happened: row.happened,
    shared: Boolean(row.shared),
  };
}

export const saveTimelineEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    id?: string;
    date: string;
    title: string;
    kind?: string;
    notes?: string;
    readingId?: string;
    expected?: boolean;
    happened?: string;
    shared?: boolean;
  }) => ({
    id: clip(input.id, 64),
    date: clip(input.date, 10),
    title: clip(input.title, 120),
    kind: TIMELINE_KINDS.includes(input.kind as (typeof TIMELINE_KINDS)[number]) ? String(input.kind) : "milestone",
    notes: clip(input.notes, 2000),
    readingId: clip(input.readingId, 64),
    expected: Boolean(input.expected),
    happened: ["", "yes", "no", "unknown"].includes(String(input.happened || "")) ? String(input.happened || "") : "",
    shared: Boolean(input.shared),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "timeline");
    if (!access.ok) return { state: access.reason, plan: access.plan };
    if (!parseBirth(`${data.date.slice(0, 4)}-${data.date.slice(5, 7)}-${data.date.slice(8, 10)}`.length ? data.date : "") && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new Error("Choose a date.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !data.title) throw new Error("Add a date and a title.");
    if (data.readingId) {
      const [reading] = await sql<{ id: string }>`
        select id from ora_readings where id = ${data.readingId} and client_id = ${context.userId}
      `;
      if (!reading) throw new Error("That reading is not on your account.");
    }
    if (data.id) {
      await sql`
        update ora_relationship_events
        set event_date = ${data.date}, title = ${data.title}, kind = ${data.kind}, notes = ${data.notes},
            reading_id = ${data.readingId}, expected = ${data.expected}, happened = ${data.happened},
            shared = ${data.shared}, updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
      return { state: "ready" as const, id: data.id };
    }
    const id = rid("rel");
    await sql`
      insert into ora_relationship_events (
        id, user_id, event_date, title, kind, notes, reading_id, expected, happened, shared
      ) values (
        ${id}, ${context.userId}, ${data.date}, ${data.title}, ${data.kind}, ${data.notes},
        ${data.readingId}, ${data.expected}, ${data.happened}, ${data.shared}
      )
    `;
    return { state: "ready" as const, id };
  });

export const deleteTimelineEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clip(input.id, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "timeline");
    if (!access.ok) return { state: access.reason };
    await sql`delete from ora_relationship_events where id = ${data.id} and user_id = ${context.userId}`;
    return { state: "ready" as const };
  });

export const advisorSharedTimeline = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string }) => ({ customerId: clip(input.customerId, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const flags = await flagsFor(sql);
    if (!flags.timeline) return [];
    const { requireApprovedAdvisor } = await import("./ora-advisor");
    const advisor = await requireApprovedAdvisor(context.userId);
    const [sat] = await sql<{ id: string }>`
      select id from ora_readings where advisor_id = ${advisor.id} and client_id = ${data.customerId} limit 1
    `;
    if (!sat) return [];
    const rows = await sql<{
      id: string;
      event_date: string;
      title: string;
      kind: string;
      notes: string;
      reading_id: string;
      expected: boolean;
      happened: string;
      shared: boolean;
    }>`
      select id, event_date, title, kind, notes, reading_id, expected, happened, shared
      from ora_relationship_events
      where user_id = ${data.customerId} and shared = true
      order by event_date desc limit 40
    `;
    return rows.map(mapEvent);
  });

export const queueState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string }) => ({ advisorId: clip(input.advisorId, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "queue");
    const settings = await queueSettings(sql);
    if (!access.ok) return { state: access.reason, plan: access.plan, entries: [], settings };
    const mine = await sql<{ advisor_id: string }>`
      select advisor_id from ora_waiting_queue
      where customer_id = ${context.userId} and status in ('waiting', 'offered')
    `;
    const ids = new Set(mine.map((row) => row.advisor_id));
    if (data.advisorId) {
      const [adv] = await sql<{ id: string }>`
        select id from ora_advisors where (id = ${data.advisorId} or slug = ${data.advisorId}) and status = 'live'
      `;
      if (adv) ids.add(adv.id);
    }
    for (const id of ids) {
      try {
        await promoteAdvisor(sql, id);
      } catch (err) {
        console.error("[ora] queue", err);
      }
    }
    const rows = await sql<{
      id: string;
      advisor_id: string;
      status: string;
      offer_expires_at: string | null;
      created_at: string;
      name: string;
      slug: string;
      photo_url: string;
    }>`
      select q.id, q.advisor_id, q.status, q.offer_expires_at, q.created_at, a.name, a.slug, a.photo_url
      from ora_waiting_queue q
      join ora_advisors a on a.id = q.advisor_id
      where q.customer_id = ${context.userId} and q.status in ('waiting', 'offered')
      order by q.created_at asc
    `;
    const entries = [];
    for (const row of rows) {
      const line = await sql<{ created_at: string }>`
        select created_at from ora_waiting_queue
        where advisor_id = ${row.advisor_id} and status in ('waiting', 'offered')
        order by created_at asc
      `;
      const samples = await sql<{ seconds: number }>`
        select seconds from ora_readings
        where advisor_id = ${row.advisor_id} and status = 'ended' and seconds > 30
        order by ended_at desc limit 8
      `;
      const position = row.status === "offered" ? 0 : queuePosition(line.map((item) => String(item.created_at)), String(row.created_at));
      entries.push({
        id: row.id,
        advisorId: row.advisor_id,
        advisorName: row.name,
        slug: row.slug,
        photoUrl: row.photo_url || "",
        status: row.status,
        position,
        waiting: line.length,
        expiresAt: row.offer_expires_at ? String(row.offer_expires_at) : "",
        expired: row.offer_expires_at ? offerExpired(String(row.offer_expires_at)) : false,
        estimateMinutes: waitEstimateMinutes(Math.max(position, 1), samples.map((item) => Number(item.seconds))),
      });
    }
    return { state: "ready" as const, plan: access.plan, entries, settings: { inviteSeconds: settings.inviteSeconds } };
  });

export const joinQueue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: clip(input.advisorId, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "queue");
    if (!access.ok) return { state: access.reason, plan: access.plan };
    const settings = await queueSettings(sql);
    if (!settings.enabled) return { state: "off" as const, plan: access.plan };
    const [adv] = await sql<{ id: string; busy: boolean; online: boolean }>`
      select id, busy, online from ora_advisors
      where (id = ${data.advisorId} or slug = ${data.advisorId}) and status = 'live'
    `;
    if (!adv) throw new Error("Advisor not available.");
    if (!adv.busy) throw new Error("This psychic is free. You can request a reading directly.");
    const [size] = await sql<{ n: number }>`
      select count(*)::int as n from ora_waiting_queue where advisor_id = ${adv.id} and status in ('waiting', 'offered')
    `;
    if (Number(size?.n || 0) >= settings.maxLength) throw new Error("This waiting line is full.");
    const id = rid("que");
    try {
      await sql`
        insert into ora_waiting_queue (id, advisor_id, customer_id, status)
        values (${id}, ${adv.id}, ${context.userId}, 'waiting')
      `;
    } catch {
      return { state: "ready" as const, already: true };
    }
    return { state: "ready" as const, already: false };
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clip(input.id, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update ora_waiting_queue set status = 'left', updated_at = now()
      where id = ${data.id} and customer_id = ${context.userId} and status in ('waiting', 'offered')
    `;
    return { ok: true };
  });

export const acceptQueueOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clip(input.id, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "queue");
    if (!access.ok) return { state: access.reason, plan: access.plan, mode: "", id: "", requestId: "" };
    const [row] = await sql<{ id: string; advisor_id: string; status: string; offer_expires_at: string | null }>`
      select id, advisor_id, status, offer_expires_at from ora_waiting_queue
      where id = ${data.id} and customer_id = ${context.userId}
    `;
    if (!row || row.status !== "offered") throw new Error("This invitation is no longer active.");
    if (!row.offer_expires_at || offerExpired(String(row.offer_expires_at))) {
      await sql`update ora_waiting_queue set status = 'expired', updated_at = now() where id = ${row.id}`;
      throw new Error("The invitation expired.");
    }
    const result = await submitChatRequest(context.userId, row.advisor_id);
    await sql`update ora_waiting_queue set status = 'accepted', updated_at = now() where id = ${row.id}`;
    return { state: "ready" as const, ...result };
  });

export const advisorQueueBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const flags = await flagsFor(sql);
    if (!flags.queue) return { enabled: false, waiting: 0, next: "", status: "off" };
    const { requireApprovedAdvisor } = await import("./ora-advisor");
    const advisor = await requireApprovedAdvisor(context.userId);
    await promoteAdvisor(sql, advisor.id);
    const rows = await sql<{ status: string; customer: string; offer_expires_at: string | null }>`
      select q.status, coalesce(p.display_name, 'Client') as customer, q.offer_expires_at
      from ora_waiting_queue q
      left join ora_profiles p on p.user_id = q.customer_id
      where q.advisor_id = ${advisor.id} and q.status in ('waiting', 'offered')
      order by q.created_at asc
    `;
    const next = rows.find((row) => row.status === "offered") || rows[0];
    return {
      enabled: true,
      waiting: rows.length,
      next: next?.customer || "",
      status: next?.status || "empty",
      expiresAt: next?.offer_expires_at ? String(next.offer_expires_at) : "",
    };
  });

export const pickState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timeZone?: string }) => ({ timeZone: clip(input.timeZone, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "pick");
    if (!access.ok) return { state: access.reason, plan: access.plan, cards: [], picked: null };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const day = localDateKey(Date.now(), zone);
    const deal = oracleDeal(context.userId, day);
    const [saved] = await sql<{ card_index: number; card_id: string }>`
      select card_index, card_id from ora_card_picks where user_id = ${context.userId} and local_date = ${day}
    `;
    const picked = saved ? ORACLE.find((card) => card.id === saved.card_id) || null : null;
    return {
      state: "ready" as const,
      plan: access.plan,
      date: day,
      cards: deal.map((card) => (picked ? card : { id: card.id, name: "", theme: "", reflection: "", love: "", career: "", affirmation: "" })),
      picked,
      pickedIndex: saved ? saved.card_index : -1,
    };
  });

export const chooseCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { index: number; timeZone?: string }) => ({
    index: Math.max(0, Math.min(2, Math.floor(Number(input.index)))),
    timeZone: clip(input.timeZone, 80),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "pick");
    if (!access.ok) return { state: access.reason, plan: access.plan, card: null };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const day = localDateKey(Date.now(), zone);
    const deal = oracleDeal(context.userId, day);
    const card = deal[data.index] || deal[0]!;
    await sql`
      insert into ora_card_picks (user_id, local_date, card_index, card_id)
      values (${context.userId}, ${day}, ${data.index}, ${card.id})
      on conflict (user_id, local_date) do nothing
    `;
    const [saved] = await sql<{ card_id: string; card_index: number }>`
      select card_id, card_index from ora_card_picks where user_id = ${context.userId} and local_date = ${day}
    `;
    const chosen = ORACLE.find((item) => item.id === saved?.card_id) || card;
    return { state: "ready" as const, card: chosen, index: saved?.card_index ?? data.index };
  });

export const moodState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timeZone?: string }) => ({ timeZone: clip(input.timeZone, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "mood");
    if (!access.ok) return { state: access.reason, plan: access.plan, today: null, history: [], streak: 0 };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const today = localDateKey(Date.now(), zone);
    const rows = await sql<{ id: string; local_date: string; mood: string; note: string }>`
      select id, local_date, mood, note from ora_mood_checkins
      where user_id = ${context.userId}
      order by local_date desc limit 60
    `;
    const bag = await contentFor(sql);
    const current = rows.find((row) => row.local_date === today) || null;
    return {
      state: "ready" as const,
      plan: access.plan,
      today: current ? presentMood(current, bag) : null,
      history: rows.map((row) => presentMood(row, bag)),
      streak: checkInStreak(rows.map((row) => row.local_date), today),
      moods: MOODS,
    };
  });

function presentMood(row: { id: string; local_date: string; mood: string; note: string }, bag: ContentBag) {
  const base = MOODS.includes(row.mood as (typeof MOODS)[number]) ? row.mood : "calm";
  const extra = bag.moods?.[base];
  const copy = moodSupport(base);
  return {
    id: row.id,
    date: row.local_date,
    mood: base,
    note: row.note,
    message: clip(extra?.message || copy?.message || "", 500),
    exercise: clip(extra?.exercise || copy?.exercise || "", 500),
  };
}

export const saveMood = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { mood: string; note?: string; timeZone?: string }) => ({
    mood: clip(input.mood, 20),
    note: clip(input.note, 1000),
    timeZone: clip(input.timeZone, 80),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "mood");
    if (!access.ok) return { state: access.reason, plan: access.plan };
    if (!MOODS.includes(data.mood as (typeof MOODS)[number])) throw new Error("Choose a feeling from the list.");
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const day = localDateKey(Date.now(), zone);
    const id = rid("mood");
    await sql`
      insert into ora_mood_checkins (id, user_id, local_date, mood, note)
      values (${id}, ${context.userId}, ${day}, ${data.mood}, ${data.note})
      on conflict (user_id, local_date) do update set mood = excluded.mood, note = excluded.note
    `;
    await syncBadges(sql, context.userId, zone);
    return { state: "ready" as const };
  });

export const deleteMood = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: clip(input.id, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "mood");
    if (!access.ok) return { state: access.reason };
    await sql`delete from ora_mood_checkins where id = ${data.id} and user_id = ${context.userId}`;
    return { state: "ready" as const };
  });

export const saveHighlight = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string; insights: string[]; topics: string; nextSteps: string; reflection?: string; share?: boolean }) => ({
    readingId: clip(input.readingId, 64),
    insights: (Array.isArray(input.insights) ? input.insights : []).map((item) => clip(item, 280)).filter(Boolean).slice(0, 3),
    topics: clip(input.topics, 500),
    nextSteps: clip(input.nextSteps, 800),
    reflection: clip(input.reflection, 800),
    share: Boolean(input.share),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const flags = await flagsFor(sql);
    if (!flags.highlights) throw new Error("Reading highlights are switched off.");
    if (data.insights.length !== 3) throw new Error("Add three insights from the reading.");
    const { requireApprovedAdvisor } = await import("./ora-advisor");
    const advisor = await requireApprovedAdvisor(context.userId);
    const [reading] = await sql<{ id: string; client_id: string; status: string }>`
      select id, client_id, status from ora_readings
      where id = ${data.readingId} and advisor_id = ${advisor.id} and status = 'ended'
    `;
    if (!reading) throw new Error("Highlights can be written after the reading ends.");
    const mem = await membershipOf(sql, reading.client_id);
    if (!mem.allowed) throw new Error("This client does not have an active Ora Membership.");
    const id = rid("sum");
    const status = data.share ? "shared" : "draft";
    await sql`
      insert into ora_reading_highlights (
        id, reading_id, advisor_id, customer_id, insights, topics, next_steps, reflection, status, shared_at
      ) values (
        ${id}, ${reading.id}, ${advisor.id}, ${reading.client_id}, ${JSON.stringify(data.insights)},
        ${data.topics}, ${data.nextSteps}, ${data.reflection}, ${status}, ${data.share ? new Date().toISOString() : null}
      )
      on conflict (reading_id) do update set
        insights = excluded.insights,
        topics = excluded.topics,
        next_steps = excluded.next_steps,
        reflection = excluded.reflection,
        status = excluded.status,
        shared_at = case when excluded.status = 'shared' then coalesce(ora_reading_highlights.shared_at, now()) else ora_reading_highlights.shared_at end
    `;
    if (data.share) {
      await notifyUser(sql, {
        userId: reading.client_id,
        advisorId: advisor.id,
        kind: "highlight",
        title: "Your Reading Highlights Are Ready",
        body: "A short summary from your psychic is in Reading History.",
        href: "/reading-history",
        dedupe: `highlight:${reading.id}`,
      });
    }
    return { ok: true, status };
  });

export const myHighlights = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "highlights");
    if (!access.ok) return { state: access.reason, plan: access.plan, rows: [] };
    const rows = await sql<{
      reading_id: string;
      insights: string;
      topics: string;
      next_steps: string;
      reflection: string;
      shared_at: string | null;
      advisor_name: string;
      started_at: string;
    }>`
      select h.reading_id, h.insights, h.topics, h.next_steps, h.reflection, h.shared_at,
             a.name as advisor_name, r.started_at
      from ora_reading_highlights h
      join ora_advisors a on a.id = h.advisor_id
      join ora_readings r on r.id = h.reading_id
      where h.customer_id = ${context.userId} and h.status = 'shared'
      order by h.shared_at desc limit 40
    `;
    return {
      state: "ready" as const,
      plan: access.plan,
      rows: rows.map((row) => ({
        readingId: row.reading_id,
        advisorName: row.advisor_name,
        at: row.shared_at ? String(row.shared_at) : String(row.started_at),
        insights: parseInsights(row.insights),
        topics: row.topics,
        nextSteps: row.next_steps,
        reflection: row.reflection,
      })),
    };
  });

function parseInsights(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export const reportHighlight = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string }) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update ora_reading_highlights set reported = true
      where reading_id = ${data.readingId} and customer_id = ${context.userId}
    `;
    return { ok: true };
  });

export const advisorHighlight = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string }) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { requireApprovedAdvisor } = await import("./ora-advisor");
    const advisor = await requireApprovedAdvisor(context.userId);
    const [row] = await sql<{ insights: string; topics: string; next_steps: string; reflection: string; status: string }>`
      select insights, topics, next_steps, reflection, status
      from ora_reading_highlights where reading_id = ${data.readingId} and advisor_id = ${advisor.id}
    `;
    if (!row) return null;
    return { insights: parseInsights(row.insights), topics: row.topics, nextSteps: row.next_steps, reflection: row.reflection, status: row.status };
  });

export const moonState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timeZone?: string }) => ({ timeZone: clip(input.timeZone, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "moon");
    if (!access.ok) return { state: access.reason, plan: access.plan };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const now = Date.now();
    const day = localDateKey(now, zone);
    await sql`
      insert into ora_moon_views (user_id, local_date) values (${context.userId}, ${day})
      on conflict do nothing
    `;
    const phase = moonPhaseId(moonAgeDays(now));
    const bag = await contentFor(sql);
    const copy = { ...moonCopy(phase), ...(bag.moon?.[phase] || {}) };
    const prefs = await sql<{ notify_moon: boolean }>`select notify_moon from ora_premium_prefs where user_id = ${context.userId}`.catch(() => []);
    if (phase === "full" && prefs[0]?.notify_moon) {
      await notifyUser(sql, {
        userId: context.userId,
        kind: "moon",
        title: "Full Moon Tonight",
        body: "Full Moon Tonight – Your Moon Reflection Is Ready.",
        href: "/spirit/moon",
        dedupe: `moon:${day}`,
      });
    }
    await syncBadges(sql, context.userId, zone);
    const events = upcomingMoonEvents(now, 45).slice(0, 8);
    return {
      state: "ready" as const,
      plan: access.plan,
      phase,
      ageDays: Math.round(moonAgeDays(now) * 10) / 10,
      illumination: moonIllumination(moonAgeDays(now)),
      copy,
      events,
      astronomy: "Moon phase times are astronomical estimates in your timezone. The reflection beside them is spiritual content, not a forecast.",
    };
  });

function moonIllumination(age: number) {
  const synodic = 29.530588853;
  return Math.round((1 - Math.cos((2 * Math.PI * age) / synodic)) * 50);
}

export const affirmationState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timeZone?: string; category?: string }) => ({
    timeZone: clip(input.timeZone, 80),
    category: clip(input.category, 20),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "affirmations");
    if (!access.ok) return { state: access.reason, plan: access.plan, today: null, saved: [], history: [], interests: [] };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const prefs = await sql<{ interests: string; notify_affirm: boolean }>`
      select interests, notify_affirm from ora_premium_prefs where user_id = ${context.userId}
    `.catch(() => []);
    let interests = parseInterests(prefs[0]?.interests || "");
    const requested = data.category as AffirmCategory;
    if (AFFIRM_CATEGORIES.includes(requested) && !interests.includes(requested)) {
      interests = [...interests, requested];
      await sql`
        insert into ora_premium_prefs (user_id, interests, updated_at)
        values (${context.userId}, ${interests.join(",")}, now())
        on conflict (user_id) do update set interests = excluded.interests, updated_at = now()
      `;
    }
    const category = AFFIRM_CATEGORIES.includes(requested) ? requested : interests[0] || "love";
    const day = localDateKey(Date.now(), zone);
    const bag = await contentFor(sql);
    const custom = bag.affirmations?.[category];
    const body = custom?.length
      ? custom[Math.abs(day.length + category.length) % custom.length]!
      : affirmationFor(category, context.userId, day);
    const id = rid("aff");
    await sql`
      insert into ora_affirmations (id, user_id, local_date, category, body)
      values (${id}, ${context.userId}, ${day}, ${category}, ${body})
      on conflict (user_id, local_date, category) do nothing
    `;
    if (prefs[0]?.notify_affirm) {
      await notifyUser(sql, {
        userId: context.userId,
        kind: "affirm",
        title: "Your Daily Affirmation Is Ready",
        body,
        href: "/spirit/affirm",
        dedupe: `affirm:${day}:${category}`,
      });
    }
    const rows = await sql<{ id: string; local_date: string; category: string; body: string; favorite: boolean }>`
      select id, local_date, category, body, favorite from ora_affirmations
      where user_id = ${context.userId}
      order by local_date desc, created_at desc limit 40
    `;
    const today = rows.find((row) => row.local_date === day && row.category === category) || null;
    return {
      state: "ready" as const,
      plan: access.plan,
      interests,
      category,
      today: today ? { id: today.id, body: today.body, category: today.category, favorite: today.favorite, date: today.local_date } : { id: "", body, category, favorite: false, date: day },
      saved: rows.filter((row) => row.favorite).map(mapAffirm),
      history: rows.map(mapAffirm),
    };
  });

function mapAffirm(row: { id: string; local_date: string; category: string; body: string; favorite: boolean }) {
  return { id: row.id, date: row.local_date, category: row.category, body: row.body, favorite: Boolean(row.favorite) };
}

export const setAffirmationInterests = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { interests: string[] }) => ({
    interests: (Array.isArray(input.interests) ? input.interests : [])
      .map((item) => clip(item, 20))
      .filter((item): item is AffirmCategory => AFFIRM_CATEGORIES.includes(item as AffirmCategory))
      .slice(0, 7),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "affirmations");
    if (!access.ok) return { state: access.reason };
    const interests = data.interests.length ? data.interests : (["love"] as AffirmCategory[]);
    await sql`
      insert into ora_premium_prefs (user_id, interests, updated_at)
      values (${context.userId}, ${interests.join(",")}, now())
      on conflict (user_id) do update set interests = excluded.interests, updated_at = now()
    `;
    return { state: "ready" as const, interests };
  });

export const toggleAffirmationFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; favorite: boolean }) => ({ id: clip(input.id, 64), favorite: Boolean(input.favorite) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "affirmations");
    if (!access.ok) return { state: access.reason };
    await sql`
      update ora_affirmations set favorite = ${data.favorite}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { state: "ready" as const };
  });

export const setPremiumNotices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { tarot?: boolean; moon?: boolean; affirm?: boolean }) => ({
    tarot: Boolean(input.tarot),
    moon: Boolean(input.moon),
    affirm: Boolean(input.affirm),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const mem = await membershipOf(sql, context.userId);
    if (!mem.allowed) return { state: "locked" as const, plan: mem.plan };
    await sql`
      insert into ora_premium_prefs (user_id, notify_tarot, notify_moon, notify_affirm, updated_at)
      values (${context.userId}, ${data.tarot}, ${data.moon}, ${data.affirm}, now())
      on conflict (user_id) do update set
        notify_tarot = excluded.notify_tarot,
        notify_moon = excluded.notify_moon,
        notify_affirm = excluded.notify_affirm,
        updated_at = now()
    `;
    return { state: "ready" as const };
  });

export const badgeState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timeZone?: string }) => ({ timeZone: clip(input.timeZone, 80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "badges");
    if (!access.ok) return { state: access.reason, plan: access.plan, badges: [] };
    const zone = await zoneFor(sql, context.userId, data.timeZone);
    const badges = await syncBadges(sql, context.userId, zone);
    return { state: "ready" as const, plan: access.plan, badges };
  });

export const extensionOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string }) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "extensions");
    const [reading] = await sql<{ rate_coins: number; status: string; client_id: string }>`
      select rate_coins, status, client_id from ora_readings where id = ${data.readingId}
    `;
    if (!reading || reading.client_id !== context.userId) return { state: "off" as const, options: [] };
    const options = EXTENSION_MINUTES.map((minutes) => extensionQuote(minutes, reading.rate_coins)).filter((row) => row != null);
    if (!access.ok) return { state: access.reason, plan: access.plan, options, enabled: access.flags.extensions && access.ok };
    return { state: "ready" as const, plan: access.plan, options, enabled: access.flags.extensions, live: reading.status === "live" };
  });

export const noteReadingEnding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string }) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const access = await gate(sql, context.userId, "extensions");
    if (!access.ok) return { ok: false };
    const [reading] = await sql<{ client_id: string; status: string }>`
      select client_id, status from ora_readings where id = ${data.readingId}
    `;
    if (!reading || reading.client_id !== context.userId || reading.status !== "live") return { ok: false };
    await notifyUser(sql, {
      userId: context.userId,
      kind: "ending",
      title: "Your Reading Is Ending Soon",
      body: "About a minute of balance remains. You can add time only if you confirm the cost.",
      href: `/reading/${data.readingId}`,
      dedupe: `ending:${data.readingId}`,
    });
    return { ok: true };
  });

export const confirmExtension = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string; minutes: number; token: string }) => ({
    readingId: clip(input.readingId, 64),
    minutes: Number(input.minutes),
    token: clip(input.token, 80),
  }))
  .handler(async ({ context, data }) => {
    const quote = extensionQuote(data.minutes, 1);
    if (!quote || data.token.length < 8) throw new Error("Choose a listed extension.");
    const sql = await getSql();
    const flags = await flagsFor(sql);
    const mem = await membershipOf(sql, context.userId);
    const decisionPreview = extensionDecision({
      enabled: flags.extensions,
      member: mem.allowed,
      live: true,
      balance: 0,
      cost: 1,
      duplicate: false,
    });
    if (!flags.extensions) {
      return { charged: false, reason: "Paid extensions stay off until billing checks pass. Nothing was charged.", coins: 0 };
    }
    if (!mem.allowed) return { charged: false, reason: "locked", coins: 0 };
    void decisionPreview;
    const settings = await loadSettings();
    return withSqlTransaction(async (tx) => {
      const [existing] = await tx<{ status: string; coins: number; minutes: number; seconds: number }>`
        select status, coins, minutes, seconds from ora_reading_extensions
        where reading_id = ${data.readingId} and token = ${data.token}
      `;
      if (existing) {
        return {
          charged: existing.status === "authorized",
          reason: existing.status === "authorized" ? "already" : existing.status,
          coins: existing.status === "authorized" ? existing.coins : 0,
          minutes: existing.minutes,
        };
      }
      const [reading] = await tx<{
        id: string;
        client_id: string;
        status: string;
        rate_coins: number;
        coins_spent: number;
      }>`
        select id, client_id, status, rate_coins, coins_spent
        from ora_readings where id = ${data.readingId} for update
      `;
      const [wallet] = await tx<{ coins: number; promo_coins: number }>`
        select coins, coalesce(promo_coins, 0) as promo_coins from ora_wallets where user_id = ${context.userId} for update
      `;
      const priced = extensionQuote(data.minutes, reading?.rate_coins || 0);
      const decision = extensionDecision({
        enabled: true,
        member: mem.allowed,
        live: Boolean(reading && reading.client_id === context.userId && reading.status === "live"),
        balance: Number(wallet?.coins || 0),
        cost: priced?.coins || 0,
        duplicate: false,
      });
      if (!decision.charge || !priced || !reading) {
        const reason =
          decision.reason === "balance"
            ? "Not enough coins for that extension. Nothing was charged."
            : decision.reason === "ended"
              ? "This sitting has ended. Nothing was charged."
              : "The extension was not authorized. Nothing was charged.";
        return { charged: false, reason, coins: 0, cost: priced?.coins || 0 };
      }
      const fromPromo = Math.min(Number(wallet?.promo_coins || 0), priced.coins);
      const nextCoins = Number(reading.coins_spent) + priced.coins;
      const split = splitCoins(nextCoins, settings.platformShare);
      const walletUpdated = await tx<{ user_id: string }>`
        update ora_wallets
        set coins = coins - ${priced.coins},
            promo_coins = greatest(0, promo_coins - ${fromPromo})
        where user_id = ${context.userId} and coins >= ${priced.coins}
        returning user_id
      `;
      if (!walletUpdated.length) return { charged: false, reason: "Not enough coins. Nothing was charged.", coins: 0 };
      const readingUpdated = await tx<{ id: string }>`
        update ora_readings
        set coins_spent = ${nextCoins},
            advisor_earned = ${split.advisorEarned},
            platform_fee = ${split.platformFee},
            time_credit_seconds = coalesce(time_credit_seconds, 0) + ${priced.seconds}
        where id = ${reading.id} and status = 'live' and client_id = ${context.userId}
        returning id
      `;
      if (!readingUpdated.length) throw new Error("The sitting changed before the extension could be saved.");
      await tx`
        insert into ora_reading_extensions (id, reading_id, client_id, token, minutes, coins, seconds, status)
        values (${rid("ext")}, ${reading.id}, ${context.userId}, ${data.token}, ${priced.minutes}, ${priced.coins}, ${priced.seconds}, 'authorized')
      `;
      await auditLog(context.userId, "reading_extension", "reading", reading.id, `${priced.minutes}m · ${priced.coins}c`);
      return { charged: true, reason: "ok", coins: priced.coins, minutes: priced.minutes, seconds: priced.seconds };
    });
  });

export async function releaseUnusedReadingCredit(readingId: string) {
  const settings = await loadSettings();
  await withSqlTransaction(async (tx) => {
    const [reading] = await tx<{
      id: string;
      client_id: string;
      rate_coins: number;
      coins_spent: number;
      time_credit_seconds: number;
    }>`
      select id, client_id, rate_coins, coins_spent, coalesce(time_credit_seconds, 0) as time_credit_seconds
      from ora_readings where id = ${readingId} for update
    `;
    if (!reading || Number(reading.time_credit_seconds) <= 0) return;
    const refund = Math.min(Number(reading.coins_spent), extensionRefundCoins(Number(reading.time_credit_seconds), reading.rate_coins));
    const nextCoins = Number(reading.coins_spent) - refund;
    const split = splitCoins(nextCoins, settings.platformShare);
    await tx`
      update ora_readings
      set time_credit_seconds = 0,
          coins_spent = ${nextCoins},
          advisor_earned = ${split.advisorEarned},
          platform_fee = ${split.platformFee}
      where id = ${reading.id} and time_credit_seconds = ${reading.time_credit_seconds}
    `;
    if (refund > 0) {
      await tx`update ora_wallets set coins = coins + ${refund} where user_id = ${reading.client_id}`;
      await auditLog(reading.client_id, "reading_extension_refund", "reading", reading.id, `${refund}c unused`);
    }
  });
}

export const extensionStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string }) => ({ readingId: clip(input.readingId, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { requireApprovedAdvisor } = await import("./ora-advisor");
    const advisor = await requireApprovedAdvisor(context.userId).catch(() => null);
    const [reading] = await sql<{ client_id: string; advisor_id: string; time_credit_seconds: number }>`
      select client_id, advisor_id, coalesce(time_credit_seconds, 0) as time_credit_seconds
      from ora_readings where id = ${data.readingId}
    `;
    if (!reading) return null;
    if (reading.client_id !== context.userId && advisor?.id !== reading.advisor_id) return null;
    const rows = await sql<{ minutes: number; coins: number; status: string }>`
      select minutes, coins, status from ora_reading_extensions
      where reading_id = ${data.readingId} and status = 'authorized'
      order by created_at desc limit 5
    `;
    return { creditSeconds: Number(reading.time_credit_seconds) || 0, extensions: rows };
  });

function count(rows: { n: number }[] | undefined) {
  return Number(rows?.[0]?.n || 0);
}

export const adminPremiumBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "overview");
    const sql = await getSql();
    const flags = await flagsFor(sql);
    const queue = await queueSettings(sql);
    const content = await contentFor(sql);
    const [compatibility, tarot, vault, timeline, queueRows, picks, moods, highlights, moon, affirmations, extensions, badges] = await Promise.all([
      sql<{ n: number }>`select count(*)::int as n from ora_compatibility_reports`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_daily_tarot where revealed_at is not null`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_future_messages`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_relationship_events`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_waiting_queue where status in ('waiting', 'offered')`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_card_picks`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_mood_checkins`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_reading_highlights`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_moon_views`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_affirmations`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_reading_extensions where status = 'authorized'`.catch(() => [{ n: 0 }]),
      sql<{ n: number }>`select count(*)::int as n from ora_customer_badges`.catch(() => [{ n: 0 }]),
    ]);
    const reported = await sql<{ reading_id: string; insights: string; advisor_name: string }>`
      select h.reading_id, h.insights, a.name as advisor_name
      from ora_reading_highlights h
      join ora_advisors a on a.id = h.advisor_id
      where h.reported = true and h.status <> 'hidden'
      order by h.created_at desc limit 20
    `.catch(() => []);
    const vaultRows = await sql<{ id: string; body: string; status: string; advisor_name: string; customer: string }>`
      select m.id, m.body, m.status, a.name as advisor_name, coalesce(p.display_name, 'Client') as customer
      from ora_future_messages m
      join ora_advisors a on a.id = m.advisor_id
      left join ora_profiles p on p.user_id = m.customer_id
      where m.hidden = false
      order by m.created_at desc limit 30
    `.catch(() => []);
    return {
      flags,
      queue,
      cards: TAROT.map((card) => ({ id: card.id, name: card.name })),
      moods: [...MOODS],
      phases: ["new", "waxing-crescent", "first-quarter", "waxing-gibbous", "full", "waning-gibbous", "last-quarter", "waning-crescent"] as MoonPhaseId[],
      content,
      usage: {
        compatibility: count(compatibility),
        tarot: count(tarot),
        vault: count(vault),
        timeline: count(timeline),
        queue: count(queueRows),
        picks: count(picks),
        moods: count(moods),
        highlights: count(highlights),
        moon: count(moon),
        affirmations: count(affirmations),
        extensions: count(extensions),
        badges: count(badges),
      },
      reported: reported.map((row) => ({ readingId: row.reading_id, advisorName: row.advisor_name, insights: parseInsights(row.insights) })),
      vault: vaultRows.map((row) => ({ id: row.id, body: row.body, status: row.status, advisorName: row.advisor_name, customer: row.customer })),
    };
  });

export const adminSavePremium = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    flags?: Partial<PremiumFlags>;
    queue?: { enabled?: boolean; maxLength?: number; inviteSeconds?: number };
    tarot?: { id: string; meaning?: string; love?: string; career?: string; reflection?: string; guidance?: string };
    mood?: { id: string; message?: string; exercise?: string };
    moon?: { id: string; theme?: string; prompt?: string; journal?: string; affirmation?: string };
    hideVaultId?: string;
    hideHighlightId?: string;
  }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    const sql = await getSql();
    if (data.flags) {
      const current = await flagsFor(sql);
      const next = { ...current };
      for (const key of Object.keys(current) as PremiumFlag[]) {
        if (typeof data.flags[key] === "boolean") next[key] = Boolean(data.flags[key]);
      }
      await writeJson(sql, "premiumFlags", next);
      await auditLog(context.userId, "premium_flags", "settings", "premiumFlags", JSON.stringify(next));
    }
    if (data.queue) {
      const current = await queueSettings(sql);
      const next = {
        enabled: typeof data.queue.enabled === "boolean" ? data.queue.enabled : current.enabled,
        maxLength: data.queue.maxLength ? Math.min(50, Math.max(1, Math.floor(data.queue.maxLength))) : current.maxLength,
        inviteSeconds: data.queue.inviteSeconds ? Math.min(180, Math.max(20, Math.floor(data.queue.inviteSeconds))) : current.inviteSeconds,
      };
      await writeJson(sql, "premiumQueue", next);
      await auditLog(context.userId, "premium_queue", "settings", "premiumQueue", JSON.stringify(next));
    }
    if (data.tarot?.id || data.mood?.id || data.moon?.id) {
      const bag = await contentFor(sql);
      if (data.tarot?.id && TAROT.some((card) => card.id === data.tarot?.id)) {
        bag.tarot = bag.tarot || {};
        bag.tarot[data.tarot.id] = {
          meaning: clip(data.tarot.meaning, 500),
          love: clip(data.tarot.love, 500),
          career: clip(data.tarot.career, 500),
          reflection: clip(data.tarot.reflection, 500),
          guidance: clip(data.tarot.guidance, 500),
        };
      }
      if (data.mood?.id && MOODS.includes(data.mood.id as (typeof MOODS)[number])) {
        bag.moods = bag.moods || {};
        bag.moods[data.mood.id] = { message: clip(data.mood.message, 500), exercise: clip(data.mood.exercise, 500) };
      }
      if (data.moon?.id) {
        bag.moon = bag.moon || {};
        bag.moon[data.moon.id] = {
          theme: clip(data.moon.theme, 240),
          prompt: clip(data.moon.prompt, 240),
          journal: clip(data.moon.journal, 240),
          affirmation: clip(data.moon.affirmation, 240),
        };
      }
      await writeJson(sql, "premiumContent", bag);
      await auditLog(context.userId, "premium_content", "settings", "premiumContent", "updated");
    }
    if (data.hideVaultId) {
      await sql`update ora_future_messages set hidden = true where id = ${clip(data.hideVaultId, 64)}`;
      await auditLog(context.userId, "premium_hide_vault", "message", clip(data.hideVaultId, 64), "");
    }
    if (data.hideHighlightId) {
      await sql`update ora_reading_highlights set status = 'hidden' where reading_id = ${clip(data.hideHighlightId, 64)}`;
      await auditLog(context.userId, "premium_hide_highlight", "reading", clip(data.hideHighlightId, 64), "");
    }
    return { ok: true };
  });

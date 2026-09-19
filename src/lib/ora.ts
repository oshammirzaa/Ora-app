import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { advisorReply } from "@/lib/advisor-reply";
import { getSql } from "@/lib/db";
import { monthEndUtc, monthStartUtc, MONTHLY_RANK_INDEX_SQL, MONTHLY_RANK_TABLE_SQL, rankAdvisorsForMonth, TOP_RANK_LIMIT, type RankSession } from "@/lib/ora-rank";
import { adminDeniedMessage, adminGate, isPreviewOperatorEligible, readDesignatedOwnerEmail, shouldDesignateOwner } from "@/lib/ora-admin-auth";
import {
  PLATFORM_SHARE_MAX,
  PLATFORM_SHARE_PCT,
  splitCoins,
} from "@/lib/ora-split";

export const WEEKLY_SECONDS = 180;
export const WELCOME_SECONDS = 180;
export const SUB_PRICE_USD = 10;
export const COINS_PER_DOLLAR = 10;
export {
  ADVISOR_SHARE_PCT,
  PLATFORM_SHARE_MAX,
  PLATFORM_SHARE_PCT,
  splitCoins,
} from "@/lib/ora-split";
export const ADVISOR_SHARE = 20;
export const PLATFORM_SHARE = 80;
export const LOW_BALANCE_SECONDS = 60;
export const RATE_MIN = 8;
export const RATE_MAX = 80;

/** Published advisor rate or frozen session rate. Never invents 20c. */
export function parseRate(value: unknown): number | null {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < RATE_MIN || n > RATE_MAX) return null;
  return n;
}

/** Session/history rate: keep what was stored, including a real 20. */
export function frozenRate(value: unknown): number {
  const parsed = parseRate(value);
  if (parsed != null) return parsed;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Reject missing/invalid submitted rates instead of inventing 20. */
export function requireRate(value: unknown): number {
  const parsed = parseRate(value);
  if (parsed == null) throw new Error("Rate must be between 8 and 80 coins per minute.");
  return parsed;
}

export const COIN_PACKS = [
  { id: "500", coins: 500, usd: 50 },
  { id: "1000", coins: 1000, usd: 100 },
  { id: "2500", coins: 2500, usd: 250 },
  { id: "5000", coins: 5000, usd: 500 },
] as const;

export type Advisor = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  bio: string;
  experience: string;
  specialties: string;
  rateCoins: number;
  photoUrl: string;
  videoUrl: string;
  status: string;
  trusted: boolean;
  isNew: boolean;
  rating: number;
  reviews: number;
  legalName: string;
  languages: string;
  years: number;
  online: boolean;
  busy: boolean;
  payoutCoins: number;
  pendingCoins: number;
  monthlyRank: number | null;
  createdAt?: string;
};

export type Wallet = {
  coins: number;
  promoCoins: number;
  purchasedCoins: number;
  bonusSeconds: number;
  weeklySeconds: number;
  subscribed: boolean;
  membershipActive: boolean;
  membershipPlan: string;
  membershipCancelAtPeriodEnd: boolean;
  membershipRenewsAt: string;
  membershipRefreshAt: string;
  membershipSeconds: number;
};

export type Me = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  wallet: Wallet;
  advisorId?: string;
  pendingApplication?: boolean;
};

export type ChatMsg = {
  id: string;
  role: "client" | "advisor";
  body: string;
};

export function rid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export type SiteSettings = {
  name: string;
  logoUrl: string;
  supportEmail: string;
  currency: string;
  platformShare: number;
  welcomeSeconds: number;
  weeklySeconds: number;
  welcomeCoins: number;
  minPayoutCoins: number;
  payoutHoldHours: number;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  name: "Ora",
  logoUrl: "",
  supportEmail: "",
  currency: "USD",
  platformShare: PLATFORM_SHARE_PCT,
  welcomeSeconds: WELCOME_SECONDS,
  weeklySeconds: WEEKLY_SECONDS,
  welcomeCoins: 0,
  minPayoutCoins: 50,
  payoutHoldHours: 0,
};

let settingsMemo: { at: number; value: SiteSettings } | null = null;

export function invalidateSettings() {
  settingsMemo = null;
}

export async function loadSettings(): Promise<SiteSettings> {
  if (settingsMemo && Date.now() - settingsMemo.at < 60_000) return settingsMemo.value;
  try {
    const sql = await getSql();
    const [row] = await sql<{
      name: string;
      logo_url: string;
      support_email: string;
      currency: string;
      platform_share: number;
      welcome_seconds: number;
      weekly_seconds: number;
      welcome_coins: number;
      min_payout_coins: number;
      payout_hold_hours: number;
    }>`
      select name, logo_url, support_email, currency, platform_share, welcome_seconds, weekly_seconds, welcome_coins,
             min_payout_coins, payout_hold_hours
      from ora_settings where id = 'ora'
    `;
    const value: SiteSettings = row
      ? {
          name: row.name || "Ora",
          logoUrl: row.logo_url || "",
          supportEmail: row.support_email || "",
          currency: row.currency || "USD",
          platformShare: Math.min(PLATFORM_SHARE_MAX, Math.max(0, Number(row.platform_share) || PLATFORM_SHARE_PCT)),
          welcomeSeconds: Math.min(1800, Math.max(0, Number(row.welcome_seconds) || WELCOME_SECONDS)),
          weeklySeconds: Math.min(1800, Math.max(0, Number(row.weekly_seconds) || WEEKLY_SECONDS)),
          welcomeCoins: Math.min(500, Math.max(0, Number(row.welcome_coins) || 0)),
          minPayoutCoins: Math.min(5000, Math.max(1, Number(row.min_payout_coins) || 50)),
          payoutHoldHours: Math.min(168, Math.max(0, Number(row.payout_hold_hours) || 0)),
        }
      : DEFAULT_SETTINGS;
    settingsMemo = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const getPublicSettings = createServerFn({ method: "GET" }).handler(() => loadSettings());

export type Category = { id: string; name: string; slug: string; sortOrder: number; active: boolean };

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat_love", name: "Love", slug: "love", sortOrder: 1, active: true },
  { id: "cat_career", name: "Career", slug: "career", sortOrder: 2, active: true },
  { id: "cat_grief", name: "Grief", slug: "grief", sortOrder: 3, active: true },
  { id: "cat_astro", name: "Astrology", slug: "astrology", sortOrder: 4, active: true },
  { id: "cat_medium", name: "Medium", slug: "medium", sortOrder: 5, active: true },
];

let categoriesMemo: { at: number; activeOnly: boolean; value: Category[] } | null = null;

export function invalidateCategories() {
  categoriesMemo = null;
}

export async function loadCategories(activeOnly = true): Promise<Category[]> {
  if (categoriesMemo && categoriesMemo.activeOnly === activeOnly && Date.now() - categoriesMemo.at < 60_000) {
    return categoriesMemo.value;
  }
  try {
    const sql = await getSql();
    const rows = activeOnly
      ? await sql<{ id: string; name: string; slug: string; sort_order: number; active: boolean }>`
          select id, name, slug, sort_order, active from ora_categories where active = true
          order by sort_order asc, name
        `
      : await sql<{ id: string; name: string; slug: string; sort_order: number; active: boolean }>`
          select id, name, slug, sort_order, active from ora_categories
          order by sort_order asc, name
        `;
    const value = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      sortOrder: Number(r.sort_order),
      active: Boolean(r.active),
    }));
    categoriesMemo = { at: Date.now(), activeOnly, value };
    return value;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export const listCategories = createServerFn({ method: "GET" }).handler(() => loadCategories(true));

export async function auditLog(
  actorId: string,
  event: string,
  targetType = "",
  targetId = "",
  detail = "",
) {
  const sql = await getSql();
  const id = rid("aud");
  await sql.query(
    "insert into ora_owner_log (id, actor_id, act, target_type, target_id, body) values ($1, $2, $3, $4, $5, $6)",
    [id, actorId, event, targetType, targetId, detail],
  );
}

export async function assertActive(userId: string) {
  const sql = await getSql();
  try {
    const [p] = await sql<{ status: string }>`select status from ora_profiles where user_id = ${userId}`;
    if (p?.status === "suspended") throw new Error("This account is suspended.");
  } catch (e) {
    if (e instanceof Error && e.message.includes("suspended")) throw e;
  }
}

export async function closeReadingById(id: string) {
  await settleReading(id);
  const sql = await getSql();
  const [row] = await sql<{ client_id: string }>`select client_id from ora_readings where id = ${id}`;
  await sql`
    update ora_readings set status = 'ended', ended_at = coalesce(ended_at, now())
    where id = ${id} and status = 'live'
  `;
  if (row) await logReadingOnce(row.client_id, id);
  scheduleRankRefresh();
  await syncReadingActivitySafe(id);
}

export function mapAdvisor(r: Record<string, unknown>): Advisor {
  return {
    id: String(r.id),
    userId: String(r.user_id ?? ""),
    name: String(r.name ?? ""),
    slug: String(r.slug ?? ""),
    bio: String(r.bio ?? ""),
    experience: String(r.experience ?? ""),
    specialties: String(r.specialties ?? ""),
    rateCoins: parseRate(r.rate_coins) ?? parseRate((r as { rateCoins?: unknown }).rateCoins) ?? 0,
    photoUrl: String(r.photo_url ?? ""),
    videoUrl: String(r.video_url ?? ""),
    status: String(r.status ?? "live"),
    trusted: Boolean(r.trusted),
    isNew: Boolean(r.is_new),
    rating: Number(r.rating ?? 4.8),
    reviews: Number(r.reviews ?? 0),
    legalName: String(r.legal_name ?? ""),
    languages: String(r.languages ?? "English"),
    years: Number(r.years ?? 0),
    online: Boolean(r.online),
    busy: Boolean(r.busy),
    payoutCoins: Number(r.payout_coins ?? 0),
    pendingCoins: Number(r.pending_coins ?? 0),
    monthlyRank: (() => {
      const n = Number((r as { monthly_rank?: unknown }).monthly_rank ?? (r as { monthlyRank?: unknown }).monthlyRank);
      return Number.isFinite(n) && n >= 1 && n <= TOP_RANK_LIMIT ? Math.floor(n) : null;
    })(),
    createdAt: String(r.created_at ?? (r as { createdAt?: unknown }).createdAt ?? ""),
  };
}

let rankRefreshAt = 0;
let rankRefreshInflight: Promise<void> | null = null;

function isTestClient(clientId: string) {
  return clientId.startsWith("qa:") || clientId.startsWith("test:");
}

export async function ensureMonthlyRankTable() {
  const sql = await getSql();
  await sql.query(MONTHLY_RANK_TABLE_SQL);
  try {
    await sql.query(MONTHLY_RANK_INDEX_SQL);
  } catch {
    // Table is enough; index is optional.
  }
}

export async function refreshMonthlyRanks(at = Date.now()) {
  const sql = await getSql();
  await ensureMonthlyRankTable();
  const month = monthStartUtc(at);
  const end = monthEndUtc(month);
  const rows = await sql<{
    id: string;
    client_id: string;
    advisor_id: string;
    started_at: string;
    seconds: number;
    coins_spent: number;
    bonus_used: number;
    weekly_used: number;
    status: string;
  }>`
    select id, client_id, advisor_id, started_at, seconds, coins_spent, bonus_used, weekly_used, status
    from ora_readings
    where started_at >= ${month}::timestamptz
      and started_at < ${end}::timestamptz
  `;
  const sessions: RankSession[] = rows.map((r) => ({
    id: String(r.id),
    clientId: String(r.client_id),
    advisorId: String(r.advisor_id),
    startedAt: new Date(r.started_at).getTime(),
    seconds: Number(r.seconds) || 0,
    coinsSpent: Number(r.coins_spent) || 0,
    bonusUsed: Number(r.bonus_used) || 0,
    weeklyUsed: Number(r.weekly_used) || 0,
    status: String(r.status),
    test: isTestClient(String(r.client_id)),
  }));
  const stats = rankAdvisorsForMonth(sessions);
  const byId = new Map(stats.map((s) => [s.advisorId, s]));
  const advisors = await sql<{ id: string }>`select id from ora_advisors`;
  for (const a of advisors) {
    const s = byId.get(a.id) ?? {
      advisorId: a.id,
      eligibleFreeClients: 0,
      convertedPaidClients: 0,
      conversionRate: 0,
      paidSessionRevenue: 0,
      eligible: false,
      rank: null,
    };
    await sql`
      insert into ora_monthly_rank (
        month, advisor_id, eligible_free_clients, converted_paid_clients,
        conversion_rate, paid_session_revenue, eligible, rank, created_at, updated_at, computed_at
      ) values (
        ${month}::date, ${a.id}, ${s.eligibleFreeClients}, ${s.convertedPaidClients},
        ${Number(s.conversionRate.toFixed(4))}, ${s.paidSessionRevenue}, ${s.eligible}, ${s.rank}, now(), now(), now()
      )
      on conflict (month, advisor_id) do update set
        eligible_free_clients = excluded.eligible_free_clients,
        converted_paid_clients = excluded.converted_paid_clients,
        conversion_rate = excluded.conversion_rate,
        paid_session_revenue = excluded.paid_session_revenue,
        eligible = excluded.eligible,
        rank = excluded.rank,
        updated_at = excluded.updated_at,
        computed_at = excluded.computed_at
    `;
  }
}

export async function maybeRefreshMonthlyRanks() {
  const now = Date.now();
  if (rankRefreshInflight) return rankRefreshInflight;
  if (now - rankRefreshAt < 60_000) return;
  rankRefreshInflight = refreshMonthlyRanks(now)
    .then(() => {
      rankRefreshAt = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      rankRefreshInflight = null;
    });
  return rankRefreshInflight;
}

export function scheduleRankRefresh() {
  if (rankRefreshInflight) return;
  rankRefreshInflight = refreshMonthlyRanks()
    .then(() => {
      rankRefreshAt = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      rankRefreshInflight = null;
    });
}

export function sameMessages(a: ChatMsg[] | null | undefined, b: ChatMsg[] | null | undefined) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || left.id !== right.id || left.body !== right.body) return false;
  }
  return true;
}

export function normalizeMessages(list: Array<ChatMsg | null | undefined> | null | undefined): ChatMsg[] {
  if (!Array.isArray(list)) return [];
  const out: ChatMsg[] = [];
  const seen = new Set<string>();
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      role: row.role === "advisor" ? "advisor" : "client",
      body: String(row.body ?? ""),
    });
  }
  return out;
}

export function mergeMessages(current: ChatMsg[] | null | undefined, extra: Array<ChatMsg | null | undefined>) {
  return normalizeMessages([...(Array.isArray(current) ? current : []), ...extra]);
}

async function syncReadingActivitySafe(readingId: string) {
  try {
    const { syncReadingActivity } = await import("./ora-advisor");
    await syncReadingActivity(readingId);
  } catch (e) {
    console.error("[ora] reading activity", e);
  }
}


export function isHouseAdvisor(userId: string) {
  return userId.startsWith("seed:");
}

export async function authName(userId: string) {
  const sql = await getSql();
  const [u] = await sql<{ name: string }>`select name from "user" where id = ${userId}`;
  return (u?.name || "Member").trim() || "Member";
}

export async function addLedger(
  userId: string,
  kind: string,
  amountCoins: number,
  seconds: number,
  note: string,
  refId = "",
) {
  const sql = await getSql();
  const id = rid("led");
  await sql`
    insert into ora_ledger (id, user_id, kind, amount_coins, seconds, note, ref_id)
    values (${id}, ${userId}, ${kind}, ${amountCoins}, ${seconds}, ${note}, ${refId})
  `;
}

export async function creditAdvisorEarning(
  advisorId: string,
  readingId: string,
  gross: number,
  fee: number,
  net: number,
) {
  if (net <= 0 && gross <= 0) return;
  const sql = await getSql();
  const [dup] = await sql<{ id: string }>`
    select id from ora_earnings where reading_id = ${readingId} limit 1
  `;
  if (dup) return;
  const settings = await loadSettings();
  const hold = settings.payoutHoldHours;
  const id = rid("ern");
  const availableAt = new Date(Date.now() + hold * 3600_000).toISOString();
  const status = hold <= 0 ? "available" : "pending";
  try {
    await sql`
      insert into ora_earnings (id, advisor_id, reading_id, gross_coins, commission_coins, net_coins, status, available_at)
      values (${id}, ${advisorId}, ${readingId}, ${gross}, ${fee}, ${net}, ${status}, ${availableAt})
    `;
  } catch {
    return;
  }
  if (net <= 0) return;
  if (status === "available") {
    await sql`update ora_advisors set payout_coins = payout_coins + ${net} where id = ${advisorId}`;
  } else {
    await sql`update ora_advisors set pending_coins = pending_coins + ${net} where id = ${advisorId}`;
  }
}

export async function settleAdvisorEarnings(advisorId: string) {
  const sql = await getSql();
  const due = await sql<{ id: string; net_coins: number }>`
    select id, net_coins from ora_earnings
    where advisor_id = ${advisorId} and status = 'pending' and available_at <= now()
  `;
  for (const row of due) {
    const net = Number(row.net_coins);
    const moved = await sql<{ id: string }>`
      update ora_earnings set status = 'available' where id = ${row.id} and status = 'pending' returning id
    `;
    if (!moved.length) continue;
    await sql`
      update ora_advisors
      set pending_coins = greatest(0, pending_coins - ${net}),
          payout_coins = payout_coins + ${net}
      where id = ${advisorId}
    `;
  }
}

const lastEarningsSettle = new Map<string, number>();

async function maybeSettleAdvisorEarnings(advisorId: string) {
  const at = lastEarningsSettle.get(advisorId) ?? 0;
  if (Date.now() - at < 30_000) return;
  lastEarningsSettle.set(advisorId, Date.now());
  await settleAdvisorEarnings(advisorId);
}

let lastRequestExpireAt = 0;

async function expireStaleRequests(advisorId: string) {
  if (Date.now() - lastRequestExpireAt < 20_000) return;
  lastRequestExpireAt = Date.now();
  const sql = await getSql();
  await sql`
    update ora_chat_requests set status = 'expired'
    where advisor_id = ${advisorId} and status = 'pending'
      and created_at < now() - interval '3 minutes'
  `;
}

async function logReadingOnce(userId: string, readingId: string) {
  const sql = await getSql();
  const [dup] = await sql<{ id: string }>`
    select id from ora_ledger where user_id = ${userId} and ref_id = ${readingId} and kind = 'reading' limit 1
  `;
  if (dup) {
    await sql`update ora_advisors set busy = false where id = (select advisor_id from ora_readings where id = ${readingId})`;
    return;
  }
  const [row] = await sql<{
    seconds: number;
    coins_spent: number;
    advisor_earned: number;
    platform_fee: number;
    advisor_id: string;
    client_id: string;
    rate_coins: number;
  }>`
    select seconds, coins_spent, advisor_earned, platform_fee, advisor_id, client_id, rate_coins
    from ora_readings where id = ${readingId}
  `;
  if (!row) return;
  const secs = Number(row.seconds);
  const coins = Number(row.coins_spent);
  const settings = await loadSettings();
  const split = splitCoins(coins, settings.platformShare);
  const earned = Number(row.advisor_earned) || split.advisorEarned;
  const fee = Number(row.platform_fee) || split.platformFee;
  if (earned !== Number(row.advisor_earned) || fee !== Number(row.platform_fee)) {
    await sql`
      update ora_readings set advisor_earned = ${earned}, platform_fee = ${fee} where id = ${readingId}
    `;
  }
  if (secs > 0 || coins > 0) {
    const rate = frozenRate(row.rate_coins);
    await addLedger(
      row.client_id,
      "reading",
      -coins,
      secs,
      `Reading · ${formatClock(secs)} · ${rate}c/min · ${coins}c`,
      readingId,
    );
    if (earned > 0) {
      await creditAdvisorEarning(row.advisor_id, readingId, coins, fee, earned);
    }
    if (fee > 0) {
      const [plat] = await sql<{ id: string }>`
        select id from ora_platform_ledger where reading_id = ${readingId} limit 1
      `;
      if (!plat) {
        const pid = rid("plat");
        await sql`
          insert into ora_platform_ledger (id, reading_id, coins)
          values (${pid}, ${readingId}, ${fee})
        `;
      }
    }
  }
  await sql`update ora_advisors set busy = false where id = ${row.advisor_id}`;
}

export type AdminRole = "owner" | "admin";

export async function grantAdmin(userId: string, byUserId: string, role: AdminRole = "admin") {
  const sql = await getSql();
  const [p] = await sql<{ email: string }>`select email from ora_profiles where user_id = ${userId}`;
  await sql`update ora_profiles set role = 'admin' where user_id = ${userId}`;
  await sql`
    insert into ora_admins (user_id, email, role, permissions, created_by)
    values (${userId}, ${p?.email || ""}, ${role}, '*', ${byUserId})
    on conflict (user_id) do update
      set email = excluded.email,
          role = excluded.role
  `;
}

export async function revokeAdmin(userId: string) {
  const sql = await getSql();
  await sql`delete from ora_admins where user_id = ${userId}`;
  await sql`update ora_profiles set role = 'client' where user_id = ${userId} and role = 'admin'`;
}

function accountProviderIds(rows: Array<Record<string, unknown>>) {
  const ids: string[] = [];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase().replace(/_/g, "") === "providerid") ids.push(String(value || ""));
    }
  }
  return ids;
}

async function bindPreviewOperator(userId: string) {
  // Production (GROK_PROJECT_ID set) never auto-promotes. Preview only binds the
  // Grok operator identity — never a customer or psychic email/password account.
  if (process.env.GROK_PROJECT_ID) return;
  const sql = await getSql();
  let providers: Array<Record<string, unknown>> = [];
  try {
    providers = await sql`select "providerId" from account where "userId" = ${userId}`;
  } catch {
    providers = [];
  }
  let email = "";
  try {
    const [auth] = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
    email = auth?.email || "";
  } catch {
    email = "";
  }
  if (!isPreviewOperatorEligible(true, accountProviderIds(providers), email)) return;
  const [existing] = await sql<{ user_id: string }>`
    select user_id from ora_admins where user_id = ${userId}
  `;
  if (existing) return;
  await grantAdmin(userId, userId, "owner");
  try {
    await auditLog(userId, "preview_operator", "profile", userId, "Grok preview operator");
  } catch (e) {
    console.error("[ora] preview_operator audit failed", e);
  }
}

async function bindDesignatedOwner(userId: string) {
  const configured = readDesignatedOwnerEmail(typeof process === "undefined" ? undefined : process.env);
  const sql = await getSql();
  await sql`
    create table if not exists ora_admins (
      user_id text primary key,
      email text not null default '',
      role text not null default 'admin',
      permissions text not null default '*',
      created_at timestamptz not null default now(),
      created_by text not null default ''
    )
  `;
  let email = "";
  try {
    const [auth] = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
    email = auth?.email || "";
  } catch {
    email = "";
  }
  if (!email) {
    const [profile] = await sql<{ email: string }>`select email from ora_profiles where user_id = ${userId}`;
    email = profile?.email || "";
  }
  const [existing] = await sql<{ user_id: string }>`
    select user_id from ora_admins where user_id = ${userId}
  `;
  if (!shouldDesignateOwner({ configuredEmail: configured, userEmail: email, alreadyOnRoster: Boolean(existing) })) {
    return;
  }
  await grantAdmin(userId, userId, "owner");
  try {
    await auditLog(userId, "designate_owner", "profile", userId, "ORA_OWNER_EMAIL");
  } catch (e) {
    console.error("[ora] designate_owner audit failed", e);
  }
}

export async function ensureAccount(userId: string, name: string) {
  const sql = await getSql();
  const [auth] = await sql<{ name: string; email: string }>`
    select name, email from "user" where id = ${userId}
  `;
  const display = (name || auth?.name || "Member").trim() || "Member";
  const email = (auth?.email || "").trim();
  await sql`
    insert into ora_profiles (user_id, display_name, role, email)
    values (${userId}, ${display}, 'client', ${email})
    on conflict (user_id) do nothing
  `;
  if (display && display !== "Member") {
    await sql`
      update ora_profiles set display_name = ${display}
      where user_id = ${userId} and (display_name = '' or display_name = 'Member')
    `;
  }
  if (email) {
    await sql`update ora_profiles set email = ${email} where user_id = ${userId} and email = ''`;
  }
  const [wallet] = await sql<{ user_id: string }>`select user_id from ora_wallets where user_id = ${userId}`;
  if (!wallet) {
    const settings = await loadSettings();
    await sql`
      insert into ora_wallets (user_id, coins, promo_coins, bonus_seconds, weekly_seconds, subscribed)
      values (${userId}, ${settings.welcomeCoins}, ${settings.welcomeCoins}, ${settings.welcomeSeconds}, 0, false)
    `;
    await addLedger(userId, "welcome", settings.welcomeCoins, settings.welcomeSeconds, "First login · welcome minutes");
    if (settings.welcomeCoins > 0) {
      await addLedger(userId, "promo", settings.welcomeCoins, 0, `Welcome coins · ${settings.welcomeCoins}c`);
    }
  }
  const settings = await loadSettings();
  await sql`
    update ora_wallets
    set weekly_seconds = ${settings.weeklySeconds}, week_started_at = now()
    where user_id = ${userId}
      and subscribed = true
      and (week_started_at is null or week_started_at < now() - interval '7 days')
  `;
  await bindDesignatedOwner(userId);
  try {
    const mem = await import("@/lib/ora-membership");
    await mem.ensureMembershipSchema();
    await mem.refreshMembershipState(userId);
  } catch {
    /* membership columns unavailable */
  }
}

export async function loadMe(userId: string): Promise<Me> {
  const name = await authName(userId);
  await ensureAccount(userId, name);
  const sql = await getSql();
  const [profile] = await sql<{ user_id: string; display_name: string; role: string; email: string; status: string }>`
    select user_id, display_name, role, email, status from ora_profiles where user_id = ${userId}
  `;
  const [wallet] = await sql<{
    coins: number;
    promo_coins: number;
    bonus_seconds: number;
    weekly_seconds: number;
    subscribed: boolean;
    membership_active?: boolean;
    membership_cancel_at_period_end?: boolean;
    membership_renews_at?: string | null;
    membership_refresh_at?: string | null;
    membership_seconds?: number;
    membership_plan?: string | null;
  }>`
    select coins, promo_coins, bonus_seconds, weekly_seconds, subscribed,
           membership_active, membership_cancel_at_period_end, membership_renews_at,
           membership_refresh_at, membership_seconds, membership_plan
    from ora_wallets where user_id = ${userId}
  `;
  const [adv] = await sql<{ id: string }>`
    select id from ora_advisors where user_id = ${userId} and status = 'live' limit 1
  `;
  const [app] = await sql<{ id: string }>`
    select id from ora_applications where user_id = ${userId} and status = 'pending' limit 1
  `;
  return {
    userId,
    displayName: profile?.display_name || name || "Member",
    email: profile?.email || "",
    role: profile?.role ?? "client",
    status: profile?.status ?? "active",
    wallet: mapWallet(wallet),
    advisorId: adv?.id,
    pendingApplication: Boolean(app),
  };
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadMe(context.userId));

export const listAdvisors = createServerFn({ method: "GET" }).handler(async () => {
  await ensureMonthlyRankTable();
  await maybeRefreshMonthlyRanks();
  const sql = await getSql();
  const month = monthStartUtc();
  const rows = await sql`
    select a.id, a.user_id, a.name, a.slug, a.specialties, a.rate_coins, a.photo_url, a.status, a.trusted,
           a.is_new, a.rating, a.reviews, a.online, a.busy, a.created_at, r.rank as monthly_rank
    from ora_advisors a
    left join ora_monthly_rank r on r.advisor_id = a.id and r.month = ${month}::date
    where a.status = 'live'
    order by r.rank asc nulls last, a.online desc, a.rating desc, a.name
  `;
  return rows.map(mapAdvisor);
});

export const isPreviewLayout = createServerFn({ method: "GET" }).handler(async () => {
  const { isWorkspacePreview } = await import("@/lib/env.server");
  return isWorkspacePreview();
});

export type FloorPresence = { id: string; online: boolean; busy: boolean };

export const listFloor = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{ id: string; online: boolean; busy: boolean }>`
    select id, online, busy from ora_advisors where status = 'live'
  `;
  return rows.map((r) => ({ id: r.id, online: Boolean(r.online), busy: Boolean(r.busy) })) satisfies FloorPresence[];
});

export const getAdvisor = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [row] = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where (id = ${data.id} or slug = ${data.id}) and status = 'live'
    `;
    return row ? mapAdvisor(row) : null;
  });

export const subscribe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureAccount(context.userId, await authName(context.userId));
    await assertActive(context.userId);
    const settings = await loadSettings();
    const sql = await getSql();
    await sql`
      update ora_wallets
      set subscribed = true,
          sub_started_at = now(),
          week_started_at = now(),
          weekly_seconds = ${settings.weeklySeconds}
      where user_id = ${context.userId}
    `;
    await addLedger(context.userId, "subscribe", 0, settings.weeklySeconds, `Weekly subscription · $${SUB_PRICE_USD}`);
    return loadMe(context.userId);
  });

export const buyCoins = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { packId: string }) => ({ packId: String(input.packId) }))
  .handler(async (): Promise<Me> => {
    throw new Error("Add funds opens checkout. Coins are credited only after the payment is verified.");
  });

async function walletCanPay(userId: string) {
  const sql = await getSql();
  const [wallet] = await sql<{ coins: number; bonus_seconds: number; weekly_seconds: number; membership_seconds?: number }>`
    select coins, bonus_seconds, weekly_seconds, membership_seconds from ora_wallets where user_id = ${userId}
  `;
  const included =
    Number(wallet?.bonus_seconds ?? 0) +
    Number(wallet?.weekly_seconds ?? 0) +
    Number((wallet as { membership_seconds?: number })?.membership_seconds ?? 0);
  return included > 0 || Number(wallet?.coins ?? 0) > 0;
}

async function advisorNotAcceptingChat(advisorId: string) {
  try {
    const sql = await getSql();
    const [row] = await sql<{ accepts_chat: boolean }>`
      select accepts_chat from ora_advisors where id = ${advisorId}
    `;
    return row ? row.accepts_chat === false : false;
  } catch {
    return false;
  }
}

async function advisorBlockedCustomer(advisorId: string, customerId: string) {
  try {
    const sql = await getSql();
    const [row] = await sql<{ n: number }>`
      select 1 as n from ora_advisor_blocks
      where advisor_id = ${advisorId} and customer_id = ${customerId}
      limit 1
    `;
    return Boolean(row);
  } catch {
    return false;
  }
}

async function advisorLiveGreeting(advisorId: string, name: string) {
  try {
    const sql = await getSql();
    const [row] = await sql<{ auto_live_greeting: string }>`
      select auto_live_greeting from ora_advisors where id = ${advisorId}
    `;
    const greet = String(row?.auto_live_greeting || "").trim();
    if (greet) return greet.slice(0, 400);
  } catch {
    /* column may not exist yet */
  }
  return `I'm ${name}. I'm with you now — tell me what you need.`;
}


async function snapshotAdvisorRate(advisorId: string, hinted?: unknown): Promise<number> {
  const sql = await getSql();
  const [row] = await sql<{ rate_coins: number }>`
    select rate_coins from ora_advisors where id = ${advisorId}
  `;
  const rate = parseRate(row?.rate_coins) ?? parseRate(hinted);
  if (!rate) throw new Error("This advisor has no rate set.");
  return rate;
}

async function openReading(
  clientId: string,
  adv: { id: string; name: string; user_id: string; rate_coins?: number },
  greet?: string,
) {
  const sql = await getSql();
  const rate = await snapshotAdvisorRate(adv.id, adv.rate_coins);
  if (!isHouseAdvisor(adv.user_id)) {
    const locked = await sql<{ id: string }>`
      update ora_advisors set busy = true where id = ${adv.id} and busy = false and online = true and status = 'live'
      returning id
    `;
    if (!locked.length) throw new Error("Advisor is in a session.");
  }
  const leftover = await sql<{ id: string }>`
    select id from ora_readings where client_id = ${clientId} and status = 'live'
  `;
  for (const row of leftover) {
    await closeReadingById(row.id);
  }
  const id = rid("read");
  await sql`
    insert into ora_readings (id, client_id, advisor_id, status, rate_coins, last_billed_at)
    values (${id}, ${clientId}, ${adv.id}, 'live', ${rate}, now())
  `;
  const mid = rid("msg");
  const body = greet ?? `I'm ${adv.name}. Your included minutes run first. Tell me what you want to know.`;
  await sql`
    insert into ora_messages (id, reading_id, role, body)
    values (${mid}, ${id}, 'advisor', ${body})
  `;
  return id;
}

export const applyAdvisor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    name: string;
    legalName?: string;
    bio: string;
    experience: string;
    specialties: string;
    rateCoins: number;
    photoUrl: string;
    videoUrl?: string;
    languages?: string;
    years?: number;
    email?: string;
    phone?: string;
    country?: string;
    availability?: string;
  }) => ({
    name: String(input.name).trim().slice(0, 80),
    legalName: String(input.legalName ?? "").trim().slice(0, 80),
    bio: String(input.bio).trim().slice(0, 1200),
    experience: String(input.experience).trim().slice(0, 800),
    specialties: String(input.specialties).trim().slice(0, 120),
    rateCoins: requireRate(input.rateCoins),
    photoUrl: String(input.photoUrl ?? "").startsWith("data:") ? "" : String(input.photoUrl ?? "").slice(0, 500),
    videoUrl: String(input.videoUrl ?? "").slice(0, 500),
    languages: String(input.languages ?? "English").trim().slice(0, 80) || "English",
    years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
    email: String(input.email ?? "").trim().toLowerCase().slice(0, 120),
    phone: String(input.phone ?? "").trim().slice(0, 40),
    country: String(input.country ?? "").trim().slice(0, 80),
    availability: String(input.availability ?? "").trim().slice(0, 400),
  }))
  .handler(async ({ context, data }) => {
    const { requiredApplicationError } = await import("./ora-advisor-auth");
    const { assertDeployedUsesNeon } = await import("./db");
    assertDeployedUsesNeon();
    const [auth] = await (await getSql())<{ email: string }>`select email from "user" where id = ${context.userId}`;
    const email = data.email || String(auth?.email || "").trim().toLowerCase();
    const missing = requiredApplicationError({
      legalName: data.legalName || data.name,
      name: data.name,
      email,
      phone: data.phone,
      country: data.country,
      bio: data.bio,
      specialties: data.specialties,
      years: data.years,
      rateCoins: data.rateCoins,
      availability: data.availability,
      photoUrl: data.photoUrl,
    });
    if (missing) throw new Error(missing);
    await ensureAccount(context.userId, data.legalName || data.name);
    const { insertPendingApplication } = await import("./ora-advisor");
    return insertPendingApplication({
      userId: context.userId,
      name: data.name,
      bio: data.bio,
      experience: data.experience,
      specialties: data.specialties,
      rateCoins: data.rateCoins,
      photoUrl: data.photoUrl,
      videoUrl: data.videoUrl,
      legalName: data.legalName,
      languages: data.languages,
      years: data.years,
      email,
      phone: data.phone,
      country: data.country,
      availability: data.availability,
    });
  });

export const startReading = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: String(input.advisorId).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await ensureAccount(context.userId, await authName(context.userId));
    await assertActive(context.userId);
    const sql = await getSql();
    const [adv] = await sql<{ id: string; name: string; user_id: string; online: boolean; busy: boolean; rate_coins: number; accepts_chat?: boolean }>`
      select id, name, user_id, online, busy, rate_coins from ora_advisors where id = ${data.advisorId} and status = 'live'
    `;
    if (!adv) throw new Error("Advisor not available.");
    if (!adv.online) throw new Error("This advisor is offline.");
    if (await advisorNotAcceptingChat(adv.id)) throw new Error("This advisor is not taking live chats right now.");
    if (await advisorBlockedCustomer(adv.id, context.userId)) throw new Error("This advisor is not available to you.");
    if (adv.busy && !isHouseAdvisor(adv.user_id)) throw new Error("Advisor is in a session. Try in a moment.");
    if (!(await walletCanPay(context.userId))) {
      throw new Error("Subscribe or add coins to start a reading.");
    }
    const id = await openReading(context.userId, adv, await advisorLiveGreeting(adv.id, adv.name));
    return { id };
  });

export const requestChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: String(input.advisorId).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await ensureAccount(context.userId, await authName(context.userId));
    await assertActive(context.userId);
    const sql = await getSql();
    const [adv] = await sql<{ id: string; name: string; user_id: string; online: boolean; busy: boolean; rate_coins: number }>`
      select id, name, user_id, online, busy, rate_coins from ora_advisors
      where (id = ${data.advisorId} or slug = ${data.advisorId}) and status = 'live'
    `;
    if (!adv) throw new Error("Advisor not available.");
    if (!adv.online) throw new Error("This advisor is offline.");
    if (await advisorNotAcceptingChat(adv.id)) throw new Error("This advisor is not taking live chats right now.");
    if (await advisorBlockedCustomer(adv.id, context.userId)) throw new Error("This advisor is not available to you.");
    if (adv.busy && !isHouseAdvisor(adv.user_id)) throw new Error("Advisor is in a session. Try in a moment.");
    if (!(await walletCanPay(context.userId))) {
      throw new Error("Subscribe or add coins to start a reading.");
    }
    if (isHouseAdvisor(adv.user_id)) {
      const id = await openReading(context.userId, adv, await advisorLiveGreeting(adv.id, adv.name));
      return { mode: "live" as const, id, requestId: "" };
    }
    await sql`
      update ora_chat_requests set status = 'expired'
      where client_id = ${context.userId} and status = 'pending'
    `;
    const requestId = rid("req");
    await sql`
      insert into ora_chat_requests (id, client_id, advisor_id, status)
      values (${requestId}, ${context.userId}, ${adv.id}, 'pending')
    `;
    return { mode: "wait" as const, id: "", requestId };
  });

type WalletRow = {
  coins: number;
  promo_coins?: number;
  bonus_seconds: number;
  weekly_seconds: number;
  subscribed: boolean;
  membership_active?: boolean;
  membership_cancel_at_period_end?: boolean;
  membership_renews_at?: string | Date | null;
  membership_refresh_at?: string | Date | null;
  membership_seconds?: number;
  membership_plan?: string | null;
};

function mapWallet(row: WalletRow | undefined | null): Wallet {
  const coins = Number(row?.coins ?? 0);
  const promo = Math.min(coins, Math.max(0, Number(row?.promo_coins ?? 0)));
  const active = Boolean(row?.membership_active);
  const rawPlan = String(row?.membership_plan || "");
  const membershipPlan = rawPlan === "mini" || rawPlan === "membership" ? rawPlan : active ? "membership" : "";
  return {
    coins,
    promoCoins: promo,
    purchasedCoins: Math.max(0, coins - promo),
    bonusSeconds: Number(row?.bonus_seconds ?? 0),
    weeklySeconds: Number(row?.weekly_seconds ?? 0),
    subscribed: Boolean(row?.subscribed),
    membershipActive: active,
    membershipPlan,
    membershipCancelAtPeriodEnd: Boolean(row?.membership_cancel_at_period_end),
    membershipRenewsAt: row?.membership_renews_at ? String(row.membership_renews_at) : "",
    membershipRefreshAt: row?.membership_refresh_at ? String(row.membership_refresh_at) : "",
    membershipSeconds: Math.max(0, Number(row?.membership_seconds ?? 0)),
  };
}

export function affordableSeconds(wallet: Wallet, rate: number) {
  const inc = includedSeconds(wallet);
  const r = Math.max(1, frozenRate(rate));
  return inc + Math.floor((Math.max(0, wallet.coins) * 60) / r);
}

function settleSpend(
  wallet: WalletRow,
  rate: number,
  current: { seconds: number; bonus_used: number; weekly_used: number; coins_spent: number },
  addSeconds: number,
) {
  const rateN = Math.max(1, rate);
  let left = Math.max(0, Math.floor(addSeconds));
  const take = (pool: number) => {
    const n = Math.min(Math.max(0, pool), left);
    left -= n;
    return n;
  };
  const bonus = take(Number(wallet.bonus_seconds));
  const membership = take(Number(wallet.membership_seconds ?? 0));
  const weekly = take(Number(wallet.weekly_seconds));
  const paidAlready = Math.max(
    0,
    Number(current.seconds) - Number(current.bonus_used) - Number(current.weekly_used),
  );
  const coinsAlready = Number(current.coins_spent);
  const coinsWallet = Math.max(0, Number(wallet.coins));
  const maxCoinsTotal = coinsAlready + coinsWallet;
  const maxPaidSeconds = maxCoinsTotal <= 0 ? 0 : Math.floor(((maxCoinsTotal + 1) * 60 - 1) / rateN);
  const desiredPaid = paidAlready + left;
  const newPaid = Math.min(desiredPaid, Math.max(paidAlready, maxPaidSeconds));
  const newCoinsTarget = Math.floor((newPaid * rateN) / 60);
  const coins = Math.max(0, Math.min(coinsWallet, newCoinsTarget - coinsAlready));
  const additionalPaid = Math.max(0, newPaid - paidAlready);
  const used = bonus + membership + weekly + additionalPaid;
  const dry = newPaid < desiredPaid;
  return { bonus, membership, weekly, coins, used, ok: used > 0, dry };
}

type ReadingRow = {
  id: string;
  client_id: string;
  advisor_id: string;
  seconds: number;
  coins_spent: number;
  bonus_used: number;
  weekly_used: number;
  status: string;
  rate_coins: number;
  advisor_earned: number;
  platform_fee: number;
  started_at: string;
  ended_at: string | null;
};

export type ReadingBill = {
  id: string;
  seconds: number;
  status: "live" | "ended";
  coinsSpent: number;
  rateCoins: number;
  advisorEarned: number;
  platformFee: number;
  remainingSeconds: number;
  lowBalance: boolean;
  wallet: Wallet | null;
  startedAt: string;
  endedAt: string | null;
};

function billFrom(reading: ReadingRow, wallet: Wallet | null): ReadingBill {
  const rate = frozenRate(reading.rate_coins);
  const status = reading.status === "ended" ? ("ended" as const) : ("live" as const);
  const remaining = status === "live" && wallet ? affordableSeconds(wallet, rate) : 0;
  return {
    id: String(reading.id ?? ""),
    seconds: Number(reading.seconds) || 0,
    status,
    coinsSpent: Number(reading.coins_spent) || 0,
    rateCoins: rate,
    advisorEarned: Number(reading.advisor_earned) || 0,
    platformFee: Number(reading.platform_fee) || 0,
    remainingSeconds: Number.isFinite(remaining) ? remaining : 0,
    lowBalance: status === "live" && remaining > 0 && remaining <= LOW_BALANCE_SECONDS,
    wallet,
    startedAt: reading.started_at ? String(reading.started_at) : "",
    endedAt: reading.ended_at ? String(reading.ended_at) : null,
  };
}

async function loadReadingRow(id: string) {
  const sql = await getSql();
  const [row] = await sql<ReadingRow>`
    select id, client_id, advisor_id, seconds, coins_spent, bonus_used, weekly_used, status,
           rate_coins, advisor_earned, platform_fee, started_at, ended_at
    from ora_readings where id = ${id}
  `;
  return row ?? null;
}

async function settleReading(readingId: string): Promise<ReadingBill | null> {
  const sql = await getSql();
  const reading = await loadReadingRow(readingId);
  if (!reading) return null;
  const [walletRow] = await sql<WalletRow>`
    select coins, promo_coins, bonus_seconds, weekly_seconds, subscribed,
           membership_active, membership_seconds
    from ora_wallets where user_id = ${reading.client_id}
  `;
  const wallet = mapWallet(walletRow);
  if (reading.status !== "live") return billFrom(reading, wallet);

  const started = new Date(reading.started_at).getTime();
  if (!Number.isFinite(started)) return billFrom(reading, wallet);
  const target = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const billed = Number(reading.seconds);
  const delta = target - billed;
  if (delta < 1) return billFrom(reading, wallet);
  if (!walletRow) {
    await sql`
      update ora_readings set status = 'ended', ended_at = now() where id = ${readingId} and status = 'live'
    `;
    await logReadingOnce(reading.client_id, readingId);
    scheduleRankRefresh();
    await syncReadingActivitySafe(readingId);
    const ended = await loadReadingRow(readingId);
    return ended ? billFrom(ended, wallet) : null;
  }

  const rate = frozenRate(reading.rate_coins);
  const result = settleSpend(walletRow, rate, reading, delta);
  const nextSeconds = billed + result.used;
  const nextCoins = Number(reading.coins_spent) + result.coins;
  const nextBonus = Number(reading.bonus_used) + result.bonus;
  const nextWeekly = Number(reading.weekly_used) + result.weekly + result.membership;
  const settings = await loadSettings();
  const split = splitCoins(nextCoins, settings.platformShare);
  const ended = result.dry || !result.ok;
  const endedAt = ended ? new Date().toISOString() : null;

  const updated = await sql<{ id: string }>`
    update ora_readings
    set seconds = ${nextSeconds},
        coins_spent = ${nextCoins},
        bonus_used = ${nextBonus},
        weekly_used = ${nextWeekly},
        advisor_earned = ${split.advisorEarned},
        platform_fee = ${split.platformFee},
        last_billed_at = now(),
        status = ${ended ? "ended" : "live"},
        ended_at = ${endedAt}
    where id = ${readingId} and status = 'live' and seconds = ${billed}
    returning id
  `;
  if (!updated.length) {
    const again = await loadReadingRow(readingId);
    return again ? billFrom(again, wallet) : null;
  }

  const fromPromo = Math.min(Math.max(0, Number(walletRow.promo_coins ?? 0)), result.coins);
  await sql`
    update ora_wallets
    set coins = coins - ${result.coins},
        promo_coins = greatest(0, promo_coins - ${fromPromo}),
        bonus_seconds = bonus_seconds - ${result.bonus},
        weekly_seconds = weekly_seconds - ${result.weekly},
        membership_seconds = greatest(0, coalesce(membership_seconds, 0) - ${result.membership})
    where user_id = ${reading.client_id}
  `;
  if (ended) {
    await logReadingOnce(reading.client_id, readingId);
    scheduleRankRefresh();
    await syncReadingActivitySafe(readingId);
  }
  const fresh = await loadReadingRow(readingId);
  const [nextWallet] = await sql<WalletRow>`
    select coins, promo_coins, bonus_seconds, weekly_seconds, subscribed,
           membership_active, membership_cancel_at_period_end, membership_renews_at,
           membership_refresh_at, membership_seconds, membership_plan
    from ora_wallets where user_id = ${reading.client_id}
  `;
  return fresh ? billFrom(fresh, mapWallet(nextWallet)) : null;
}

export const tickReading = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; seconds?: number }) => ({
    id: String(input.id).slice(0, 64),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [row] = await sql<{ client_id: string; advisor_user: string }>`
      select r.client_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id}
    `;
    if (!row || (row.client_id !== context.userId && row.advisor_user !== context.userId)) {
      return null;
    }
    const bill = await settleReading(data.id);
    return bill;
  });

export const endReading = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [row] = await sql<{ id: string; client_id: string; advisor_id: string; advisor_user: string }>`
      select r.id, r.client_id, r.advisor_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id}
        and (r.client_id = ${context.userId} or a.user_id = ${context.userId})
    `;
    if (!row) return null;
    await closeReadingById(row.id);
    return settleReading(row.id);
  });

export const getReading = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [access] = await sql<{ client_id: string; advisor_user: string }>`
      select r.client_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id}
    `;
    if (!access || (access.client_id !== context.userId && access.advisor_user !== context.userId)) {
      return null;
    }
    const bill = await settleReading(data.id);
    if (!bill) return null;
    const row = await loadReadingRow(data.id);
    if (!row) return null;
    const [adv] = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where id = ${row.advisor_id}
    `;
    const [client] = await sql<{ display_name: string }>`
      select display_name from ora_profiles where user_id = ${row.client_id}
    `;
    const [rev] = await sql<{ id: string }>`
      select id from ora_reviews where reading_id = ${data.id} limit 1
    `;
    return {
      ...bill,
      clientName: client?.display_name || "Client",
      clientId: row.client_id,
      advisor: adv ? mapAdvisor(adv) : null,
      reviewed: Boolean(rev),
    };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [reading] = await sql<{ id: string }>`
      select r.id from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id} and (r.client_id = ${context.userId} or a.user_id = ${context.userId})
    `;
    if (!reading) return [] as ChatMsg[];
    const rows = await sql<{ id: string; role: string; body: string }>`
      select id, role, body from ora_messages where reading_id = ${data.id} order by created_at asc
    `;
    return rows.map((r) => ({
      id: String(r?.id ?? ""),
      role: r?.role === "advisor" ? ("advisor" as const) : ("client" as const),
      body: String(r?.body ?? ""),
    })).filter((m) => m.id);
  });

export const syncReading = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [row] = await sql<{ client_id: string; advisor_user: string }>`
      select r.client_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id}
    `;
    const empty = {
      status: "ended" as const,
      seconds: 0,
      coinsSpent: 0,
      rateCoins: 0,
      advisorEarned: 0,
      platformFee: 0,
      remainingSeconds: 0,
      lowBalance: false,
      wallet: null,
      startedAt: "",
      endedAt: null,
      id: data.id,
      messages: [] as ChatMsg[],
    };
    if (!row || (row.client_id !== context.userId && row.advisor_user !== context.userId)) {
      return null;
    }
    const bill = await settleReading(data.id);
    const msgs = await sql<{ id: string; role: string; body: string }>`
      select id, role, body from ora_messages where reading_id = ${data.id} order by created_at asc
    `;
    const messages = normalizeMessages(
      msgs.map((r) => ({
        id: String(r?.id ?? ""),
        role: r?.role === "advisor" ? ("advisor" as const) : ("client" as const),
        body: String(r?.body ?? ""),
      })),
    );
    if (!bill) {
      const reading = await loadReadingRow(data.id);
      return {
        ...empty,
        messages,
        seconds: Number(reading?.seconds) || 0,
        coinsSpent: Number(reading?.coins_spent) || 0,
        rateCoins: frozenRate(reading?.rate_coins),
        advisorEarned: Number(reading?.advisor_earned) || 0,
        platformFee: Number(reading?.platform_fee) || 0,
        status: reading?.status === "live" ? "live" : "ended",
      };
    }
    return { ...bill, messages };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({
    id: String(input.id).slice(0, 64),
    body: String(input.body).trim().slice(0, 800),
  }))
  .handler(async ({ context, data }) => {
    if (data.body.length < 1) throw new Error("Write something first.");
    const sql = await getSql();
    const [owned] = await sql<{ id: string }>`
      select id from ora_readings where id = ${data.id} and client_id = ${context.userId}
    `;
    if (!owned) throw new Error("This reading has ended.");
    const bill = await settleReading(data.id);
    if (!bill || bill.status !== "live") throw new Error("This reading has ended.");
    const [reading] = await sql<{ id: string; advisor_id: string; status: string }>`
      select id, advisor_id, status from ora_readings
      where id = ${data.id} and client_id = ${context.userId}
    `;
    if (!reading || reading.status !== "live") throw new Error("This reading has ended.");
    const [adv] = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where id = ${reading.advisor_id}
    `;
    if (!adv) throw new Error("Advisor not available.");
    const advisor = mapAdvisor(adv);
    const clientMsgId = rid("msg");
    await sql`
      insert into ora_messages (id, reading_id, role, body)
      values (${clientMsgId}, ${data.id}, 'client', ${data.body})
    `;
    if (!isHouseAdvisor(advisor.userId)) {
      return {
        client: { id: clientMsgId, role: "client" as const, body: data.body },
        advisor: null as ChatMsg | null,
      };
    }
    const prior = await sql<{ role: string; body: string }>`
      select role, body from ora_messages where reading_id = ${data.id} order by created_at asc
    `;
    const history = prior
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "advisor" ? ("advisor" as const) : ("client" as const),
        body: m.body,
      }));
    const reply = await advisorReply({
      name: advisor.name,
      bio: advisor.bio,
      specialties: advisor.specialties,
      experience: advisor.experience,
      history,
      question: data.body,
    });
    const advMsgId = rid("msg");
    await sql`
      insert into ora_messages (id, reading_id, role, body)
      values (${advMsgId}, ${data.id}, 'advisor', ${reply})
    `;
    return {
      client: { id: clientMsgId, role: "client" as const, body: data.body },
      advisor: { id: advMsgId, role: "advisor" as const, body: reply },
    };
  });

export const saveStudio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    bio: string;
    experience: string;
    specialties: string;
    rateCoins: number;
    photoUrl?: string;
    videoUrl: string;
  }) => ({
    bio: String(input.bio).trim().slice(0, 1200),
    experience: String(input.experience).trim().slice(0, 800),
    specialties: String(input.specialties).trim().slice(0, 120),
    rateCoins: requireRate(input.rateCoins),
    photoUrl: input.photoUrl ? String(input.photoUrl).slice(0, 400_000) : undefined,
    videoUrl: String(input.videoUrl ?? "").slice(0, 500),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.photoUrl) {
      await sql`
        update ora_advisors
        set bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, photo_url = ${data.photoUrl}, video_url = ${data.videoUrl}
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        update ora_advisors
        set bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, video_url = ${data.videoUrl}
        where user_id = ${context.userId}
      `;
    }
    return loadMe(context.userId);
  });

export const getStudio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [row] = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where user_id = ${context.userId}
    `;
    return row ? mapAdvisor(row) : null;
  });

export async function requireAdmin(userId: string, permission?: string) {
  await ensureAccount(userId, await authName(userId));
  await bindPreviewOperator(userId);
  await bindDesignatedOwner(userId);
  const sql = await getSql();
  const [me] = await sql<{ role: string; status: string }>`
    select role, status from ora_profiles where user_id = ${userId}
  `;
  const [admin] = await sql<{ role: string; permissions: string }>`
    select role, permissions from ora_admins where user_id = ${userId}
  `;
  const decision = adminGate({
    signedIn: true,
    profileStatus: me?.status,
    profileRole: me?.role,
    admin: admin ?? null,
    permission,
  });
  if (decision.ok) return;
  throw new Error(adminDeniedMessage(decision.reason));
}

type ApplicationRow = {
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
};

type WalletAdminRow = {
  user_id: string;
  display_name: string;
  role: string;
  coins: number;
  bonus_seconds: number;
  weekly_seconds: number;
  subscribed: boolean;
};

type ReadingAdminRow = {
  id: string;
  client_id: string;
  advisor_id: string;
  seconds: number;
  coins_spent: number;
  advisor_earned: number;
  platform_fee: number;
  rate_coins: number;
  status: string;
  started_at: string;
};

export const adminSnapshot = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureAccount(context.userId, await authName(context.userId));
    await requireAdmin(context.userId, "overview");
    const sql = await getSql();
    const applications = await sql<ApplicationRow>`
      select id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, status, created_at, legal_name, languages, years
      from ora_applications order by created_at desc limit 40
    `;
    const advisors = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors order by name
    `;
    const wallets = await sql<WalletAdminRow>`
      select w.user_id, p.display_name, p.role, w.coins, w.bonus_seconds, w.weekly_seconds, w.subscribed
      from ora_wallets w join ora_profiles p on p.user_id = w.user_id
      order by p.created_at desc limit 40
    `;
    const readings = await sql<ReadingAdminRow>`
      select id, client_id, advisor_id, seconds, coins_spent, advisor_earned, platform_fee, rate_coins, status, started_at
      from ora_readings order by started_at desc limit 30
    `;
    const [stats] = await sql<{ clients: number; pending: number; live: number; sessions: number; commission: number }>`
      select
        (select count(*)::int from ora_profiles) as clients,
        (select count(*)::int from ora_applications where status = 'pending') as pending,
        (select count(*)::int from ora_advisors where status = 'live') as live,
        (select count(*)::int from ora_readings) as sessions,
        (select coalesce(sum(platform_fee), 0)::int from ora_readings) as commission
    `;
    return {
      stats: {
        clients: Number(stats?.clients ?? 0),
        pending: Number(stats?.pending ?? 0),
        live: Number(stats?.live ?? 0),
        sessions: Number(stats?.sessions ?? 0),
        commission: Number(stats?.commission ?? 0),
      },
      applications: applications.map((a) => ({ ...a, created_at: String(a.created_at) })),
      advisors: advisors.map(mapAdvisor),
      wallets,
      readings: readings.map((r) => ({ ...r, started_at: String(r.started_at) })),
    };
  });

export const adminDecide = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; decision: "approved" | "declined" | "rejected" }) => ({
    id: String(input.id).slice(0, 64),
    decision: input.decision === "approved" ? ("approved" as const) : ("rejected" as const),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    try {
      const { ensureApplicationColumns } = await import("./ora-advisor");
      await ensureApplicationColumns();
    } catch {
      /* columns apply on next request */
    }
    const sql = await getSql();
    const [app] = await sql<{
      id: string;
      user_id: string;
      name: string;
      bio: string;
      experience: string;
      specialties: string;
      rate_coins: number;
      photo_url: string;
      video_url: string;
      legal_name: string;
      languages: string;
      years: number;
      status: string;
      email: string;
      phone: string;
      country: string;
      availability: string;
    }>`
      select id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, legal_name, languages, years,
             status, email, phone, country, availability
      from ora_applications where id = ${data.id}
    `.catch(async () => {
      const [row] = await sql<{
        id: string;
        user_id: string;
        name: string;
        bio: string;
        experience: string;
        specialties: string;
        rate_coins: number;
        photo_url: string;
        video_url: string;
        legal_name: string;
        languages: string;
        years: number;
        status: string;
      }>`
        select id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, legal_name, languages, years, status
        from ora_applications where id = ${data.id}
      `;
      return row
        ? [{ ...row, email: "", phone: "", country: "", availability: "" }]
        : [];
    });
    if (!app) throw new Error("Missing application");
    if (app.status !== "pending") throw new Error("This application was already reviewed.");
    if (data.decision === "approved") {
      const [existing] = await sql<{ id: string }>`
        select id from ora_advisors where user_id = ${app.user_id} limit 1
      `;
      const years = Math.min(60, Math.max(0, Math.floor(Number(app.years) || 0)));
      const rate = requireRate(app.rate_coins);
      const legal = String(app.legal_name ?? "");
      const languages = String(app.languages ?? "English") || "English";
      const [pe] = await sql<{ email: string }>`select email from ora_profiles where user_id = ${app.user_id}`;
      const email = String(app.email || pe?.email || "").trim();
      const phone = String(app.phone || "");
      const country = String(app.country || "");
      const availability = String(app.availability || "");
      if (existing) {
        try {
          await sql`
            update ora_advisors
            set name = ${app.name}, bio = ${app.bio}, experience = ${app.experience},
                specialties = ${app.specialties}, rate_coins = ${rate},
                photo_url = ${app.photo_url}, video_url = ${app.video_url}, status = 'live',
                legal_name = ${legal}, languages = ${languages}, years = ${years},
                is_new = true, email = ${email}, phone = ${phone}, country = ${country},
                availability = ${availability}, online = false, busy = false
            where id = ${existing.id}
          `;
        } catch (err) {
          console.error("[ora] approve advisor update (extra columns) failed", err);
          await sql`
            update ora_advisors
            set name = ${app.name}, bio = ${app.bio}, experience = ${app.experience},
                specialties = ${app.specialties}, rate_coins = ${rate},
                photo_url = ${app.photo_url}, video_url = ${app.video_url}, status = 'live',
                legal_name = ${legal}, languages = ${languages}, years = ${years},
                is_new = true, email = ${email}, online = false, busy = false
            where id = ${existing.id}
          `;
        }
      } else {
        const base = app.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "advisor";
        const advId = rid("adv");
        const uniqueSlug = `${base}-${advId.slice(-6)}`;
        try {
          await sql`
            insert into ora_advisors (id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, legal_name, languages, years, is_new, email, phone, country, availability, online, busy, rating, reviews)
            values (${advId}, ${app.user_id}, ${app.name}, ${uniqueSlug}, ${app.bio}, ${app.experience}, ${app.specialties}, ${rate}, ${app.photo_url}, ${app.video_url}, 'live', ${legal}, ${languages}, ${years}, true, ${email}, ${phone}, ${country}, ${availability}, false, false, 0, 0)
          `;
        } catch (err) {
          console.error("[ora] approve advisor insert (extra columns) failed", err);
          await sql`
            insert into ora_advisors (id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, legal_name, languages, years, is_new, email, online, busy)
            values (${advId}, ${app.user_id}, ${app.name}, ${uniqueSlug}, ${app.bio}, ${app.experience}, ${app.specialties}, ${rate}, ${app.photo_url}, ${app.video_url}, 'live', ${legal}, ${languages}, ${years}, true, ${email}, false, false)
          `;
        }
      }
      await sql`update ora_profiles set role = 'advisor', display_name = ${app.name} where user_id = ${app.user_id}`;
      if (email) {
        await sql`update ora_profiles set email = ${email} where user_id = ${app.user_id} and email = ''`;
      }
    }
    try {
      await sql`
        update ora_applications
        set status = ${data.decision}, decided_at = now(), decided_by = ${context.userId}
        where id = ${data.id}
      `;
    } catch (err) {
      console.error("[ora] application decision columns missing", err);
      await sql`update ora_applications set status = ${data.decision} where id = ${data.id}`;
    }
    await auditLog(
      context.userId,
      data.decision === "approved" ? "approve_advisor" : "reject_advisor",
      "application",
      data.id,
      app.name,
    );
    return { ok: true };
  });

export const adminSetAdvisor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: "live" | "paused" }) => ({
    id: String(input.id).slice(0, 64),
    status: input.status === "paused" ? ("paused" as const) : ("live" as const),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "advisors");
    const sql = await getSql();
    if (data.status === "paused") {
      await sql`update ora_advisors set status = 'paused', online = false, busy = false where id = ${data.id}`;
    } else {
      await sql`update ora_advisors set status = 'live' where id = ${data.id}`;
    }
    await auditLog(context.userId, "set_advisor_status", "advisor", data.id, data.status);
    return { ok: true };
  });

export const adminGift = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; coins: number }) => ({
    userId: String(input.userId).slice(0, 128),
    coins: Math.min(5000, Math.max(1, Math.floor(Number(input.coins) || 0))),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "finance");
    const sql = await getSql();
    await sql`update ora_wallets set coins = coins + ${data.coins}, promo_coins = promo_coins + ${data.coins} where user_id = ${data.userId}`;
    await addLedger(data.userId, "gift", data.coins, 0, `Owner gift · ${data.coins} coins`);
    await auditLog(context.userId, "gift_coins", "wallet", data.userId, `${data.coins}c`);
    return { ok: true };
  });

export function formatClock(total: number) {
  const n = Math.max(0, Math.floor(Number.isFinite(Number(total)) ? Number(total) : 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatMoney(cents: number, currency = "USD") {
  const n = Math.max(0, Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || "USD"}`;
  }
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function includedSeconds(w: Wallet | null | undefined) {
  return (
    Math.max(0, Number(w?.bonusSeconds) || 0) +
    Math.max(0, Number(w?.weeklySeconds) || 0) +
    Math.max(0, Number(w?.membershipSeconds) || 0)
  );
}

export type SessionRow = {
  id: string;
  advisorName: string;
  advisorSlug: string;
  photoUrl: string;
  seconds: number;
  coinsSpent: number;
  advisorEarned: number;
  platformFee: number;
  rateCoins: number;
  status: string;
  startedAt: string;
  endedAt: string;
  reviewed: boolean;
};

export type LedgerRow = {
  id: string;
  kind: string;
  amountCoins: number;
  seconds: number;
  note: string;
  createdAt: string;
};

export type PaymentHistoryRow = {
  id: string;
  coins: number;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  createdAt: string;
  paidAt: string;
};

export type FavoriteAdvisor = Advisor & { notifyWhenOnline: boolean };

export type Customer = {
  me: Me;
  sessions: SessionRow[];
  ledger: LedgerRow[];
  favorites: FavoriteAdvisor[];
  payments: PaymentHistoryRow[];
};

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await loadMe(context.userId);
    const { ensureFavoriteExtras } = await import("@/lib/ora-favorites");
    await ensureFavoriteExtras();
    const sql = await getSql();
    const sessions = await sql<{
      id: string;
      name: string;
      slug: string;
      photo_url: string;
      seconds: number;
      coins_spent: number;
      advisor_earned: number;
      platform_fee: number;
      rate_coins: number;
      status: string;
      started_at: string;
      ended_at: string | null;
      review_id: string | null;
    }>`
      select r.id, a.name, a.slug, a.photo_url, r.seconds, r.coins_spent, r.advisor_earned, r.platform_fee,
             r.rate_coins, r.status, r.started_at, r.ended_at, rv.id as review_id
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_reviews rv on rv.reading_id = r.id
      where r.client_id = ${context.userId}
      order by r.started_at desc
      limit 40
    `;
    const ledger = await sql<{
      id: string;
      kind: string;
      amount_coins: number;
      seconds: number;
      note: string;
      created_at: string;
    }>`
      select id, kind, amount_coins, seconds, note, created_at
      from ora_ledger where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    const favs = await sql`
      select a.id, a.user_id, a.name, a.slug, a.bio, a.experience, a.specialties, a.rate_coins,
             a.photo_url, a.video_url, a.status, a.trusted, a.is_new, a.rating, a.reviews,
             a.legal_name, a.languages, a.years, a.online, a.busy, a.payout_coins,
             coalesce(f.notify_when_online, false) as notify_when_online
      from ora_favorites f
      join ora_advisors a on a.id = f.advisor_id
      where f.user_id = ${context.userId} and a.status = 'live'
      order by f.created_at desc
    `;
    const payments = await sql<{
      id: string;
      coins: number;
      amount_cents: number;
      currency: string;
      status: string;
      provider: string;
      created_at: string;
      paid_at: string | null;
    }>`
      select id, coins, amount_cents, currency, status, provider, created_at, paid_at
      from ora_payments where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return {
      me,
      sessions: sessions.map((r) => ({
        id: r.id,
        advisorName: r.name,
        advisorSlug: r.slug,
        photoUrl: r.photo_url,
        seconds: Number(r.seconds),
        coinsSpent: Number(r.coins_spent),
        advisorEarned: Number(r.advisor_earned),
        platformFee: Number(r.platform_fee),
        rateCoins: frozenRate(r.rate_coins),
        status: r.status,
        startedAt: String(r.started_at),
        endedAt: r.ended_at ? String(r.ended_at) : "",
        reviewed: Boolean(r.review_id),
      })),
      ledger: ledger.map((r) => ({
        id: r.id,
        kind: r.kind,
        amountCoins: Number(r.amount_coins),
        seconds: Number(r.seconds),
        note: r.note,
        createdAt: String(r.created_at),
      })),
      favorites: favs.map((row) => ({
        ...mapAdvisor(row as Record<string, unknown>),
        notifyWhenOnline: Boolean((row as { notify_when_online?: boolean }).notify_when_online),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        coins: Number(p.coins),
        amountCents: Number(p.amount_cents),
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        createdAt: String(p.created_at),
        paidAt: p.paid_at ? String(p.paid_at) : "",
      })),
    } satisfies Customer;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName: string }) => ({
    displayName: String(input.displayName).trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    if (data.displayName.length < 2) throw new Error("Name is too short.");
    await ensureAccount(context.userId, data.displayName);
    const sql = await getSql();
    await sql`update ora_profiles set display_name = ${data.displayName} where user_id = ${context.userId}`;
    return loadMe(context.userId);
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: String(input.advisorId).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await ensureAccount(context.userId, await authName(context.userId));
    const { ensureFavoriteExtras } = await import("@/lib/ora-favorites");
    await ensureFavoriteExtras();
    const sql = await getSql();
    const [adv] = await sql<{ id: string; online: boolean; busy: boolean }>`
      select id, online, busy from ora_advisors where (id = ${data.advisorId} or slug = ${data.advisorId}) and status = 'live'
    `;
    if (!adv) throw new Error("Advisor not available.");
    const [row] = await sql<{ advisor_id: string }>`
      select advisor_id from ora_favorites where user_id = ${context.userId} and advisor_id = ${adv.id}
    `;
    if (row) {
      await sql`delete from ora_favorites where user_id = ${context.userId} and advisor_id = ${adv.id}`;
      return { saved: false };
    }
    const available = Boolean(adv.online) && !adv.busy;
    await sql`
      insert into ora_favorites (user_id, advisor_id, last_seen_available)
      values (${context.userId}, ${adv.id}, ${available})
    `;
    return { saved: true };
  });

export const isFavorite = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: String(input.advisorId).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const { ensureFavoriteExtras } = await import("@/lib/ora-favorites");
    await ensureFavoriteExtras();
    const sql = await getSql();
    const [row] = await sql<{ notify: boolean }>`
      select f.notify_when_online as notify
      from ora_favorites f
      join ora_advisors a on a.id = f.advisor_id
      where f.user_id = ${context.userId} and (a.id = ${data.advisorId} or a.slug = ${data.advisorId})
      limit 1
    `;
    return { saved: Boolean(row), notify: Boolean(row?.notify) };
  });

async function advisorForUser(userId: string) {
  const sql = await getSql();
  const [row] = await sql`
    select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins, pending_coins
    from ora_advisors where user_id = ${userId}
  `;
  return row ? mapAdvisor(row) : null;
}

export type DeskRequest = {
  id: string;
  clientName: string;
  createdAt: string;
};

export type DeskReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
};

export type DeskPayout = {
  id: string;
  coins: number;
  usd: number;
  status: string;
  createdAt: string;
};

export type Desk = {
  me: Me;
  advisor: Advisor | null;
  applicationStatus: string | null;
  requests: DeskRequest[];
  live: { id: string; clientName: string; seconds: number; coinsSpent: number; advisorEarned: number } | null;
  earningsToday: number;
  earningsTotal: number;
  sessions: SessionRow[];
  reviews: DeskReview[];
  payouts: DeskPayout[];
};

export const getDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await loadMe(context.userId);
    const sql = await getSql();
    const advisor = await advisorForUser(context.userId);
    if (advisor) await maybeSettleAdvisorEarnings(advisor.id);
    const [app] = await sql<{ status: string }>`
      select status from ora_applications where user_id = ${context.userId} order by created_at desc limit 1
    `;
    if (advisor) await expireStaleRequests(advisor.id);
    const requests = advisor
      ? await sql<{ id: string; display_name: string; created_at: string }>`
          select r.id, coalesce(p.display_name, 'Client') as display_name, r.created_at
          from ora_chat_requests r
          left join ora_profiles p on p.user_id = r.client_id
          where r.advisor_id = ${advisor.id} and r.status = 'pending'
          order by r.created_at asc
        `
      : [];
    const [live] = advisor
      ? await sql<{ id: string; display_name: string; seconds: number; coins_spent: number; advisor_earned: number }>`
          select r.id, coalesce(p.display_name, 'Client') as display_name, r.seconds, r.coins_spent, r.advisor_earned
          from ora_readings r
          left join ora_profiles p on p.user_id = r.client_id
          where r.advisor_id = ${advisor.id} and r.status = 'live'
          order by r.started_at desc
          limit 1
        `
      : [];
    let liveNow: {
      id: string;
      display_name: string;
      seconds: number;
      coins_spent: number;
      advisor_earned: number;
    } | null = live ?? null;
    if (live) {
      const bill = await settleReading(live.id);
      if (!bill || bill.status === "ended") liveNow = null;
      else {
        liveNow = {
          ...live,
          seconds: bill.seconds,
          coins_spent: bill.coinsSpent,
          advisor_earned: bill.advisorEarned,
        };
      }
    }
    const [earn] = advisor
      ? await sql<{ today: number; total: number }>`
          select
            coalesce(sum(case when started_at >= date_trunc('day', now()) then advisor_earned else 0 end), 0)::int as today,
            coalesce(sum(advisor_earned), 0)::int as total
          from ora_readings where advisor_id = ${advisor.id}
        `
      : [{ today: 0, total: 0 }];
    const sessions = advisor
      ? await sql<{
          id: string;
          display_name: string;
          seconds: number;
          coins_spent: number;
          advisor_earned: number;
          platform_fee: number;
          rate_coins: number;
          status: string;
          started_at: string;
          ended_at: string | null;
        }>`
          select r.id, coalesce(p.display_name, 'Client') as display_name, r.seconds, r.coins_spent,
                 r.advisor_earned, r.platform_fee, r.rate_coins, r.status, r.started_at, r.ended_at
          from ora_readings r
          left join ora_profiles p on p.user_id = r.client_id
          where r.advisor_id = ${advisor.id}
          order by r.started_at desc
          limit 40
        `
      : [];
    const reviews = advisor
      ? await sql<{ id: string; rating: number; body: string; created_at: string }>`
          select id, rating, body, created_at from ora_reviews
          where advisor_id = ${advisor.id} and hidden = false order by created_at desc limit 20
        `
      : [];
    const payouts = advisor
      ? await sql<{ id: string; coins: number; usd: string; status: string; created_at: string }>`
          select id, coins, usd, status, created_at from ora_payouts
          where advisor_id = ${advisor.id} order by created_at desc limit 20
        `
      : [];
    return {
      me,
      advisor,
      applicationStatus: app?.status ?? null,
      requests: requests.map((r) => ({
        id: r.id,
        clientName: r.display_name,
        createdAt: String(r.created_at),
      })),
      live: liveNow
        ? {
            id: liveNow.id,
            clientName: liveNow.display_name,
            seconds: Number(liveNow.seconds),
            coinsSpent: Number(liveNow.coins_spent),
            advisorEarned: Number(liveNow.advisor_earned),
          }
        : null,
      earningsToday: Number(earn?.today ?? 0),
      earningsTotal: Number(earn?.total ?? 0),
      sessions: sessions.map((s) => ({
        id: s.id,
        advisorName: s.display_name,
        advisorSlug: "",
        photoUrl: "",
        seconds: Number(s.seconds),
        coinsSpent: Number(s.coins_spent),
        advisorEarned: Number(s.advisor_earned),
        platformFee: Number(s.platform_fee),
        rateCoins: frozenRate(s.rate_coins),
        status: s.status,
        startedAt: String(s.started_at),
        endedAt: s.ended_at ? String(s.ended_at) : "",
        reviewed: false,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        body: r.body,
        createdAt: String(r.created_at),
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        coins: Number(p.coins),
        usd: Number(p.usd),
        status: p.status,
        createdAt: String(p.created_at),
      })),
    } satisfies Desk;
  });

export type Inbox = {
  online: boolean;
  busy: boolean;
  live: Desk["live"];
  requests: DeskRequest[];
};

export const getInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [adv] = await sql<{ id: string; online: boolean; busy: boolean }>`
      select id, online, busy from ora_advisors where user_id = ${context.userId} limit 1
    `;
    if (!adv) return { online: false, busy: false, live: null, requests: [] as DeskRequest[] } satisfies Inbox;
    await expireStaleRequests(adv.id);
    const requests = await sql<{ id: string; display_name: string; created_at: string }>`
      select r.id, coalesce(p.display_name, 'Client') as display_name, r.created_at
      from ora_chat_requests r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${adv.id} and r.status = 'pending'
      order by r.created_at asc
    `;
    const [live] = await sql<{
      id: string;
      display_name: string;
      seconds: number;
      coins_spent: number;
      advisor_earned: number;
    }>`
      select r.id, coalesce(p.display_name, 'Client') as display_name, r.seconds, r.coins_spent, r.advisor_earned
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${adv.id} and r.status = 'live'
      order by r.started_at desc
      limit 1
    `;
    return {
      online: Boolean(adv.online),
      busy: Boolean(adv.busy),
      live: live
        ? {
            id: live.id,
            clientName: live.display_name,
            seconds: Number(live.seconds),
            coinsSpent: Number(live.coins_spent),
            advisorEarned: Number(live.advisor_earned),
          }
        : null,
      requests: requests.map((r) => ({
        id: r.id,
        clientName: r.display_name,
        createdAt: String(r.created_at),
      })),
    } satisfies Inbox;
  });

export const setOnline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { online: boolean }) => ({ online: Boolean(input.online) }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorForUser(context.userId);
    if (!advisor || advisor.status !== "live") throw new Error("Only approved advisors can go online.");
    await assertActive(context.userId);
    if (advisor.busy && !data.online) throw new Error("End the session before going offline.");
    const sql = await getSql();
    if (!data.online) {
      await sql`update ora_advisors set online = false, busy = false where id = ${advisor.id}`;
      await sql`update ora_chat_requests set status = 'expired' where advisor_id = ${advisor.id} and status = 'pending'`;
      try {
        const { closeAdvisorPresence } = await import("./ora-advisor");
        await closeAdvisorPresence(advisor.id);
      } catch (e) {
        console.error("[ora] close presence", e);
      }
    } else {
      await sql`update ora_advisors set online = true where id = ${advisor.id}`;
      try {
        const { openAdvisorPresence } = await import("./ora-advisor");
        await openAdvisorPresence(advisor.id);
      } catch (e) {
        console.error("[ora] open presence", e);
      }
    }
    return advisorForUser(context.userId);
  });

export const decideRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; accept: boolean }) => ({
    id: String(input.id).slice(0, 64),
    accept: Boolean(input.accept),
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorForUser(context.userId);
    if (!advisor || advisor.status !== "live") throw new Error("Not an approved advisor.");
    if (!advisor.online) throw new Error("Go online first.");
    if (advisor.busy) throw new Error("You are already in a session.");
    const sql = await getSql();
    const [req] = await sql<{ id: string; client_id: string; status: string }>`
      select id, client_id, status from ora_chat_requests
      where id = ${data.id} and advisor_id = ${advisor.id}
    `;
    if (!req || req.status !== "pending") throw new Error("That request is gone.");
    if (await advisorBlockedCustomer(advisor.id, req.client_id)) {
      await sql`update ora_chat_requests set status = 'declined' where id = ${req.id}`;
      throw new Error("That client is blocked.");
    }
    if (!data.accept) {
      await sql`update ora_chat_requests set status = 'declined' where id = ${req.id}`;
      return { readingId: "" };
    }
    if (!(await walletCanPay(req.client_id))) {
      await sql`update ora_chat_requests set status = 'declined' where id = ${req.id}`;
      throw new Error("Client has no time or coins left.");
    }
    const readingId = await openReading(
      req.client_id,
      { id: advisor.id, name: advisor.name, user_id: advisor.userId, rate_coins: advisor.rateCoins },
      await advisorLiveGreeting(advisor.id, advisor.name),
    );
    await sql`
      update ora_chat_requests set status = 'accepted', reading_id = ${readingId} where id = ${req.id}
    `;
    await sql`
      update ora_chat_requests set status = 'expired'
      where advisor_id = ${advisor.id} and status = 'pending' and id <> ${req.id}
    `;
    return { readingId };
  });

export const getRequest = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [row] = await sql<{ status: string; reading_id: string; created_at: string }>`
      select status, reading_id, created_at from ora_chat_requests
      where id = ${data.id} and client_id = ${context.userId}
    `;
    if (!row) return { status: "missing" as const, readingId: "" };
    if (row.status === "pending") {
      const age = Date.now() - new Date(row.created_at).getTime();
      if (Number.isFinite(age) && age > 3 * 60_000) {
        await sql`
          update ora_chat_requests set status = 'expired'
          where id = ${data.id} and client_id = ${context.userId} and status = 'pending'
        `;
        return { status: "expired" as const, readingId: "" };
      }
    }
    return { status: row.status, readingId: row.reading_id || "" };
  });

export const cancelRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update ora_chat_requests set status = 'expired'
      where id = ${data.id} and client_id = ${context.userId} and status = 'pending'
    `;
    return { ok: true };
  });

export const sendAdvisorMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({
    id: String(input.id).slice(0, 64),
    body: String(input.body).trim().slice(0, 800),
  }))
  .handler(async ({ context, data }) => {
    if (!data.body) throw new Error("Write something first.");
    const advisor = await advisorForUser(context.userId);
    if (!advisor) throw new Error("Not an advisor.");
    const sql = await getSql();
    const [owned] = await sql<{ id: string }>`
      select id from ora_readings where id = ${data.id} and advisor_id = ${advisor.id}
    `;
    if (!owned) throw new Error("This reading has ended.");
    const bill = await settleReading(data.id);
    if (!bill || bill.status !== "live") throw new Error("This reading has ended.");
    const [reading] = await sql<{ id: string; status: string }>`
      select id, status from ora_readings where id = ${data.id} and advisor_id = ${advisor.id}
    `;
    if (!reading || reading.status !== "live") throw new Error("This reading has ended.");
    const id = rid("msg");
    await sql`
      insert into ora_messages (id, reading_id, role, body)
      values (${id}, ${data.id}, 'advisor', ${data.body})
    `;
    return { id, role: "advisor" as const, body: data.body };
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { coins: number }) => ({
    coins: Math.min(50000, Math.max(1, Math.floor(Number(input.coins) || 0))),
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorForUser(context.userId);
    if (!advisor || advisor.status !== "live") throw new Error("Not an approved advisor.");
    await settleAdvisorEarnings(advisor.id);
    const fresh = await advisorForUser(context.userId);
    if (!fresh) throw new Error("Not an approved advisor.");
    const settings = await loadSettings();
    if (data.coins < settings.minPayoutCoins) {
      throw new Error(`Minimum withdrawal is ${settings.minPayoutCoins} coins.`);
    }
    const sql = await getSql();
    const locked = await sql<{ id: string }>`
      update ora_advisors
      set payout_coins = payout_coins - ${data.coins}
      where id = ${fresh.id} and payout_coins >= ${data.coins}
      returning id
    `;
    if (!locked.length) throw new Error("Not enough available earnings.");
    const id = rid("pay");
    const usd = data.coins / COINS_PER_DOLLAR;
    const cents = Math.round(usd * 100);
    try {
      await sql`
        insert into ora_payouts (id, user_id, advisor_id, coins, usd, status, currency, amount_cents)
        values (${id}, ${context.userId}, ${fresh.id}, ${data.coins}, ${usd}, 'requested', ${settings.currency}, ${cents})
      `;
    } catch (e) {
      await sql`update ora_advisors set payout_coins = payout_coins + ${data.coins} where id = ${fresh.id}`;
      throw e instanceof Error ? e : new Error("Could not request payout.");
    }
    return { ok: true, coins: data.coins, usd };
  });

export const leaveReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId: string; rating: number; body: string }) => ({
    readingId: String(input.readingId).slice(0, 64),
    rating: Math.min(5, Math.max(1, Math.floor(Number(input.rating) || 5))),
    body: String(input.body ?? "").trim().slice(0, 400),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const [reading] = await sql<{ id: string; advisor_id: string; status: string }>`
      select id, advisor_id, status from ora_readings
      where id = ${data.readingId} and client_id = ${context.userId}
    `;
    if (!reading) throw new Error("Reading not found.");
    if (reading.status !== "ended") throw new Error("Rate the sitting after it ends.");
    const id = rid("rev");
    const [existing] = await sql<{ id: string }>`
      select id from ora_reviews where reading_id = ${reading.id} limit 1
    `;
    if (existing) {
      await sql`
        update ora_reviews set rating = ${data.rating}, body = ${data.body} where reading_id = ${reading.id}
      `;
    } else {
      await sql`
        insert into ora_reviews (id, reading_id, client_id, advisor_id, rating, body)
        values (${id}, ${reading.id}, ${context.userId}, ${reading.advisor_id}, ${data.rating}, ${data.body})
      `;
    }
    const [agg] = await sql<{ avg: string; n: number }>`
      select avg(rating)::numeric(2,1) as avg, count(*)::int as n
      from ora_reviews where advisor_id = ${reading.advisor_id} and hidden = false
    `;
    await sql`
      update ora_advisors set rating = ${Number(agg?.avg ?? 5)}, reviews = ${Number(agg?.n ?? 1)}
      where id = ${reading.advisor_id}
    `;
    return { ok: true };
  });

export const saveAdvisorProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    name: string;
    bio: string;
    experience: string;
    specialties: string;
    rateCoins: number;
    languages: string;
    years: number;
    photoUrl?: string;
  }) => ({
    name: String(input.name).trim().slice(0, 80),
    bio: String(input.bio).trim().slice(0, 1200),
    experience: String(input.experience).trim().slice(0, 800),
    specialties: String(input.specialties).trim().slice(0, 120),
    rateCoins: requireRate(input.rateCoins),
    languages: String(input.languages).trim().slice(0, 80) || "English",
    years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
    photoUrl: input.photoUrl ? String(input.photoUrl).slice(0, 400_000) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const advisor = await advisorForUser(context.userId);
    if (!advisor) throw new Error("Not an advisor.");
    const sql = await getSql();
    if (data.photoUrl) {
      await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience},
            specialties = ${data.specialties}, rate_coins = ${data.rateCoins},
            languages = ${data.languages}, years = ${data.years}, photo_url = ${data.photoUrl}
        where id = ${advisor.id}
      `;
    } else {
      await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience},
            specialties = ${data.specialties}, rate_coins = ${data.rateCoins},
            languages = ${data.languages}, years = ${data.years}
        where id = ${advisor.id}
      `;
    }
    return advisorForUser(context.userId);
  });


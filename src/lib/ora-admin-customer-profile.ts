/** Customer profile reads. Does not create wallets, rewards, or readings. */

import { classifyChat, type TransactionSql } from "./ora-admin-transactions.ts";
import { visibleAdvisorPhoto } from "./ora-advisor-desk-stats.ts";
import { planById } from "./ora-membership-plan.ts";
import type { PrivateReading } from "./ora-private-readings.ts";

export type CustomerProfile = {
  userId: string;
  name: string;
  email: string;
  image: string;
  createdAt: string;
  status: string;
  role: string;
  lastActivityAt: string;
  coins: number;
  promoCoins: number;
  membershipName: string;
  membershipExpiresAt: string;
  membershipActive: boolean;
  spendCents: number;
  readings: number;
  freeSeconds: number;
  paidSeconds: number;
  coinsSpent: number;
};

export type CustomerActivity = {
  id: string;
  at: string;
  kind: "reading" | "message" | "tip" | "purchase" | "membership" | "adjustment" | "refund" | "ticket" | "login";
  label: string;
  advisorName: string;
  advisorId: string;
  readingId: string;
  seconds: number;
  freeSeconds: number;
  paidSeconds: number;
  coins: number;
  status: string;
  note: string;
};

export function latestActivityAt(values: Array<string | null | undefined>) {
  let best = "";
  let stamp = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const ms = Date.parse(String(value || ""));
    if (Number.isFinite(ms) && ms >= stamp) {
      stamp = ms;
      best = String(value);
    }
  }
  return best;
}

export function membershipView(input: { plan?: string; active?: boolean; renewsAt?: string; subscribed?: boolean }) {
  const known = planById(input.plan);
  const expiresAt = String(input.renewsAt || "");
  if (known) return { name: known.name, expiresAt, active: Boolean(input.active) };
  if (input.subscribed) return { name: "Weekly plan", expiresAt, active: true };
  return { name: "None", expiresAt: "", active: false };
}

export function succeededSpendCents(rows: Array<{ status?: string; amountCents?: number }>) {
  return rows.reduce((sum, row) => {
    if (String(row.status || "").toLowerCase() !== "succeeded") return sum;
    const cents = Math.floor(Number(row.amountCents) || 0);
    return sum + (cents > 0 ? cents : 0);
  }, 0);
}

export function readingMinuteTotals(
  rows: Array<{ seconds?: number; freeSeconds?: number; paidSeconds?: number; coins?: number; bonusUsed?: number; weeklyUsed?: number }>,
) {
  const sum = { readings: 0, freeSeconds: 0, paidSeconds: 0, coins: 0 };
  for (const row of rows) {
    if (row.freeSeconds != null || row.paidSeconds != null) {
      sum.readings += 1;
      sum.freeSeconds += Math.max(0, Math.floor(Number(row.freeSeconds) || 0));
      sum.paidSeconds += Math.max(0, Math.floor(Number(row.paidSeconds) || 0));
      sum.coins += Math.max(0, Math.floor(Number(row.coins) || 0));
      continue;
    }
    const bill = classifyChat({
      seconds: row.seconds,
      bonusUsed: row.bonusUsed,
      weeklyUsed: row.weeklyUsed,
      coinsSpent: row.coins,
    });
    sum.readings += 1;
    sum.freeSeconds += bill.freeSeconds;
    sum.paidSeconds += bill.paidSeconds;
    sum.coins += bill.coins;
  }
  return sum;
}

function whole(value: unknown) {
  const n = Math.trunc(Number(value) || 0);
  return Number.isFinite(n) ? n : 0;
}

function on(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

function paymentKind(packId: string): "membership" | "purchase" {
  return packId === "membership" || packId === "membership-mini" ? "membership" : "purchase";
}

export function assembleCustomerActivity(input: {
  readings?: PrivateReading[];
  messages?: Array<{ id: string; at: string; coins?: number; advisorName?: string; advisorId?: string; status?: string }>;
  tips?: Array<{ id: string; at: string; coins?: number; gift?: string; advisorName?: string; advisorId?: string }>;
  payments?: Array<{ id: string; at: string; coins?: number; cents?: number; status?: string; packId?: string }>;
  adjustments?: Array<{ id: string; at: string; coins?: number; kind?: string; note?: string; actorId?: string }>;
  tickets?: Array<{ id: string; at: string; status?: string; reason?: string; ticketNo?: string }>;
  logins?: Array<{ id: string; at: string; ip?: string; userAgent?: string }>;
}) {
  const rows: CustomerActivity[] = [];
  for (const reading of input.readings || []) {
    rows.push({
      id: `reading:${reading.id}`,
      at: reading.startedAt,
      kind: "reading",
      label: `${reading.chatTypeLabel} reading`,
      advisorName: reading.advisorName,
      advisorId: reading.advisorId,
      readingId: reading.id,
      seconds: reading.seconds,
      freeSeconds: reading.freeSeconds,
      paidSeconds: reading.paidSeconds,
      coins: reading.coins,
      status: reading.statusLabel,
      note: reading.endReason,
    });
  }
  for (const row of input.messages || []) {
    rows.push({
      id: `message:${row.id}`,
      at: row.at,
      kind: "message",
      label: "Paid message",
      advisorName: row.advisorName || "",
      advisorId: row.advisorId || "",
      readingId: "",
      seconds: 0,
      freeSeconds: 0,
      paidSeconds: 0,
      coins: whole(row.coins),
      status: row.status || "Completed",
      note: "",
    });
  }
  for (const row of input.tips || []) {
    rows.push({
      id: `tip:${row.id}`,
      at: row.at,
      kind: "tip",
      label: row.gift ? `Tip · ${row.gift}` : "Tip",
      advisorName: row.advisorName || "",
      advisorId: row.advisorId || "",
      readingId: "",
      seconds: 0,
      freeSeconds: 0,
      paidSeconds: 0,
      coins: whole(row.coins),
      status: "Completed",
      note: "",
    });
  }
  for (const row of input.payments || []) {
    const kind = paymentKind(String(row.packId || ""));
    const cents = whole(row.cents);
    rows.push({
      id: `payment:${row.id}`,
      at: row.at,
      kind,
      label: kind === "membership" ? "Membership" : "Coin purchase",
      advisorName: "",
      advisorId: "",
      readingId: "",
      seconds: 0,
      freeSeconds: 0,
      paidSeconds: 0,
      coins: whole(row.coins),
      status: String(row.status || ""),
      note: cents > 0 ? `${(cents / 100).toFixed(2)} USD` : "",
    });
  }
  for (const row of input.adjustments || []) {
    const coins = whole(row.coins);
    const refund = String(row.kind || "") === "refund" || coins < 0;
    rows.push({
      id: `adjustment:${row.id}`,
      at: row.at,
      kind: refund ? "refund" : "adjustment",
      label: refund ? "Refund" : "Coin adjustment",
      advisorName: "",
      advisorId: "",
      readingId: "",
      seconds: 0,
      freeSeconds: 0,
      paidSeconds: 0,
      coins,
      status: row.actorId ? `Admin ${row.actorId}` : "",
      note: String(row.note || ""),
    });
  }
  for (const row of input.tickets || []) {
    rows.push({
      id: `ticket:${row.id}`,
      at: row.at,
      kind: "ticket",
      label: row.ticketNo ? `Support ${row.ticketNo}` : "Support ticket",
      advisorName: "",
      advisorId: "",
      readingId: "",
      seconds: 0,
      freeSeconds: 0,
      paidSeconds: 0,
      coins: 0,
      status: String(row.status || ""),
      note: String(row.reason || ""),
    });
  }
  for (const row of input.logins || []) {
    const agent = String(row.userAgent || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const ip = String(row.ip || "").trim();
    rows.push({
      id: `login:${row.id}`,
      at: row.at,
      kind: "login",
      label: "Sign-in",
      advisorName: "",
      advisorId: "",
      readingId: "",
      seconds: 0,
      freeSeconds: 0,
      paidSeconds: 0,
      coins: 0,
      status: "Recorded",
      note: [ip, agent].filter(Boolean).join(" · "),
    });
  }
  return rows.sort((a, b) => Date.parse(b.at || "") - Date.parse(a.at || ""));
}

export type ActivityFilters = {
  type?: "all" | CustomerActivity["kind"];
  from?: string;
  to?: string;
  advisor?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function filterCustomerActivity(rows: CustomerActivity[], filters: ActivityFilters) {
  const type = filters.type && filters.type !== "all" ? filters.type : "";
  const advisor = String(filters.advisor || "").trim().toLowerCase();
  const from = DAY.test(String(filters.from || "")) ? String(filters.from) : "";
  const to = DAY.test(String(filters.to || "")) ? String(filters.to) : "";
  return rows.filter((row) => {
    if (type && row.kind !== type) return false;
    if (advisor && !`${row.advisorName} ${row.advisorId}`.toLowerCase().includes(advisor)) return false;
    const ms = Date.parse(row.at || "");
    if ((from || to) && !Number.isFinite(ms)) return false;
    const day = Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

async function optional<T>(work: () => Promise<T[]>) {
  try {
    return await work();
  } catch {
    return [];
  }
}

async function ensureProfileColumns(sql: TransactionSql) {
  const statements = [
    `alter table ora_wallets add column if not exists promo_coins integer not null default 0`,
    `alter table ora_wallets add column if not exists membership_plan text not null default ''`,
    `alter table ora_wallets add column if not exists membership_active boolean not null default false`,
    `alter table ora_wallets add column if not exists membership_renews_at timestamptz`,
    `alter table ora_adjustments add column if not exists actor_id text not null default ''`,
  ];
  for (const statement of statements) {
    try {
      await sql.query(statement);
    } catch {
      /* A partial database still returns the rows it has. */
    }
  }
}

export async function loadCustomerProfile(sql: TransactionSql, userId: string): Promise<CustomerProfile | null> {
  await ensureProfileColumns(sql);
  const [profile] = await sql<{
    display_name: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
    image: string | null;
    auth_name: string | null;
    auth_email: string | null;
  }>`
    select p.display_name, p.email, p.role, coalesce(p.status, 'active') as status, p.created_at::text as created_at,
           u.image, u.name as auth_name, u.email as auth_email
    from ora_profiles p
    left join "user" u on u.id = p.user_id
    where p.user_id = ${userId}
  `;
  if (!profile) return null;
  const wallets = await optional(() => sql<{
    coins: number;
    promo_coins: number;
    subscribed: boolean;
    membership_plan: string;
    membership_active: boolean;
    membership_renews_at: string | null;
  }>`
    select coalesce(coins, 0)::int as coins,
           coalesce(promo_coins, 0)::int as promo_coins,
           coalesce(subscribed, false) as subscribed,
           coalesce(membership_plan, '') as membership_plan,
           coalesce(membership_active, false) as membership_active,
           membership_renews_at::text as membership_renews_at
    from ora_wallets
    where user_id = ${userId}
  `);
  const wallet = wallets[0];
  const readings = await loadCustomerReadings(sql, userId);
  const totals = readingMinuteTotals(readings);
  const payments = await optional(() => sql<{ status: string; amount_cents: number; created_at: string }>`
    select status, coalesce(amount_cents, 0)::int as amount_cents, created_at::text as created_at
    from ora_payments
    where user_id = ${userId}
  `);
  const sessions = await optional(() => sql<{ updated_at: string }>`
    select "updatedAt"::text as updated_at from "session" where "userId" = ${userId}
  `);
  const ledger = await optional(() => sql<{ created_at: string }>`
    select created_at::text as created_at from ora_ledger where user_id = ${userId} order by created_at desc limit 1
  `);
  const membership = membershipView({
    plan: wallet?.membership_plan,
    active: on(wallet?.membership_active),
    renewsAt: wallet?.membership_renews_at ? String(wallet.membership_renews_at) : "",
    subscribed: on(wallet?.subscribed),
  });
  const name = String(profile.display_name || "").trim() || String(profile.auth_name || "").trim() || "Unnamed client";
  return {
    userId,
    name,
    email: String(profile.email || profile.auth_email || ""),
    image: visibleAdvisorPhoto(profile.image),
    createdAt: String(profile.created_at || ""),
    status: String(profile.status || "active"),
    role: String(profile.role || "client"),
    lastActivityAt: latestActivityAt([
      ...sessions.map((row) => row.updated_at),
      ...readings.map((row) => row.startedAt),
      ledger[0]?.created_at,
      ...payments.map((row) => row.created_at),
    ]),
    coins: whole(wallet?.coins),
    promoCoins: whole(wallet?.promo_coins),
    membershipName: membership.name,
    membershipExpiresAt: membership.expiresAt,
    membershipActive: membership.active,
    spendCents: succeededSpendCents(payments.map((row) => ({ status: row.status, amountCents: row.amount_cents }))),
    readings: totals.readings,
    freeSeconds: totals.freeSeconds,
    paidSeconds: totals.paidSeconds,
    coinsSpent: totals.coins,
  };
}

export async function loadCustomerReadings(sql: TransactionSql, userId: string) {
  const { loadPrivateReadings } = await import("./ora-private-readings.ts");
  const rows = await loadPrivateReadings(sql);
  return rows.filter((row) => row.clientId === userId);
}

export async function loadCustomerActivity(sql: TransactionSql, userId: string) {
  await ensureProfileColumns(sql);
  const readings = await loadCustomerReadings(sql, userId);
  const messages = await optional(() => sql<{
    id: string;
    created_at: string;
    coins: number;
    advisor_id: string;
    advisor_name: string;
    credited: boolean;
  }>`
    select m.id, m.created_at::text as created_at, coalesce(m.coins, 0)::int as coins,
           m.advisor_id, coalesce(a.name, '') as advisor_name, coalesce(m.credited, true) as credited
    from ora_paid_messages m
    left join ora_advisors a on a.id = m.advisor_id
    where m.customer_id = ${userId}
    order by m.created_at desc
    limit 100
  `);
  const tips = await optional(() => sql<{
    id: string;
    created_at: string;
    coins: number;
    gift: string;
    advisor_id: string;
    advisor_name: string;
  }>`
    select t.id, t.created_at::text as created_at, coalesce(t.coins, 0)::int as coins, t.gift,
           t.advisor_id, coalesce(a.name, '') as advisor_name
    from ora_customer_tips t
    left join ora_advisors a on a.id = t.advisor_id
    where t.customer_id = ${userId}
    order by t.created_at desc
    limit 100
  `);
  const payments = await optional(() => sql<{
    id: string;
    created_at: string;
    coins: number;
    amount_cents: number;
    status: string;
    pack_id: string;
  }>`
    select id, created_at::text as created_at, coalesce(coins, 0)::int as coins,
           coalesce(amount_cents, 0)::int as amount_cents, status, pack_id
    from ora_payments
    where user_id = ${userId}
    order by created_at desc
    limit 100
  `);
  const adjustments = await optional(() => sql<{
    id: string;
    created_at: string;
    coins: number;
    kind: string;
    note: string;
    actor_id: string;
  }>`
    select id, created_at::text as created_at, coins, kind, note, coalesce(actor_id, '') as actor_id
    from ora_adjustments
    where user_id = ${userId}
    order by created_at desc
    limit 100
  `);
  const tickets = await optional(() => sql<{
    id: string;
    created_at: string;
    status: string;
    reason: string;
    ticket_no: string;
  }>`
    select id, created_at::text as created_at, status, reason, ticket_no
    from ora_tickets
    where client_id = ${userId}
    order by created_at desc
    limit 50
  `);
  const logins = await optional(() => sql<{ id: string; created_at: string; ip: string; agent: string }>`
    select id, "createdAt"::text as created_at, coalesce("ipAddress", '') as ip, coalesce("userAgent", '') as agent
    from "session"
    where "userId" = ${userId}
    order by "createdAt" desc
    limit 40
  `);
  return assembleCustomerActivity({
    readings,
    messages: messages.map((row) => ({
      id: row.id,
      at: String(row.created_at || ""),
      coins: row.coins,
      advisorName: row.advisor_name,
      advisorId: row.advisor_id,
      status: row.credited === false || row.credited === ("f" as unknown as boolean) ? "Pending" : "Completed",
    })),
    tips: tips.map((row) => ({
      id: row.id,
      at: String(row.created_at || ""),
      coins: row.coins,
      gift: row.gift,
      advisorName: row.advisor_name,
      advisorId: row.advisor_id,
    })),
    payments: payments.map((row) => ({
      id: row.id,
      at: String(row.created_at || ""),
      coins: row.coins,
      cents: row.amount_cents,
      status: row.status,
      packId: row.pack_id,
    })),
    adjustments: adjustments.map((row) => ({
      id: row.id,
      at: String(row.created_at || ""),
      coins: row.coins,
      kind: row.kind,
      note: row.note,
      actorId: row.actor_id,
    })),
    tickets: tickets.map((row) => ({
      id: row.id,
      at: String(row.created_at || ""),
      status: row.status,
      reason: row.reason,
      ticketNo: row.ticket_no,
    })),
    logins: logins.map((row) => ({
      id: row.id,
      at: String(row.created_at || ""),
      ip: row.ip,
      userAgent: row.agent,
    })),
  });
}

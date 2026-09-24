/** Admin finance display. Reads stored amounts only. Does not write or recompute splits. */

import { CENTS_PER_COIN, payoutStatusLabel } from "./ora-admin-payouts.ts";
import { planByPackId } from "./ora-membership-plan.ts";
import { tipGift } from "./ora-tips.ts";

export type FinanceRange = "today" | "7d" | "30d" | "month" | "custom" | "all";

export type FinanceType =
  | "coin purchase"
  | "ora mini membership"
  | "ora membership"
  | "live reading"
  | "paid message"
  | "tip/gift"
  | "advisor payout"
  | "refund";

export type FinanceTxn = {
  id: string;
  at: string;
  type: FinanceType;
  status: string;
  customerId: string;
  customer: string;
  customerEmail: string;
  advisorId: string;
  advisor: string;
  grossCents: number;
  oraCents: number;
  advisorCents: number;
  currency: string;
  note: string;
  /** Succeeded cash collected from the customer. Not coin use, not payouts. */
  cash: boolean;
  /** Successful reading, message, or tip. Not added to cash sales. */
  activity: boolean;
};

export type FinancePayment = {
  id: string;
  userId: string;
  customer: string;
  email: string;
  packId: string;
  provider: string;
  amountCents: number;
  currency: string;
  coins: number;
  status: string;
  paidAt: string;
  createdAt: string;
};

export type FinanceReading = {
  id: string;
  at: string;
  customerId: string;
  customer: string;
  email: string;
  advisorId: string;
  advisor: string;
  status: string;
  coinsSpent: number;
  advisorEarned: number;
  platformFee: number;
  clawed: boolean;
};

export type FinanceMessage = {
  id: string;
  at: string;
  customerId: string;
  customer: string;
  email: string;
  advisorId: string;
  advisor: string;
  coins: number;
  amountCents: number;
  advisorCents: number;
  oraCents: number;
  credited: boolean;
};

export type FinanceTip = {
  id: string;
  at: string;
  customerId: string;
  customer: string;
  email: string;
  advisorId: string;
  advisor: string;
  gift: string;
  coins: number;
  advisorShare: number;
  oraShare: number;
  charged: boolean;
  credited: boolean;
};

export type FinancePayout = {
  id: string;
  at: string;
  paidAt: string;
  advisorId: string;
  advisor: string;
  coins: number;
  amountCents: number;
  status: string;
  workflow: string;
  currency: string;
};

export type FinanceAdjustment = {
  id: string;
  at: string;
  userId: string;
  customer: string;
  email: string;
  readingId: string;
  coins: number;
  kind: string;
  note: string;
};

export type FinanceSources = {
  payments: FinancePayment[];
  readings: FinanceReading[];
  messages: FinanceMessage[];
  tips: FinanceTip[];
  payouts: FinancePayout[];
  adjustments: FinanceAdjustment[];
};

export type FinanceSummary = {
  grossTodayCents: number;
  grossMonthCents: number;
  grossLifetimeCents: number;
  oraRevenueCents: number;
  advisorEarningsCents: number;
  pendingPayoutCents: number;
  completedPayoutCents: number;
  coinPurchaseCents: number;
  membershipCents: number;
  miniCents: number;
  fullMembershipCents: number;
  readingGrossCents: number;
  readingOraCents: number;
  readingAdvisorCents: number;
  messageGrossCents: number;
  messageOraCents: number;
  messageAdvisorCents: number;
  tipGrossCents: number;
  tipOraCents: number;
  tipAdvisorCents: number;
  activityGrossCents: number;
  activityOraCents: number;
  activityAdvisorCents: number;
  shareGapCents: number;
  refundCents: number;
  currency: string;
};

export type FinanceFilters = {
  range: FinanceRange;
  from?: string;
  to?: string;
  type?: string;
  customer?: string;
  advisor?: string;
  status?: string;
};

const HIDDEN_DETAIL = new Set([
  "provider_ref",
  "providerref",
  "idempotency_key",
  "idempotencykey",
  "card",
  "cardnumber",
  "card_number",
  "pan",
  "cvv",
  "cvc",
  "secret",
  "clientsecret",
  "client_secret",
  "token",
]);

export function paymentProduct(packId: unknown): "coin purchase" | "ora mini membership" | "ora membership" {
  const plan = planByPackId(String(packId || ""));
  if (plan?.plan === "mini") return "ora mini membership";
  if (plan?.plan === "membership") return "ora membership";
  return "coin purchase";
}

function cents(value: unknown) {
  const n = Math.floor(Number(value) || 0);
  return n > 0 ? n : 0;
}

function absCentsCoins(value: unknown) {
  const n = Math.floor(Math.abs(Number(value) || 0));
  return n > 0 ? n : 0;
}

function coinsToCents(coins: unknown) {
  return cents(coins) * CENTS_PER_COIN;
}

function stamp(iso: unknown) {
  const n = Date.parse(String(iso || ""));
  return Number.isFinite(n) ? n : NaN;
}

function when(primary: unknown, fallback: unknown) {
  const first = String(primary || "").trim();
  if (Number.isFinite(stamp(first))) return first;
  return String(fallback || "").trim();
}

function clean(value: unknown) {
  return String(value || "").trim();
}

export function financeWindow(filters: FinanceFilters, now: Date) {
  const end = now.getTime();
  if (filters.range === "all") return null;
  if (filters.range === "today") {
    return { start: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()), end };
  }
  if (filters.range === "7d") return { start: end - 7 * 86_400_000, end };
  if (filters.range === "30d") return { start: end - 30 * 86_400_000, end };
  if (filters.range === "month") {
    return { start: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1), end };
  }
  const from = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(filters.from));
  const to = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(filters.to));
  if (!from || !to) return { start: end + 1, end };
  const start = Date.UTC(Number(from[1]), Number(from[2]) - 1, Number(from[3]));
  const finish = Date.UTC(Number(to[1]), Number(to[2]) - 1, Number(to[3]), 23, 59, 59, 999);
  if (finish < start) return { start: end + 1, end };
  return { start, end: finish };
}

function inWindow(iso: string, window: { start: number; end: number } | null) {
  if (!window) return true;
  const n = stamp(iso);
  return Number.isFinite(n) && n >= window.start && n <= window.end;
}

function inUtcMonth(iso: string, now: Date) {
  const n = stamp(iso);
  if (!Number.isFinite(n)) return false;
  const date = new Date(n);
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

function inUtcDay(iso: string, now: Date) {
  const n = stamp(iso);
  if (!Number.isFinite(n)) return false;
  const date = new Date(n);
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

function paymentStatus(status: unknown) {
  const name = clean(status).toLowerCase();
  if (name === "succeeded") return "succeeded";
  if (name === "refunded") return "refunded";
  if (name === "failed" || name === "cancelled" || name === "canceled" || name === "expired") return "failed";
  return "incomplete";
}

function readingStatus(status: unknown) {
  const name = clean(status).toLowerCase();
  return name === "ended" || name === "completed";
}

export function assembleFinance(sources: FinanceSources): FinanceTxn[] {
  const seen = new Set<string>();
  const txns: FinanceTxn[] = [];
  const push = (txn: FinanceTxn) => {
    const key = `${txn.type}:${txn.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    txns.push(txn);
  };
  const refundedPayments = new Set(
    sources.payments
      .filter((row) => paymentStatus(row.status) === "refunded")
      .map((row) => row.id),
  );

  for (const row of sources.payments) {
    const status = paymentStatus(row.status);
    const type = paymentProduct(row.packId);
    const at = when(row.paidAt, row.createdAt);
    const gross = cents(row.amountCents);
    const membership = type !== "coin purchase";
    if (status === "refunded") {
      push({
        id: row.id,
        at,
        type: "refund",
        status,
        customerId: row.userId,
        customer: row.customer,
        customerEmail: row.email,
        advisorId: "",
        advisor: "",
        grossCents: gross,
        oraCents: 0,
        advisorCents: 0,
        currency: clean(row.currency) || "USD",
        note: `Refunded ${type}`,
        cash: false,
        activity: false,
      });
      continue;
    }
    push({
      id: row.id,
      at,
      type,
      status,
      customerId: row.userId,
      customer: row.customer,
      customerEmail: row.email,
      advisorId: "",
      advisor: "",
      grossCents: gross,
      oraCents: status === "succeeded" && membership ? gross : 0,
      advisorCents: 0,
      currency: clean(row.currency) || "USD",
      note: clean(row.packId),
      cash: status === "succeeded",
      activity: false,
    });
  }

  for (const row of sources.readings) {
    if (!readingStatus(row.status)) continue;
    if (cents(row.coinsSpent) === 0 && cents(row.advisorEarned) === 0 && cents(row.platformFee) === 0) continue;
    const clawed = Boolean(row.clawed);
    push({
      id: row.id,
      at: row.at,
      type: "live reading",
      status: clawed ? "refunded" : "succeeded",
      customerId: row.customerId,
      customer: row.customer,
      customerEmail: row.email,
      advisorId: row.advisorId,
      advisor: row.advisor,
      grossCents: coinsToCents(row.coinsSpent),
      oraCents: coinsToCents(row.platformFee),
      advisorCents: coinsToCents(row.advisorEarned),
      currency: "USD",
      note: "",
      cash: false,
      activity: !clawed,
    });
  }

  for (const row of sources.messages) {
    if (!row.credited) continue;
    const gross = cents(row.amountCents) > 0 ? cents(row.amountCents) : coinsToCents(row.coins);
    if (gross === 0 && cents(row.advisorCents) === 0 && cents(row.oraCents) === 0) continue;
    push({
      id: row.id,
      at: row.at,
      type: "paid message",
      status: "succeeded",
      customerId: row.customerId,
      customer: row.customer,
      customerEmail: row.email,
      advisorId: row.advisorId,
      advisor: row.advisor,
      grossCents: gross,
      oraCents: cents(row.oraCents),
      advisorCents: cents(row.advisorCents),
      currency: "USD",
      note: "",
      cash: false,
      activity: true,
    });
  }

  for (const row of sources.tips) {
    if (!row.charged || !row.credited) continue;
    if (cents(row.coins) === 0 && cents(row.advisorShare) === 0 && cents(row.oraShare) === 0) continue;
    const gift = tipGift(row.gift);
    push({
      id: row.id,
      at: row.at,
      type: "tip/gift",
      status: "succeeded",
      customerId: row.customerId,
      customer: row.customer,
      customerEmail: row.email,
      advisorId: row.advisorId,
      advisor: row.advisor,
      grossCents: coinsToCents(row.coins),
      oraCents: coinsToCents(row.oraShare),
      advisorCents: coinsToCents(row.advisorShare),
      currency: "USD",
      note: gift?.name || clean(row.gift),
      cash: false,
      activity: true,
    });
  }

  for (const row of sources.payouts) {
    const label = payoutStatusLabel(row.status, row.workflow);
    const gross = cents(row.amountCents) > 0 ? cents(row.amountCents) : coinsToCents(row.coins);
    push({
      id: row.id,
      at: label === "paid" ? when(row.paidAt, row.at) : row.at,
      type: "advisor payout",
      status: label,
      customerId: "",
      customer: "",
      customerEmail: "",
      advisorId: row.advisorId,
      advisor: row.advisor,
      grossCents: gross,
      oraCents: 0,
      advisorCents: 0,
      currency: clean(row.currency) || "USD",
      note: "Not revenue",
      cash: false,
      activity: false,
    });
  }

  for (const row of sources.adjustments) {
    if (clean(row.kind).toLowerCase() !== "refund") continue;
    if (row.readingId && refundedPayments.has(row.readingId)) continue;
    push({
      id: row.id,
      at: row.at,
      type: "refund",
      status: "refunded",
      customerId: row.userId,
      customer: row.customer,
      customerEmail: row.email,
      advisorId: "",
      advisor: "",
      grossCents: coinsToCents(absCentsCoins(row.coins)),
      oraCents: 0,
      advisorCents: 0,
      currency: "USD",
      note: clean(row.note) || clean(row.readingId),
      cash: false,
      activity: false,
    });
  }

  return txns.sort((a, b) => stamp(b.at) - stamp(a.at) || b.id.localeCompare(a.id));
}

function sum(rows: FinanceTxn[], pick: (row: FinanceTxn) => number) {
  return rows.reduce((total, row) => total + pick(row), 0);
}

export function summarizeFinance(txns: FinanceTxn[], now = new Date(), currency = "USD"): FinanceSummary {
  const cash = txns.filter((row) => row.cash);
  const activity = txns.filter((row) => row.activity);
  const readings = activity.filter((row) => row.type === "live reading");
  const messages = activity.filter((row) => row.type === "paid message");
  const tips = activity.filter((row) => row.type === "tip/gift");
  const mini = cash.filter((row) => row.type === "ora mini membership");
  const full = cash.filter((row) => row.type === "ora membership");
  const packs = cash.filter((row) => row.type === "coin purchase");
  const readingGross = sum(readings, (row) => row.grossCents);
  const readingOra = sum(readings, (row) => row.oraCents);
  const readingAdvisor = sum(readings, (row) => row.advisorCents);
  const messageGross = sum(messages, (row) => row.grossCents);
  const messageOra = sum(messages, (row) => row.oraCents);
  const messageAdvisor = sum(messages, (row) => row.advisorCents);
  const tipGross = sum(tips, (row) => row.grossCents);
  const tipOra = sum(tips, (row) => row.oraCents);
  const tipAdvisor = sum(tips, (row) => row.advisorCents);
  const activityGross = readingGross + messageGross + tipGross;
  const activityOra = readingOra + messageOra + tipOra;
  const activityAdvisor = readingAdvisor + messageAdvisor + tipAdvisor;
  const miniCents = sum(mini, (row) => row.grossCents);
  const fullMembershipCents = sum(full, (row) => row.grossCents);
  const pending = txns.filter(
    (row) => row.type === "advisor payout" && (row.status === "pending" || row.status === "processing"),
  );
  const paid = txns.filter((row) => row.type === "advisor payout" && row.status === "paid");
  return {
    grossTodayCents: sum(cash.filter((row) => inUtcDay(row.at, now)), (row) => row.grossCents),
    grossMonthCents: sum(cash.filter((row) => inUtcMonth(row.at, now)), (row) => row.grossCents),
    grossLifetimeCents: sum(cash, (row) => row.grossCents),
    oraRevenueCents: activityOra + miniCents + fullMembershipCents,
    advisorEarningsCents: activityAdvisor,
    pendingPayoutCents: sum(pending, (row) => row.grossCents),
    completedPayoutCents: sum(paid, (row) => row.grossCents),
    coinPurchaseCents: sum(packs, (row) => row.grossCents),
    membershipCents: miniCents + fullMembershipCents,
    miniCents,
    fullMembershipCents,
    readingGrossCents: readingGross,
    readingOraCents: readingOra,
    readingAdvisorCents: readingAdvisor,
    messageGrossCents: messageGross,
    messageOraCents: messageOra,
    messageAdvisorCents: messageAdvisor,
    tipGrossCents: tipGross,
    tipOraCents: tipOra,
    tipAdvisorCents: tipAdvisor,
    activityGrossCents: activityGross,
    activityOraCents: activityOra,
    activityAdvisorCents: activityAdvisor,
    shareGapCents: activityGross - activityOra - activityAdvisor,
    refundCents: sum(
      txns.filter((row) => row.type === "refund"),
      (row) => row.grossCents,
    ),
    currency: currency || "USD",
  };
}

export function reconcileFinance(summary: FinanceSummary) {
  const cashParts = summary.coinPurchaseCents + summary.miniCents + summary.fullMembershipCents;
  return {
    cashMatches: cashParts === summary.grossLifetimeCents,
    activityMatches: summary.shareGapCents === 0,
    oraExcludesCoinPurchases: summary.oraRevenueCents === summary.activityOraCents + summary.membershipCents,
    payoutsSeparate:
      summary.completedPayoutCents >= 0 &&
      summary.pendingPayoutCents >= 0 &&
      summary.grossLifetimeCents === cashParts,
    shareGapCents: summary.shareGapCents,
  };
}

function includes(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function filterFinance(txns: FinanceTxn[], filters: FinanceFilters, now = new Date()) {
  const window = financeWindow(filters, now);
  const type = clean(filters.type) || "all";
  const status = clean(filters.status) || "all";
  const customer = clean(filters.customer);
  const advisor = clean(filters.advisor);
  return txns.filter((row) => {
    if (!inWindow(row.at, window)) return false;
    if (type !== "all" && row.type !== type) return false;
    if (status !== "all" && row.status !== status) return false;
    if (customer) {
      const blob = `${row.customer} ${row.customerEmail} ${row.customerId}`;
      if (!includes(blob, customer)) return false;
    }
    if (advisor) {
      const blob = `${row.advisor} ${row.advisorId}`;
      if (!includes(blob, advisor)) return false;
    }
    return true;
  });
}

export type FinanceDetail = {
  id: string;
  at: string;
  type: string;
  status: string;
  customer: string;
  customerEmail: string;
  advisor: string;
  grossCents: number;
  oraCents: number;
  advisorCents: number;
  currency: string;
  note: string;
};

/** Explicit fields only. Payment credentials never pass through. */
export function financeDetail(txn: FinanceTxn): FinanceDetail {
  return {
    id: txn.id,
    at: txn.at,
    type: txn.type,
    status: txn.status,
    customer: txn.customer,
    customerEmail: txn.customerEmail,
    advisor: txn.advisor,
    grossCents: txn.grossCents,
    oraCents: txn.oraCents,
    advisorCents: txn.advisorCents,
    currency: txn.currency,
    note: txn.note,
  };
}

export function detailHasSecrets(detail: FinanceDetail) {
  const blob = JSON.stringify(detail).toLowerCase();
  for (const key of HIDDEN_DETAIL) {
    if (blob.includes(`"${key}"`)) return true;
  }
  return false;
}

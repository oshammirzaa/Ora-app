/** Advisor earnings ready for payment. Reads stored advisor shares. Does not change finance or payout rules. */

import {
  advisorBalance,
  coinsToEarningCents,
  inUtcMonth,
  payoutStatusLabel,
  recordedPayoutCents,
  whole,
} from "./ora-admin-payouts.ts";

/** $50 of the advisor's own unpaid share. Ten cents is one coin, so this is 5,000 cents. */
export const READY_UNPAID_CENTS = 5_000;

export type EarningKind = "reading" | "message" | "tip" | "other";

export type EarningEvent = {
  id: string;
  advisorId: string;
  at: string;
  kind: EarningKind;
  advisorCents: number;
};

export type PayoutEvent = {
  id: string;
  advisorId: string;
  coins: number;
  amountCents: number;
  status: string;
  workflow: string;
  paidAt: string;
  createdAt: string;
  method: string;
  referenceId: string;
  note: string;
};

export type EarningsAdvisor = {
  id: string;
  name: string;
  photoUrl: string;
  email: string;
  status: string;
};

export type ReadyAdvisor = {
  id: string;
  name: string;
  photoUrl: string;
  email: string;
  status: string;
  monthEarningsCents: number;
  lifetimeCents: number;
  paidCents: number;
  unpaidCents: number;
  lastPaymentAt: string;
  readySince: string;
  paymentStatus: "ready" | "below" | "paid" | "processing" | "held";
  processing: boolean;
  held: boolean;
  activity: { at: string; cents: number }[];
};

export type EarningsSummary = {
  monthEarningsCents: number;
  unpaidCents: number;
  readyCount: number;
  paidThisMonthCents: number;
};

export type MonthTotal = { month: string; label: string; cents: number };

export type MonthBreakdown = {
  month: string;
  label: string;
  readingCents: number;
  messageCents: number;
  tipCents: number;
  otherCents: number;
  totalCents: number;
};

export type PaymentRecord = {
  id: string;
  cents: number;
  at: string;
  method: string;
  referenceId: string;
  status: string;
  note: string;
};

export type EarningsDetail = {
  advisor: EarningsAdvisor;
  unpaidCents: number;
  monthEarningsCents: number;
  lifetimeCents: number;
  paidCents: number;
  lastPaymentAt: string;
  readySince: string;
  ready: boolean;
  months: MonthTotal[];
  breakdown: MonthBreakdown;
  payments: PaymentRecord[];
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function utcMonthKey(iso: unknown) {
  const stamp = Date.parse(String(iso || ""));
  if (!Number.isFinite(stamp)) return "";
  const date = new Date(stamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : key;
}

export function currentMonthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function signedSum(values: number[]) {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? Math.floor(value) : 0), 0);
}

function dedupedEarnings(events: EarningEvent[]) {
  const seen = new Set<string>();
  const rows: EarningEvent[] = [];
  for (const event of events) {
    const id = String(event.id || "");
    const advisorId = String(event.advisorId || "");
    if (!id || !advisorId) continue;
    const key = `${advisorId}:${event.kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      ...event,
      id,
      advisorId,
      advisorCents: whole(event.advisorCents),
    });
  }
  return rows;
}

function dedupedPayouts(rows: PayoutEvent[]) {
  const seen = new Set<string>();
  const payouts: PayoutEvent[] = [];
  for (const row of rows) {
    const id = String(row.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    payouts.push({ ...row, id, coins: whole(row.coins), amountCents: whole(row.amountCents) });
  }
  return payouts;
}

function advisorFigures(events: EarningEvent[], payouts: PayoutEvent[], now: Date) {
  const balance = advisorBalance({
    readingCents: signedSum(events.filter((row) => row.kind === "reading").map((row) => row.advisorCents)),
    messageCents: signedSum(events.filter((row) => row.kind === "message").map((row) => row.advisorCents)),
    tipCents: signedSum(events.filter((row) => row.kind === "tip").map((row) => row.advisorCents)),
    adjustmentCents: signedSum(events.filter((row) => row.kind === "other").map((row) => row.advisorCents)),
    payouts,
  });
  const month = currentMonthKey(now);
  const monthEarningsCents = signedSum(
    events.filter((row) => utcMonthKey(row.at) === month).map((row) => row.advisorCents),
  );
  const paidRows = payouts.filter((row) => payoutStatusLabel(row.status, row.workflow) === "paid");
  const lastPaymentAt =
    paidRows
      .map((row) => row.paidAt || row.createdAt)
      .filter((iso) => Number.isFinite(Date.parse(iso)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "";
  const flags = payoutFlags(payouts);
  const unpaidCents = balance.pendingCents;
  let paymentStatus: ReadyAdvisor["paymentStatus"] = "below";
  if (unpaidCents >= READY_UNPAID_CENTS) paymentStatus = "ready";
  else if (flags.processing) paymentStatus = "processing";
  else if (flags.held) paymentStatus = "held";
  else if (balance.paidCents > 0 && unpaidCents <= 0) paymentStatus = "paid";
  return {
    monthEarningsCents,
    lifetimeCents: balance.earnedCents,
    paidCents: balance.paidCents,
    unpaidCents,
    lastPaymentAt,
    readySince: readySinceAt(events, payouts),
    paymentStatus,
    processing: flags.processing,
    held: flags.held,
    activity: events
      .filter((row) => row.advisorCents > 0 && utcMonthKey(row.at))
      .map((row) => ({ at: row.at, cents: row.advisorCents })),
  };
}

function payoutFlags(payouts: PayoutEvent[]) {
  let processing = false;
  let held = false;
  for (const row of payouts) {
    const label = payoutStatusLabel(row.status, row.workflow);
    const raw = String(row.status || "").trim().toLowerCase();
    if (label === "processing") processing = true;
    if (label === "rejected" || label === "pending" || raw === "failed" || raw === "held") held = true;
  }
  return { processing, held };
}

function readySinceAt(events: EarningEvent[], payouts: PayoutEvent[]) {
  const moves: { at: string; delta: number; id: string; order: number }[] = [];
  for (const event of events) {
    if (event.advisorCents <= 0 || !Number.isFinite(Date.parse(event.at))) continue;
    moves.push({ at: event.at, delta: event.advisorCents, id: event.id, order: 0 });
  }
  for (const payout of payouts) {
    if (payoutStatusLabel(payout.status, payout.workflow) !== "paid") continue;
    const cents = recordedPayoutCents(payout);
    const at = payout.paidAt || payout.createdAt;
    if (cents <= 0 || !Number.isFinite(Date.parse(at))) continue;
    moves.push({ at, delta: -cents, id: payout.id, order: 1 });
  }
  moves.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.order - b.order || a.id.localeCompare(b.id));
  let unpaid = 0;
  let since = "";
  let ready = false;
  for (const move of moves) {
    unpaid += move.delta;
    if (!ready && unpaid >= READY_UNPAID_CENTS) {
      ready = true;
      since = move.at;
    } else if (ready && unpaid < READY_UNPAID_CENTS) {
      ready = false;
      since = "";
    }
  }
  return since;
}

export function buildAdvisorEarningsBoard(
  input: { advisors: EarningsAdvisor[]; earnings: EarningEvent[]; payouts: PayoutEvent[] },
  now = new Date(),
) {
  const earnings = dedupedEarnings(input.earnings);
  const payouts = dedupedPayouts(input.payouts);
  const byAdvisor = new Map<string, { earnings: EarningEvent[]; payouts: PayoutEvent[] }>();
  for (const advisor of input.advisors) byAdvisor.set(advisor.id, { earnings: [], payouts: [] });
  for (const event of earnings) {
    const bucket = byAdvisor.get(event.advisorId);
    if (bucket) bucket.earnings.push(event);
  }
  for (const payout of payouts) {
    const bucket = byAdvisor.get(payout.advisorId);
    if (bucket) bucket.payouts.push(payout);
  }
  const rows = input.advisors.map((advisor) => {
    const bucket = byAdvisor.get(advisor.id) || { earnings: [], payouts: [] };
    const figures = advisorFigures(bucket.earnings, bucket.payouts, now);
    return {
      id: advisor.id,
      name: advisor.name,
      photoUrl: advisor.photoUrl,
      email: advisor.email,
      status: advisor.status,
      ...figures,
    };
  });
  const tracked = rows.filter((row) => row.lifetimeCents > 0 || row.paidCents > 0 || row.processing || row.held);
  const ready = tracked
    .filter((row) => row.unpaidCents >= READY_UNPAID_CENTS)
    .sort((a, b) => b.unpaidCents - a.unpaidCents || a.name.localeCompare(b.name));
  const seenPaid = new Set<string>();
  let paidThisMonthCents = 0;
  for (const payout of payouts) {
    if (seenPaid.has(payout.id)) continue;
    seenPaid.add(payout.id);
    if (payoutStatusLabel(payout.status, payout.workflow) !== "paid") continue;
    if (!inUtcMonth(payout.paidAt || payout.createdAt, now)) continue;
    paidThisMonthCents += recordedPayoutCents(payout);
  }
  const summary: EarningsSummary = {
    monthEarningsCents: rows.reduce((sum, row) => sum + row.monthEarningsCents, 0),
    unpaidCents: rows.reduce((sum, row) => sum + row.unpaidCents, 0),
    readyCount: ready.length,
    paidThisMonthCents,
  };
  return { summary, ready, listed: tracked.sort((a, b) => b.unpaidCents - a.unpaidCents || a.name.localeCompare(b.name)) };
}

export type EarningsCohort = "ready" | "below" | "paid" | "processing" | "held";
export type EarningsPeriod = "none" | "month" | "last" | "custom";

export function periodEarningsCents(activity: { at: string; cents: number }[], start: number, end: number) {
  return activity.reduce((sum, row) => {
    const stamp = Date.parse(row.at);
    if (!Number.isFinite(stamp) || stamp < start || stamp > end) return sum;
    return sum + whole(row.cents);
  }, 0);
}

export function earningsPeriodBounds(period: Exclude<EarningsPeriod, "none">, now: Date, from = "", to = "") {
  if (period === "month") {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1;
    return { start, end };
  }
  if (period === "last") {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1;
    return { start, end };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T23:59:59.999Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return { start, end };
}

export function filterEarningsList(
  rows: ReadyAdvisor[],
  input: { query?: string; cohort?: EarningsCohort; period?: EarningsPeriod; from?: string; to?: string },
  now = new Date(),
) {
  const query = String(input.query || "").trim().toLowerCase();
  const cohort = input.cohort || "ready";
  const period = input.period || "none";
  const bounds = period === "none" ? null : earningsPeriodBounds(period, now, input.from, input.to);
  const matched = rows.filter((row) => {
    if (query) {
      const blob = `${row.name} ${row.email} ${row.id}`.toLowerCase();
      if (!blob.includes(query)) return false;
    }
    if (cohort === "ready" && row.unpaidCents < READY_UNPAID_CENTS) return false;
    if (cohort === "below" && (row.lifetimeCents <= 0 || row.unpaidCents >= READY_UNPAID_CENTS)) return false;
    if (cohort === "paid" && !(row.paidCents > 0 && row.unpaidCents <= 0)) return false;
    if (cohort === "processing" && !row.processing) return false;
    if (cohort === "held" && !row.held) return false;
    if (bounds && periodEarningsCents(row.activity, bounds.start, bounds.end) <= 0) return false;
    return true;
  });
  return matched
    .map((row) => ({
      ...row,
      periodEarningsCents: bounds
        ? periodEarningsCents(row.activity, bounds.start, bounds.end)
        : row.monthEarningsCents,
    }))
    .sort((a, b) => b.unpaidCents - a.unpaidCents || a.name.localeCompare(b.name));
}

export function buildAdvisorEarningsDetail(
  input: {
    advisor: EarningsAdvisor;
    earnings: EarningEvent[];
    payouts: PayoutEvent[];
    month?: string;
  },
  now = new Date(),
): EarningsDetail {
  const earnings = dedupedEarnings(input.earnings).filter((row) => row.advisorId === input.advisor.id);
  const payouts = dedupedPayouts(input.payouts).filter((row) => row.advisorId === input.advisor.id);
  const figures = advisorFigures(earnings, payouts, now);
  const current = currentMonthKey(now);
  const monthTotals = new Map<string, number>();
  for (const event of earnings) {
    const key = utcMonthKey(event.at);
    if (!key) continue;
    monthTotals.set(key, (monthTotals.get(key) || 0) + event.advisorCents);
  }
  if (!monthTotals.has(current)) monthTotals.set(current, 0);
  const months = [...monthTotals.entries()]
    .map(([month, cents]) => ({ month, label: monthLabel(month), cents }))
    .sort((a, b) => b.month.localeCompare(a.month));
  const selected = months.some((row) => row.month === input.month) ? String(input.month) : current;
  const inMonth = earnings.filter((row) => utcMonthKey(row.at) === selected);
  const sumKind = (kind: EarningKind) => signedSum(inMonth.filter((row) => row.kind === kind).map((row) => row.advisorCents));
  const readingCents = sumKind("reading");
  const messageCents = sumKind("message");
  const tipCents = sumKind("tip");
  const otherCents = sumKind("other");
  const payments = [...payouts]
    .sort((a, b) => Date.parse(b.paidAt || b.createdAt) - Date.parse(a.paidAt || a.createdAt) || b.id.localeCompare(a.id))
    .map((row) => ({
      id: row.id,
      cents: recordedPayoutCents(row),
      at: row.paidAt || row.createdAt,
      method: row.method || "",
      referenceId: row.referenceId || "",
      status: payoutStatusLabel(row.status, row.workflow),
      note: row.note || "",
    }));
  return {
    advisor: input.advisor,
    ...figures,
    ready: figures.unpaidCents >= READY_UNPAID_CENTS,
    months,
    breakdown: {
      month: selected,
      label: monthLabel(selected),
      readingCents,
      messageCents,
      tipCents,
      otherCents,
      totalCents: readingCents + messageCents + tipCents + otherCents,
    },
    payments,
  };
}

export type AdvisorEarningPayment = {
  advisorId: string;
  amountCents: number;
  method: string;
  referenceId: string;
  note: string;
  requestId: string;
};

export function validateAdvisorEarningPayment(input: AdvisorEarningPayment): AdvisorEarningPayment {
  const advisorId = String(input.advisorId || "").trim();
  if (!advisorId || advisorId.length > 64) throw new Error("Choose an advisor.");
  const amountCents = Number(input.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Enter a payment amount greater than zero.");
  const method = String(input.method || "").trim();
  if (method.length < 2 || method.length > 40) throw new Error("Enter a payment method.");
  const referenceId = String(input.referenceId || "").trim();
  if (!referenceId || referenceId.length > 80) throw new Error("Enter the transaction or reference ID.");
  const note = String(input.note || "").trim().slice(0, 200);
  const requestId = String(input.requestId || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(requestId)) throw new Error("Payment could not be started. Try again.");
  return { advisorId, amountCents, method, referenceId, note, requestId };
}

export function earningPaymentKey(advisorId: string, requestId: string) {
  return `earn:${advisorId}:${requestId}`;
}

export const ADVISOR_EARNINGS_PAY_SQL = `
with locked as (
  select id, user_id
  from ora_advisors
  where id = $1
  for update
),
reading as (
  select coalesce(sum(greatest(r.advisor_earned, 0)), 0)::int as coins
  from ora_readings r
  where r.advisor_id = $1
    and r.status in ('ended', 'completed')
    and not exists (
      select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed'
    )
),
message as (
  select coalesce(sum(greatest(m.advisor_share_cents, 0)), 0)::int as cents
  from ora_paid_messages m
  where m.advisor_id = $1 and m.credited = true and m.coins > 0
),
tip as (
  select coalesce(sum(greatest(t.advisor_share_coins, 0)), 0)::int as coins
  from ora_customer_tips t
  where t.advisor_id = $1 and t.charged = true and t.credited = true
),
paid as (
  select coalesce(sum(cents), 0)::int as cents
  from (
    select distinct on (id)
      case
        when coalesce(amount_cents, 0) > 0 then amount_cents
        else greatest(coins, 0) * 10
      end as cents
    from ora_payouts
    where advisor_id = $1 and lower(coalesce(status, '')) = 'paid'
    order by id
  ) paid_rows
),
bal as (
  select
    (select coins from reading) * 10
    + (select cents from message)
    + (select coins from tip) * 10
    - (select cents from paid) as unpaid
),
dup as (
  select exists (
    select 1 from ora_payouts where idempotency_key = $7 and $7 <> ''
  ) as yes
),
ins as (
  insert into ora_payouts (
    id, user_id, advisor_id, coins, usd, status, currency, amount_cents,
    note, method, reference_id, idempotency_key, decided_at, approved_at, paid_at, workflow
  )
  select
    $2, locked.user_id, locked.id, ($3::int / 10), round($3::numeric / 100, 2), 'paid', $8, $3::int,
    $4, $5, $6, $7, now(), now(), now(), 'paid'
  from locked
  cross join bal
  cross join dup
  where bal.unpaid >= ${READY_UNPAID_CENTS}
    and $3::int > 0
    and $3::int <= bal.unpaid
    and dup.yes = false
  returning id, amount_cents
)
select
  exists(select 1 from locked) as found,
  (select unpaid from bal) as unpaid_before,
  (select yes from dup) as duplicate,
  (select id from ins) as payout_id,
  (select amount_cents from ins) as paid_cents
`;

function asBool(value: unknown) {
  if (typeof value === "boolean") return value;
  const name = String(value ?? "").trim().toLowerCase();
  return name === "t" || name === "true" || name === "1";
}

type PayRow = {
  found: boolean;
  unpaid_before: number | null;
  duplicate: boolean;
  payout_id: string | null;
  paid_cents: number | null;
};

export type RecordedEarningPayment = {
  payoutId: string;
  paidCents: number;
  unpaidBefore: number;
  unpaidAfter: number;
};

export async function payAdvisorEarnings(
  sql: { query<T>(text: string, params?: unknown[]): Promise<T[]> },
  input: AdvisorEarningPayment & { payoutId: string; currency?: string },
): Promise<RecordedEarningPayment> {
  const payment = validateAdvisorEarningPayment(input);
  const payoutId = String(input.payoutId || "").trim();
  if (!payoutId || payoutId.length > 64) throw new Error("Payment could not be started. Try again.");
  const currency = String(input.currency || "USD").trim().slice(0, 8) || "USD";
  const rows = await sql.query<PayRow>(ADVISOR_EARNINGS_PAY_SQL, [
    payment.advisorId,
    payoutId,
    payment.amountCents,
    payment.note,
    payment.method,
    payment.referenceId,
    earningPaymentKey(payment.advisorId, payment.requestId),
    currency,
  ]);
  const row = rows[0];
  const found = asBool(row?.found);
  const duplicate = asBool(row?.duplicate);
  const payoutIdSaved = String(row?.payout_id || "");
  if (!found) throw new Error("Advisor not found.");
  if (payoutIdSaved) {
    const paidCents = whole(row?.paid_cents);
    const unpaidBefore = Math.floor(Number(row?.unpaid_before) || 0);
    return { payoutId: payoutIdSaved, paidCents, unpaidBefore, unpaidAfter: unpaidBefore - paidCents };
  }
  if (duplicate) throw new Error("This payment was already recorded.");
  const unpaidBefore = Math.floor(Number(row?.unpaid_before) || 0);
  if (unpaidBefore < READY_UNPAID_CENTS) throw new Error("This advisor’s unpaid balance is under $50.");
  if (payment.amountCents > unpaidBefore) throw new Error("That amount is more than the unpaid advisor balance.");
  throw new Error("Could not record that payment.");
}

export function readingShareCents(coins: unknown) {
  return coinsToEarningCents(coins);
}

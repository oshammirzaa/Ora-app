/** Display helpers for admin payouts. Amounts stay in stored cents. Nothing here writes. */

export const CENTS_PER_COIN = 10;

export type PayoutStatus = "pending" | "processing" | "paid";

export type StoredPayout = {
  id: string;
  coins: number;
  amountCents?: number;
  status: string;
  workflow: string;
  paidAt: string;
  createdAt: string;
  note?: string;
};

export type AdvisorPayoutSource = {
  id: string;
  name: string;
  photoUrl: string;
  email: string;
  status: string;
  payoutCoins: number;
  pendingCoins: number;
  messageRemainderCents: number;
  paidMinutes: number;
  readingCents: number;
  messageCents: number;
  tipCents: number;
  /** Signed cents already outside the three earning buckets. Clawed sittings are not included here. */
  adjustmentCents?: number;
  payouts: StoredPayout[];
};

export type EarningSource = {
  id: string;
  at: string;
  customer: string;
  reference: string;
  type: "live reading" | "paid message" | "tip/gift";
  grossCents: number;
  advisorCents: number;
};

export type EarningHistoryRow = EarningSource & { payoutStatus: PayoutStatus };

export function whole(value: unknown) {
  const n = Math.floor(Number(value) || 0);
  return n > 0 ? n : 0;
}

export function coinsToEarningCents(coins: unknown) {
  return whole(coins) * CENTS_PER_COIN;
}

function signed(value: unknown) {
  const n = Math.floor(Number(value) || 0);
  return Number.isFinite(n) ? n : 0;
}

/** Same cash figure Finance uses for a payout: stored cents, otherwise coins at 10 cents each. */
export function recordedPayoutCents(row: { coins?: unknown; amountCents?: unknown }) {
  const amount = whole(row.amountCents);
  if (amount > 0) return amount;
  return coinsToEarningCents(row.coins);
}

export function payoutReducesBalance(status: unknown, workflow: unknown) {
  return payoutStatusLabel(status, workflow) === "paid";
}

export function payoutStatusLabel(status: unknown, workflow: unknown): PayoutStatus | "rejected" {
  const name = String(status || "").trim().toLowerCase();
  const flow = String(workflow || "").trim().toLowerCase();
  if (name === "paid") return "paid";
  if (name === "rejected") return "rejected";
  if (name === "processing" || flow === "processing") return "processing";
  return "pending";
}

export function isOpenPayout(status: unknown, workflow: unknown) {
  const label = payoutStatusLabel(status, workflow);
  return label === "pending" || label === "processing";
}

export function unpaidCents(input: {
  payoutCoins: unknown;
  pendingCoins: unknown;
  messageRemainderCents: unknown;
  openPayoutCoins: unknown;
}) {
  const coins = whole(input.payoutCoins) + whole(input.pendingCoins) + whole(input.openPayoutCoins);
  const remainder = whole(input.messageRemainderCents) % CENTS_PER_COIN;
  return coins * CENTS_PER_COIN + remainder;
}

export function paidMinuteValue(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export function paidMinutesLabel(seconds: unknown) {
  const total = whole(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}s`;
  if (rest === 0) return `${minutes} min`;
  return `${minutes} min ${rest}s`;
}

export function inUtcMonth(iso: unknown, now: Date) {
  const stamp = Date.parse(String(iso || ""));
  if (!Number.isFinite(stamp)) return false;
  const date = new Date(stamp);
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

export function availablePayoutCoins(payoutCoins: unknown) {
  const coins = whole(payoutCoins);
  if (coins <= 0) throw new Error("No available balance to pay.");
  return coins;
}

export function canMarkRequestPaid(status: unknown) {
  return String(status || "").trim().toLowerCase() === "requested";
}

/** Cover oldest stored earnings with recorded payout totals. Amounts are not changed. */
export function withPayoutStatus(
  earnings: EarningSource[],
  paidCents: number,
  processingCents: number,
): EarningHistoryRow[] {
  const ordered = [...earnings].sort((a, b) => {
    const delta = Date.parse(a.at) - Date.parse(b.at);
    if (delta !== 0 && Number.isFinite(delta)) return delta;
    return a.id.localeCompare(b.id);
  });
  let paidLeft = whole(paidCents);
  let processingLeft = whole(processingCents);
  const labeled = ordered.map((row) => {
    const amount = whole(row.advisorCents);
    const next = { ...row, grossCents: whole(row.grossCents), advisorCents: amount };
    if (amount === 0) return { ...next, payoutStatus: "pending" as const };
    if (paidLeft >= amount) {
      paidLeft -= amount;
      return { ...next, payoutStatus: "paid" as const };
    }
    if (paidLeft > 0) {
      processingLeft = Math.max(0, processingLeft - (amount - paidLeft));
      paidLeft = 0;
      return { ...next, payoutStatus: "processing" as const };
    }
    if (processingLeft > 0) {
      processingLeft = Math.max(0, processingLeft - amount);
      return { ...next, payoutStatus: "processing" as const };
    }
    return { ...next, payoutStatus: "pending" as const };
  });
  return labeled.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id));
}

export function advisorBalance(input: {
  readingCents: unknown;
  messageCents: unknown;
  tipCents: unknown;
  adjustmentCents?: unknown;
  payouts: Array<{ id?: string; status?: string; workflow?: string; coins?: unknown; amountCents?: unknown }>;
}) {
  const readingCents = whole(input.readingCents);
  const messageCents = whole(input.messageCents);
  const tipCents = whole(input.tipCents);
  const adjustmentCents = signed(input.adjustmentCents);
  const earnedCents = readingCents + messageCents + tipCents + adjustmentCents;
  const seen = new Set<string>();
  let paidCents = 0;
  for (const row of input.payouts) {
    const id = String(row.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (!payoutReducesBalance(row.status, row.workflow)) continue;
    paidCents += recordedPayoutCents(row);
  }
  return {
    readingCents,
    messageCents,
    tipCents,
    adjustmentCents,
    earnedCents,
    paidCents,
    pendingCents: earnedCents - paidCents,
  };
}

export function buildAdvisorPayout(input: AdvisorPayoutSource, now = new Date()) {
  const payouts = input.payouts.map((row) => ({
    ...row,
    coins: whole(row.coins),
    amountCents: whole(row.amountCents),
    label: payoutStatusLabel(row.status, row.workflow),
  }));
  const balance = advisorBalance({
    readingCents: input.readingCents,
    messageCents: input.messageCents,
    tipCents: input.tipCents,
    adjustmentCents: input.adjustmentCents,
    payouts,
  });
  const open = payouts.filter((row) => row.label === "pending" || row.label === "processing");
  const paid = payouts.filter((row) => row.label === "paid");
  const seenPaid = new Set<string>();
  const uniquePaid = paid.filter((row) => {
    if (seenPaid.has(row.id)) return false;
    seenPaid.add(row.id);
    return true;
  });
  const openCoins = open.reduce((sum, row) => sum + row.coins, 0);
  const owedCents = unpaidCents({
    payoutCoins: input.payoutCoins,
    pendingCoins: input.pendingCoins,
    messageRemainderCents: input.messageRemainderCents,
    openPayoutCoins: openCoins,
  });
  const processing = open.some((row) => row.label === "processing");
  const requested = open.some((row) => row.label === "pending");
  const payoutStatus: PayoutStatus | "none" = processing
    ? "processing"
    : requested || owedCents > 0
      ? "pending"
      : uniquePaid.length > 0
        ? "paid"
        : "none";
  const balanceStatus: PayoutStatus | "none" =
    balance.pendingCents > 0 ? "pending" : balance.paidCents > 0 ? "paid" : "none";
  const lastPaid = uniquePaid
    .map((row) => row.paidAt || row.createdAt)
    .filter((iso) => Number.isFinite(Date.parse(iso)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "";
  const paidThisMonthCents = uniquePaid
    .filter((row) => inUtcMonth(row.paidAt || row.createdAt, now))
    .reduce((sum, row) => sum + recordedPayoutCents(row), 0);
  return {
    id: input.id,
    name: input.name,
    photoUrl: input.photoUrl,
    email: input.email,
    status: input.status,
    paidMinutes: paidMinuteValue(input.paidMinutes),
    readingCents: balance.readingCents,
    messageCents: balance.messageCents,
    tipCents: balance.tipCents,
    adjustmentCents: balance.adjustmentCents,
    lifetimeCents: balance.earnedCents,
    paidCents: balance.paidCents,
    pendingBalanceCents: balance.pendingCents,
    owedCents,
    availableCoins: whole(input.payoutCoins),
    holdCoins: whole(input.pendingCoins),
    openCoins,
    lastPayoutAt: lastPaid,
    payoutStatus,
    balanceStatus,
    paidThisMonthCents,
    requests: open.map((row) => ({
      id: row.id,
      coins: row.coins,
      createdAt: row.createdAt,
      label: row.label,
    })),
  };
}

export function payoutBoardSummary(
  advisors: Array<{ owedCents: number; openCoins: number; paidThisMonthCents: number }>,
) {
  return {
    owedCents: advisors.reduce((sum, row) => sum + whole(row.owedCents), 0),
    pendingPayoutCents: coinsToEarningCents(advisors.reduce((sum, row) => sum + whole(row.openCoins), 0)),
    paidThisMonthCents: advisors.reduce((sum, row) => sum + whole(row.paidThisMonthCents), 0),
    advisorsWithUnpaid: advisors.filter((row) => whole(row.owedCents) > 0).length,
  };
}

export type AdvisorEarningsTotals = {
  lifetimeCents: number;
  paidCents: number;
  pendingBalanceCents: number;
};

export function advisorEarningsSummary(advisors: AdvisorEarningsTotals[]) {
  const earnedCents = advisors.reduce((sum, row) => sum + signed(row.lifetimeCents), 0);
  const paidOutCents = advisors.reduce((sum, row) => sum + whole(row.paidCents), 0);
  const pendingBalanceCents = advisors.reduce((sum, row) => sum + signed(row.pendingBalanceCents), 0);
  return {
    earnedCents,
    paidOutCents,
    pendingBalanceCents,
    advisorsWithPending: advisors.filter((row) => signed(row.pendingBalanceCents) > 0).length,
    pendingMatches: pendingBalanceCents === earnedCents - paidOutCents,
  };
}

export type AdvisorListFilter = "all" | "pending" | "paid" | "none";
export type AdvisorListSort = "pending" | "lifetime" | "recent" | "name";

export function filterAdvisorEarnings<
  T extends {
    id: string;
    name: string;
    email: string;
    lifetimeCents: number;
    paidCents: number;
    pendingBalanceCents: number;
    lastPayoutAt: string;
  },
>(rows: T[], input: { query?: string; filter?: AdvisorListFilter; sort?: AdvisorListSort }) {
  const query = String(input.query || "").trim().toLowerCase();
  const filter = input.filter || "all";
  const matched = rows.filter((row) => {
    if (query) {
      const blob = `${row.name} ${row.email} ${row.id}`.toLowerCase();
      if (!blob.includes(query)) return false;
    }
    if (filter === "pending") return row.pendingBalanceCents > 0;
    if (filter === "paid") return row.paidCents > 0 && row.pendingBalanceCents <= 0;
    if (filter === "none") return row.lifetimeCents === 0 && row.paidCents === 0;
    return true;
  });
  const sorted = [...matched];
  const sort = input.sort || "pending";
  sorted.sort((a, b) => {
    if (sort === "lifetime") return b.lifetimeCents - a.lifetimeCents || a.name.localeCompare(b.name);
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "recent") {
      const aAt = Date.parse(a.lastPayoutAt || "");
      const bAt = Date.parse(b.lastPayoutAt || "");
      const aOk = Number.isFinite(aAt);
      const bOk = Number.isFinite(bAt);
      if (aOk && bOk && aAt !== bAt) return bAt - aAt;
      if (aOk !== bOk) return aOk ? -1 : 1;
      return a.name.localeCompare(b.name);
    }
    return b.pendingBalanceCents - a.pendingBalanceCents || a.name.localeCompare(b.name);
  });
  return sorted;
}

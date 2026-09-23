import { panelSplit } from "./ora-split.ts";
import { CHAT_MESSAGE_WORD_LIMIT, countMessageWords } from "./ora-chat-words.ts";

export const LIFETIME_FREE_CUSTOMER_MESSAGES = 3;
export const PAID_CUSTOMER_MESSAGE_COINS = 2;
/** Matches Ora's existing 10 coins = $1 accounting. */
export const PAID_MESSAGE_COINS_PER_DOLLAR = 10;

export type CustomerMessageQuote = {
  coins: number;
  free: boolean;
  remainingFree: number;
};

export function remainingFreeCustomerMessages(freeUsed: number) {
  const used = Math.max(0, Math.floor(Number(freeUsed) || 0));
  return Math.max(0, LIFETIME_FREE_CUSTOMER_MESSAGES - used);
}

export function customerMessageQuote(freeUsed: number): CustomerMessageQuote {
  const remainingFree = remainingFreeCustomerMessages(freeUsed);
  if (remainingFree > 0) return { coins: 0, free: true, remainingFree };
  return { coins: PAID_CUSTOMER_MESSAGE_COINS, free: false, remainingFree: 0 };
}

export function remainingFreeLabel(remainingFree: number) {
  const n = Math.max(0, Math.floor(Number(remainingFree) || 0));
  if (n <= 0) return "";
  if (n === 1) return "1 free message left";
  return `${n} free messages left`;
}

export function customerMessageNotice(remainingFree: number) {
  if (remainingFree > 0) {
    return {
      kind: "free" as const,
      intro: "Your first 3 messages with this advisor are free. After that, each message costs 2 coins.",
      remaining: remainingFreeLabel(remainingFree),
    };
  }
  return {
    kind: "paid" as const,
    intro: "2 coins per message",
    remaining: "",
  };
}

export function needsFirstPaidConfirm(input: { remainingFree: number; paidNoticeSeen: boolean }) {
  return input.remainingFree <= 0 && !input.paidNoticeSeen;
}

export function paidMessageSplit(coins: number) {
  const c = Math.max(0, Math.floor(Number(coins) || 0));
  const advisorShare = Math.floor(c / 2);
  return { advisorShare, oraShare: c - advisorShare };
}

export function coinsToCents(coins: number, coinsPerDollar = PAID_MESSAGE_COINS_PER_DOLLAR) {
  const per = Math.max(1, Number(coinsPerDollar) || PAID_MESSAGE_COINS_PER_DOLLAR);
  return Math.round((Math.max(0, Number(coins) || 0) / per) * 100);
}

export function canChargePaidMessage(balance: number) {
  return Math.max(0, Math.floor(Number(balance) || 0)) >= PAID_CUSTOMER_MESSAGE_COINS;
}

export function liveReadingSplitUnchanged(coins: number) {
  return panelSplit(coins);
}

export function claimLifetimeFreeSlot(freeUsed: number, cap = LIFETIME_FREE_CUSTOMER_MESSAGES) {
  const used = Math.max(0, Math.floor(Number(freeUsed) || 0));
  const limit = Math.max(0, Math.floor(Number(cap) || 0));
  if (used >= limit) return { ok: false as const, freeUsed: used };
  return { ok: true as const, freeUsed: used + 1 };
}

/** Advisor inbox only. Free, promo, and zero-coin messages stay unmarked. */
export function messageShowsAdvisorCoin(role: string, coins: unknown) {
  if (String(role || "") !== "customer") return false;
  return Math.floor(Number(coins) || 0) > 0;
}

export type PaidMessageFact = {
  requestId: string;
  messageId: string;
  customerId: string;
  customerName: string;
  at: string;
  coins: number;
  advisorShare: number;
  oraShare: number;
};

export type MessageEarningHistoryRow = {
  at: string;
  customerId: string;
  customerName: string;
  paidCount: number;
  charged: number;
  advisorShare: number;
};

export type MessageEarningsSummary = {
  paidMessages: number;
  exchanges: number;
  charged: number;
  advisorEarnings: number;
  oraShare: number;
  todayPaidMessages: number;
  todayEarnings: number;
  history: MessageEarningHistoryRow[];
};

function wholeCoins(value: unknown) {
  const n = Math.floor(Number(value) || 0);
  return n > 0 ? n : 0;
}

/** Ignore a second credit for the same request or message. Zero-coin rows never earn. */
export function appendPaidMessageCredit(ledger: PaidMessageFact[], entry: PaidMessageFact) {
  const coins = wholeCoins(entry.coins);
  if (coins <= 0) return ledger;
  if (ledger.some((row) => row.requestId === entry.requestId || row.messageId === entry.messageId)) return ledger;
  const split = paidMessageSplit(coins);
  return [
    ...ledger,
    {
      ...entry,
      coins,
      advisorShare: split.advisorShare,
      oraShare: split.oraShare,
    },
  ];
}

export function summarizeMessageEarnings(input: {
  paid: Array<Omit<PaidMessageFact, "requestId" | "messageId"> & { requestId?: string; messageId?: string }>;
  exchanges: number;
  now?: Date;
}): MessageEarningsSummary {
  const now = input.now ?? new Date();
  const todayFrom = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const groups = new Map<string, MessageEarningHistoryRow>();
  let paidMessages = 0;
  let charged = 0;
  let advisorEarnings = 0;
  let oraShare = 0;
  let todayPaidMessages = 0;
  let todayEarnings = 0;

  for (const row of input.paid) {
    const coins = wholeCoins(row.coins);
    if (coins <= 0) continue;
    const advisor = wholeCoins(row.advisorShare);
    const ora = wholeCoins(row.oraShare);
    const at = String(row.at || "");
    const stamp = new Date(at).getTime();
    paidMessages += 1;
    charged += coins;
    advisorEarnings += advisor;
    oraShare += ora;
    if (Number.isFinite(stamp) && stamp >= todayFrom && stamp <= now.getTime()) {
      todayPaidMessages += 1;
      todayEarnings += advisor;
    }
    const day = Number.isFinite(stamp) ? new Date(stamp).toISOString().slice(0, 10) : "";
    const customerId = String(row.customerId || "");
    const key = `${day}:${customerId}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        at,
        customerId,
        customerName: String(row.customerName || "Client"),
        paidCount: 1,
        charged: coins,
        advisorShare: advisor,
      });
    } else {
      current.paidCount += 1;
      current.charged += coins;
      current.advisorShare += advisor;
      if (stamp > new Date(current.at).getTime()) current.at = at;
    }
  }

  return {
    paidMessages,
    exchanges: wholeCoins(input.exchanges),
    charged,
    advisorEarnings,
    oraShare,
    todayPaidMessages,
    todayEarnings,
    history: [...groups.values()].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  };
}

export type SimulatedMessage = {
  requestId: string;
  advisorId: string;
  role: "customer" | "advisor";
  coins: number;
  body: string;
};

export type SimulatedLedger = {
  requestId: string;
  advisorId: string;
  coins: number;
  advisorShare: number;
  oraShare: number;
  amountCents: number;
};

export type SimulatedPair = {
  freeUsed: number;
  paidSent: number;
  paidNoticeSeen: boolean;
};

export type SimulatedState = {
  wallet: number;
  pairs: Record<string, SimulatedPair>;
  messages: SimulatedMessage[];
  ledger: SimulatedLedger[];
  lastReject?: "insufficient" | "confirm" | "empty" | "words" | "";
};

export function emptySimulatedState(wallet = 20): SimulatedState {
  return { wallet, pairs: {}, messages: [], ledger: [], lastReject: "" };
}

export function pairAllowance(state: SimulatedState, advisorId: string): SimulatedPair {
  return state.pairs[advisorId] || { freeUsed: 0, paidSent: 0, paidNoticeSeen: false };
}

export function applySimulatedSend(
  state: SimulatedState,
  input: {
    advisorId: string;
    requestId: string;
    body: string;
    role?: "customer" | "advisor";
    confirmPaid?: boolean;
  },
): SimulatedState {
  if (!String(input.body || "").trim()) return { ...state, lastReject: "empty" };
  if (input.role !== "advisor" && countMessageWords(input.body) > CHAT_MESSAGE_WORD_LIMIT) {
    return { ...state, lastReject: "words" };
  }
  if (state.messages.some((m) => m.requestId === input.requestId)) return { ...state, lastReject: "" };
  if (input.role === "advisor") {
    return {
      ...state,
      lastReject: "",
      messages: [
        ...state.messages,
        { requestId: input.requestId, advisorId: input.advisorId, role: "advisor", coins: 0, body: input.body },
      ],
    };
  }
  const pair = pairAllowance(state, input.advisorId);
  const quote = customerMessageQuote(pair.freeUsed);
  if (quote.free) {
    return {
      ...state,
      lastReject: "",
      pairs: { ...state.pairs, [input.advisorId]: { ...pair, freeUsed: pair.freeUsed + 1 } },
      messages: [
        ...state.messages,
        { requestId: input.requestId, advisorId: input.advisorId, role: "customer", coins: 0, body: input.body },
      ],
    };
  }
  if (!pair.paidNoticeSeen && !input.confirmPaid) {
    return { ...state, lastReject: "confirm" };
  }
  if (!canChargePaidMessage(state.wallet)) {
    return {
      ...state,
      lastReject: "insufficient",
      pairs: { ...state.pairs, [input.advisorId]: { ...pair, paidNoticeSeen: true } },
    };
  }
  const split = paidMessageSplit(PAID_CUSTOMER_MESSAGE_COINS);
  return {
    wallet: state.wallet - PAID_CUSTOMER_MESSAGE_COINS,
    lastReject: "",
    pairs: {
      ...state.pairs,
      [input.advisorId]: { freeUsed: pair.freeUsed, paidSent: pair.paidSent + 1, paidNoticeSeen: true },
    },
    messages: [
      ...state.messages,
      {
        requestId: input.requestId,
        advisorId: input.advisorId,
        role: "customer",
        coins: PAID_CUSTOMER_MESSAGE_COINS,
        body: input.body,
      },
    ],
    ledger: [
      ...state.ledger,
      {
        requestId: input.requestId,
        advisorId: input.advisorId,
        coins: PAID_CUSTOMER_MESSAGE_COINS,
        advisorShare: split.advisorShare,
        oraShare: split.oraShare,
        amountCents: coinsToCents(PAID_CUSTOMER_MESSAGE_COINS),
      },
    ],
  };
}

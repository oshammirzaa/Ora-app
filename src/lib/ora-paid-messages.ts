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

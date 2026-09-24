export const TIP_ADVISOR_PCT = 50;
export const TIP_ORA_PCT = 50;

export const TIP_GIFTS = [
  { id: "flower", name: "Flower", coins: 10, image: "/tips/flower.jpg" },
  { id: "moon", name: "Moon", coins: 30, image: "/tips/moon.jpg" },
  { id: "crystal", name: "Crystal", coins: 50, image: "/tips/crystal.jpg" },
  { id: "cards", name: "Psychic Cardz", coins: 100, image: "/tips/cards.jpg" },
  { id: "angel", name: "Angel", coins: 200, image: "/tips/angel.jpg" },
] as const;

export type TipGiftId = (typeof TIP_GIFTS)[number]["id"];

export function tipGift(id: unknown) {
  const key = String(id || "").trim().toLowerCase();
  return TIP_GIFTS.find((gift) => gift.id === key) || null;
}

/** Whole coins only. Advisor 50%, Ora the remainder, so the two shares always equal the price. */
export function tipSplit(coins: number) {
  const amount = Math.max(0, Math.floor(Number(coins) || 0));
  const advisorShare = Math.floor((amount * TIP_ADVISOR_PCT) / 100);
  const oraShare = amount - advisorShare;
  return { coins: amount, advisorShare, oraShare };
}

export function tipMessageBody(giftId: unknown) {
  const gift = tipGift(giftId);
  if (!gift) return "";
  return `Sent a ${gift.name} · ${gift.coins} coins`;
}

export type SimulatedTip = {
  requestId: string;
  gift: TipGiftId;
  coins: number;
  advisorShare: number;
  oraShare: number;
};

export type SimulatedTipState = {
  wallet: number;
  advisor: number;
  ora: number;
  tips: SimulatedTip[];
  lastReject: string;
  duplicate: boolean;
};

export function emptyTipState(wallet: number): SimulatedTipState {
  return { wallet, advisor: 0, ora: 0, tips: [], lastReject: "", duplicate: false };
}

/** Mirrors the server rule: one request id charges once, a failed send does not move coins. */
export function applySimulatedTip(
  state: SimulatedTipState,
  input: { requestId: string; gift: string; fail?: boolean },
): SimulatedTipState {
  const requestId = String(input.requestId || "").trim();
  if (!requestId) return { ...state, lastReject: "Missing tip request.", duplicate: false };
  const prior = state.tips.find((tip) => tip.requestId === requestId);
  if (prior) return { ...state, lastReject: "", duplicate: true };
  if (input.fail) return { ...state, lastReject: "failed", duplicate: false };
  const gift = tipGift(input.gift);
  if (!gift) return { ...state, lastReject: "Choose a tip.", duplicate: false };
  const split = tipSplit(gift.coins);
  if (split.advisorShare + split.oraShare !== split.coins) {
    return { ...state, lastReject: "Tip split is invalid.", duplicate: false };
  }
  if (state.wallet < gift.coins) return { ...state, lastReject: "Not enough coins for this tip.", duplicate: false };
  return {
    wallet: state.wallet - gift.coins,
    advisor: state.advisor + split.advisorShare,
    ora: state.ora + split.oraShare,
    tips: [
      ...state.tips,
      {
        requestId,
        gift: gift.id,
        coins: gift.coins,
        advisorShare: split.advisorShare,
        oraShare: split.oraShare,
      },
    ],
    lastReject: "",
    duplicate: false,
  };
}

export type TipEarningRow = {
  id: string;
  customerId: string;
  customerName: string;
  advisorId: string;
  advisorName: string;
  gift: string;
  giftName: string;
  coins: number;
  advisorShare: number;
  oraShare: number;
  at: string;
  status?: "completed";
};

export type TipEarnings = {
  count: number;
  todayCount: number;
  coins: number;
  advisorShare: number;
  oraShare: number;
  todayCoins: number;
  todayAdvisorShare: number;
  history: TipEarningRow[];
};

export function emptyTipEarnings(): TipEarnings {
  return {
    count: 0,
    todayCount: 0,
    coins: 0,
    advisorShare: 0,
    oraShare: 0,
    todayCoins: 0,
    todayAdvisorShare: 0,
    history: [],
  };
}

/** One report for advisor statistics and admin finance. Only whole 50/50 tips count. */
export function summarizeTips(rows: TipEarningRow[], now = new Date()): TipEarnings {
  const todayFrom = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const history = rows
    .map((row) => {
      const gift = tipGift(row.gift);
      const coins = Math.max(0, Math.floor(Number(row.coins) || 0));
      const advisorShare = Math.max(0, Math.floor(Number(row.advisorShare) || 0));
      const oraShare = Math.max(0, Math.floor(Number(row.oraShare) || 0));
      return {
        ...row,
        gift: gift?.id || String(row.gift || ""),
        giftName: gift?.name || String(row.giftName || row.gift || "Tip"),
        coins,
        advisorShare,
        oraShare,
        at: String(row.at || ""),
        status: "completed" as const,
      };
    })
    .filter((row) => {
      const split = tipSplit(row.coins);
      return row.coins > 0 && row.advisorShare === split.advisorShare && row.oraShare === split.oraShare;
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  let coins = 0;
  let advisorShare = 0;
  let oraShare = 0;
  let todayCount = 0;
  let todayCoins = 0;
  let todayAdvisorShare = 0;
  for (const row of history) {
    coins += row.coins;
    advisorShare += row.advisorShare;
    oraShare += row.oraShare;
    const stamp = Date.parse(row.at);
    if (Number.isFinite(stamp) && stamp >= todayFrom && stamp <= now.getTime()) {
      todayCount += 1;
      todayCoins += row.coins;
      todayAdvisorShare += row.advisorShare;
    }
  }
  return {
    count: history.length,
    todayCount,
    coins,
    advisorShare,
    oraShare,
    todayCoins,
    todayAdvisorShare,
    history: history.slice(0, 80),
  };
}

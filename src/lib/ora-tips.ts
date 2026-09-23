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

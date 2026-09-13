export const ADVISOR_SHARE_PCT = 20;
export const PLATFORM_SHARE_PCT = 80;
export const PLATFORM_SHARE_MAX = 90;

/** Advisor 20% / Ora house 80%. 20 coins → advisor 4, house 16. */
export function splitCoins(coins: number, platformSharePct = PLATFORM_SHARE_PCT) {
  const c = Math.max(0, Math.floor(Number(coins) || 0));
  const pct = Math.min(
    PLATFORM_SHARE_MAX,
    Math.max(0, Math.floor(Number(platformSharePct) || PLATFORM_SHARE_PCT)),
  );
  const advisorEarned = Math.floor((c * (100 - pct)) / 100);
  return { advisorEarned, platformFee: c - advisorEarned };
}

export function panelSplit(coins: number) {
  const split = splitCoins(coins);
  return { advisorEarnings: split.advisorEarned, platformRevenue: split.platformFee };
}

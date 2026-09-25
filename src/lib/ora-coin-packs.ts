export type CatalogPack = {
  id: string;
  name: string;
  coins: number;
  amountCents: number;
  sortOrder: number;
};

const STANDARD_USD = [2, 5, 10, 20] as const;
const KEPT_USD = [
  { id: "500", usd: 50, sortOrder: 10 },
  { id: "1000", usd: 100, sortOrder: 20 },
  { id: "2500", usd: 250, sortOrder: 30 },
  { id: "5000", usd: 500, sortOrder: 40 },
] as const;

/** Packs follow the caller’s existing coins-per-dollar rate. The client never supplies the coin count. */
export function coinPackCatalog(coinsPerDollar: number): CatalogPack[] {
  const rate = Math.max(1, Math.floor(Number(coinsPerDollar) || 0));
  const standard = STANDARD_USD.map((usd, index) => {
    const coins = usd * rate;
    return {
      id: `usd${usd}`,
      name: `$${usd} · ${coins} coins`,
      coins,
      amountCents: usd * 100,
      sortOrder: index + 1,
    };
  });
  const kept = KEPT_USD.map((pack) => {
    const coins = pack.usd * rate;
    return {
      id: pack.id,
      name: `${coins.toLocaleString("en-US")} coins`,
      coins,
      amountCents: pack.usd * 100,
      sortOrder: pack.sortOrder,
    };
  });
  return [...standard, ...kept];
}

/** Coins credited for a verified charge. Returns null when the paid amount is not that package. */
export function verifiedPurchaseCoins(packId: string, amountCents: number, coinsPerDollar: number): number | null {
  const paid = Math.round(Number(amountCents));
  const pack = coinPackCatalog(coinsPerDollar).find((row) => row.id === packId);
  if (!pack || pack.amountCents !== paid) return null;
  return pack.coins;
}

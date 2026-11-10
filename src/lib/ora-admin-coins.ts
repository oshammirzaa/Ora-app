/** Pure wallet math for owner coin adjustments. Nothing here writes. */

export type CoinDirection = "add" | "deduct";

export function previewCoinChange(current: number, direction: CoinDirection, amount: number) {
  const balance = Math.floor(Number(current));
  const coins = Math.floor(Number(amount));
  if (!Number.isInteger(balance) || balance < 0) throw new Error("Wallet balance is unavailable.");
  if (!Number.isInteger(coins) || coins < 1 || coins > 5000) {
    throw new Error("Enter a coin amount between 1 and 5000.");
  }
  if (direction !== "add" && direction !== "deduct") throw new Error("Choose add or deduct.");
  const delta = direction === "add" ? coins : -coins;
  const next = balance + delta;
  if (next < 0) throw new Error("Cannot deduct more than the available balance.");
  return { previous: balance, delta, next, direction, coins };
}

export function coinIdempotencyKey(userId: string, requestId: string) {
  const id = String(userId || "").trim();
  const request = String(requestId || "").trim();
  if (!id || id.length > 128) throw new Error("Choose a customer.");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(request)) throw new Error("Adjustment could not be started. Try again.");
  return `coin:${id}:${request}`;
}

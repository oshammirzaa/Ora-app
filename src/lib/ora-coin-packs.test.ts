import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { coinPackCatalog, verifiedPurchaseCoins } from "./ora-coin-packs.ts";

describe("coin packs use the existing coins-per-dollar rate", () => {
  it("prices $2, $5, $10, and $20 at 10 coins per dollar", () => {
    const ora = readFileSync(new URL("./ora.ts", import.meta.url), "utf8");
    const rate = Number(ora.match(/export const COINS_PER_DOLLAR = (\d+)/)?.[1]);
    assert.equal(rate, 10);
    const packs = coinPackCatalog(rate);
    const standard = packs.filter((pack) => pack.id.startsWith("usd"));
    assert.deepEqual(
      standard.map((pack) => [pack.id, pack.amountCents, pack.coins]),
      [
        ["usd2", 200, 20],
        ["usd5", 500, 50],
        ["usd10", 1000, 100],
        ["usd20", 2000, 200],
      ],
    );
    assert.deepEqual(
      packs.filter((pack) => !pack.id.startsWith("usd")).map((pack) => [pack.id, pack.amountCents, pack.coins]),
      [
        ["500", 5000, 500],
        ["1000", 10000, 1000],
        ["2500", 25000, 2500],
        ["5000", 50000, 5000],
      ],
    );
  });

  it("credits only the server catalog amount for a verified payment", () => {
    assert.equal(verifiedPurchaseCoins("usd2", 200, 10), 20);
    assert.equal(verifiedPurchaseCoins("usd5", 500, 10), 50);
    assert.equal(verifiedPurchaseCoins("usd10", 1000, 10), 100);
    assert.equal(verifiedPurchaseCoins("usd20", 2000, 10), 200);
    assert.equal(verifiedPurchaseCoins("usd2", 100, 10), null);
    assert.equal(verifiedPurchaseCoins("usd20", 2000, 10), 200);
    assert.equal(verifiedPurchaseCoins("nope", 200, 10), null);
    const server = readFileSync(new URL("./ora-pay.server.ts", import.meta.url), "utf8");
    const pay = readFileSync(new URL("../routes/api/pay.ts", import.meta.url), "utf8");
    assert.match(server, /verifiedPurchaseCoins/);
    assert.match(server, /status === "failed" \|\| row.status === "cancelled"/);
    assert.match(server, /kind = 'purchase' and ref_id/);
    assert.match(server, /ora_webhook_events/);
    assert.match(server, /amount_total/);
    assert.doesNotMatch(pay, /data\.coins/);
    assert.match(pay, /packId/);
  });
});

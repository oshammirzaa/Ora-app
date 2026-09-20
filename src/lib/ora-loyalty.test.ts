import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOYALTY_COPY,
  LOYALTY_DIAMOND_CENTS,
  LOYALTY_GOLD_CENTS,
  LOYALTY_ROYAL_CENTS,
  LOYALTY_SILVER_CENTS,
  loyaltyLabel,
  loyaltySpendCents,
  loyaltyTierFromCents,
  loyaltyTierPublic,
} from "./ora-loyalty.ts";

describe("loyalty thresholds", () => {
  it("has no badge below $50", () => {
    assert.equal(loyaltyTierFromCents(0), "none");
    assert.equal(loyaltyTierFromCents(1), "none");
    assert.equal(loyaltyTierFromCents(LOYALTY_SILVER_CENTS - 1), "none");
    assert.equal(loyaltyTierFromCents(4999), "none");
  });

  it("awards silver from $50 through $199.99", () => {
    assert.equal(loyaltyTierFromCents(LOYALTY_SILVER_CENTS), "silver");
    assert.equal(loyaltyTierFromCents(12_000), "silver");
    assert.equal(loyaltyTierFromCents(LOYALTY_GOLD_CENTS - 1), "silver");
  });

  it("awards gold from $200 through $499.99", () => {
    assert.equal(loyaltyTierFromCents(LOYALTY_GOLD_CENTS), "gold");
    assert.equal(loyaltyTierFromCents(32_000), "gold");
    assert.equal(loyaltyTierFromCents(LOYALTY_DIAMOND_CENTS - 1), "gold");
  });

  it("awards diamond from $500 through $1,999.99", () => {
    assert.equal(loyaltyTierFromCents(LOYALTY_DIAMOND_CENTS), "diamond");
    assert.equal(loyaltyTierFromCents(199_999), "diamond");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS - 1), "diamond");
  });

  it("uses gender only at $2,000+ and never guesses", () => {
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "male"), "king");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "man"), "king");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "m"), "king");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "female"), "queen");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "woman"), "queen");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "f"), "queen");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "nonbinary"), "crown");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "nb"), "crown");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, ""), "crown");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "unspecified"), "crown");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS), "crown");
    assert.equal(loyaltyTierFromCents(LOYALTY_ROYAL_CENTS, "alien"), "crown");
    assert.equal(loyaltyTierFromCents(12_000, "female"), "silver");
    assert.equal(loyaltyTierFromCents(80_000, "male"), "diamond");
  });

  it("treats invalid cents as zero", () => {
    assert.equal(loyaltyTierFromCents(Number.NaN), "none");
    assert.equal(loyaltyTierFromCents(-5000), "none");
    assert.equal(loyaltyTierFromCents("nope"), "none");
    assert.equal(loyaltyTierFromCents(undefined), "none");
  });
});

describe("lifetime spend from payments", () => {
  it("counts only succeeded USD rows", () => {
    assert.equal(
      loyaltySpendCents([
        { amount_cents: 5000, status: "succeeded", currency: "USD" },
        { amount_cents: 2500, status: "succeeded", currency: "usd" },
        { amount_cents: 9999, status: "refunded", currency: "USD" },
        { amount_cents: 4000, status: "failed", currency: "USD" },
        { amount_cents: 4000, status: "cancelled", currency: "USD" },
        { amount_cents: 4000, status: "pending", currency: "USD" },
        { amount_cents: 4000, status: "created", currency: "USD" },
        { amount_cents: 8000, status: "succeeded", currency: "EUR" },
      ]),
      7500,
    );
  });

  it("deducts refunds because refunded rows leave the succeeded set", () => {
    const before = [
      { amount_cents: 50_000, status: "succeeded", currency: "USD" },
      { amount_cents: 5_000, status: "succeeded", currency: "USD" },
    ];
    assert.equal(loyaltySpendCents(before), 55_000);
    assert.equal(loyaltyTierFromCents(loyaltySpendCents(before)), "diamond");
    const afterFullRefund = [
      { amount_cents: 50_000, status: "refunded", currency: "USD" },
      { amount_cents: 5_000, status: "succeeded", currency: "USD" },
    ];
    assert.equal(loyaltySpendCents(afterFullRefund), 5_000);
    assert.equal(loyaltyTierFromCents(loyaltySpendCents(afterFullRefund)), "silver");
  });

  it("does not subtract refunded rows on top of succeeded (would double-count a status flip)", () => {
    const rows = [
      { amount_cents: 5000, status: "succeeded" },
      { amount_cents: 5000, status: "refunded" },
    ];
    assert.equal(loyaltySpendCents(rows), 5000);
  });

  it("ignores non-payment amounts such as gifts", () => {
    assert.equal(loyaltySpendCents([{ amount_cents: 0, status: "succeeded" }]), 0);
    assert.equal(loyaltySpendCents([{ amountCents: 25000, status: "succeeded" }]), 25000);
  });
});

describe("loyalty copy", () => {
  it("keeps advisor-facing labels free of dollar totals", () => {
    assert.equal(loyaltyLabel("silver"), "Silver · A Valued Client");
    assert.equal(loyaltyLabel("gold"), "Gold · A Loyal Client");
    assert.equal(loyaltyLabel("diamond"), "Diamond · A VIP Client");
    assert.equal(loyaltyLabel("king"), "King · Top Client");
    assert.equal(loyaltyLabel("queen"), "Queen · Top Client");
    assert.equal(loyaltyLabel("crown"), "Crown · Top Client");
    assert.equal(loyaltyLabel("none"), "No badge");
    assert.equal(loyaltyTierPublic({ tier: "gold", spendCents: 245000, gender: "female" }), "gold");
    assert.equal(LOYALTY_COPY.queen.subtitle, "Top Client");
  });
});

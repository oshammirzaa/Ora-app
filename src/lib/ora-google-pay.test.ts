import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCheckoutWallet, walletFromCheckoutSession, walletLabel } from "./ora-google-pay.ts";

describe("Google Pay checkout", () => {
  it("asks Stripe Checkout for card wallets without changing the amount", () => {
    const body = new URLSearchParams();
    body.set("line_items[0][price_data][unit_amount]", "1000");
    applyCheckoutWallet(body);
    assert.equal(body.get("payment_method_types[0]"), "card");
    assert.equal(body.get("line_items[0][price_data][unit_amount]"), "1000");
  });

  it("reads Google Pay from the verified charge and hides it from other wallets", () => {
    assert.equal(
      walletFromCheckoutSession({
        payment_intent: { latest_charge: { payment_method_details: { card: { wallet: { type: "google_pay" } } } } },
      }),
      "google_pay",
    );
    assert.equal(
      walletFromCheckoutSession({
        payment_intent: { latest_charge: { payment_method_details: { card: {} } } },
      }),
      "card",
    );
    assert.equal(walletFromCheckoutSession({ payment_intent: "pi_123" }), "");
    assert.equal(walletLabel("google_pay"), "Google Pay");
  });
});

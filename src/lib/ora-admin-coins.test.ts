import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coinIdempotencyKey, previewCoinChange } from "./ora-admin-coins.ts";

describe("admin coin adjustments", () => {
  it("previews an add without going through the wallet writer", () => {
    assert.deepEqual(previewCoinChange(40, "add", 10), {
      previous: 40,
      delta: 10,
      next: 50,
      direction: "add",
      coins: 10,
    });
  });

  it("previews a deduction and refuses to pass zero", () => {
    assert.equal(previewCoinChange(12, "deduct", 5).next, 7);
    assert.throws(() => previewCoinChange(4, "deduct", 5), /available balance/);
    assert.throws(() => previewCoinChange(4, "deduct", 0), /between 1 and 5000/);
  });

  it("builds one idempotency key per customer request", () => {
    assert.equal(coinIdempotencyKey("user_1", "req_12345678"), "coin:user_1:req_12345678");
    assert.throws(() => coinIdempotencyKey("user_1", "short"), /could not be started/);
  });
});

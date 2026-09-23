import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paidMessageSplit } from "./ora-paid-messages.ts";
import { panelSplit } from "./ora-split.ts";
import { applySimulatedTip, emptyTipState, tipGift, tipSplit, TIP_GIFTS } from "./ora-tips.ts";

describe("customer tips", () => {
  it("prices the five approved gifts and splits each one 50/50", () => {
    assert.deepEqual(
      TIP_GIFTS.map((gift) => [gift.name, gift.coins]),
      [
        ["Flower", 10],
        ["Moon", 30],
        ["Crystal", 50],
        ["Psychic Cardz", 100],
        ["Angel", 200],
      ],
    );
    for (const gift of TIP_GIFTS) {
      const split = tipSplit(gift.coins);
      assert.equal(split.advisorShare, gift.coins / 2);
      assert.equal(split.oraShare, gift.coins / 2);
      assert.equal(split.advisorShare + split.oraShare, gift.coins);
    }
  });

  it("does not change paid-message or live-reading splits", () => {
    assert.deepEqual(paidMessageSplit(2), { amountCents: 20, advisorShareCents: 4, oraShareCents: 16 });
    assert.equal(panelSplit(20).advisorEarnings, 4);
    assert.equal(panelSplit(20).platformRevenue, 16);
  });

  it("rejects an unknown gift and an insufficient balance without moving coins", () => {
    const start = emptyTipState(9);
    const unknown = applySimulatedTip(start, { requestId: "r1", gift: "rose" });
    assert.equal(unknown.lastReject, "Choose a tip.");
    assert.equal(unknown.wallet, 9);
    const poor = applySimulatedTip(start, { requestId: "r2", gift: "flower" });
    assert.equal(poor.lastReject, "Not enough coins for this tip.");
    assert.equal(poor.wallet, 9);
    assert.equal(poor.tips.length, 0);
  });

  it("charges once per request, ignores a failed send, and allows a later different tip", () => {
    let state = emptyTipState(120);
    const failed = applySimulatedTip(state, { requestId: "r1", gift: "moon", fail: true });
    assert.equal(failed.lastReject, "failed");
    assert.equal(failed.wallet, 120);
    state = applySimulatedTip(state, { requestId: "r1", gift: "flower" });
    assert.equal(state.wallet, 110);
    assert.equal(state.advisor, 5);
    assert.equal(state.ora, 5);
    const again = applySimulatedTip(state, { requestId: "r1", gift: "angel" });
    assert.equal(again.duplicate, true);
    assert.equal(again.wallet, 110);
    assert.equal(again.tips.length, 1);
    const short = applySimulatedTip(state, { requestId: "r2", gift: "angel" });
    assert.equal(short.lastReject, "Not enough coins for this tip.");
    assert.equal(short.wallet, 110);
    state = applySimulatedTip(state, { requestId: "r3", gift: "crystal" });
    assert.equal(state.wallet, 60);
    assert.equal(state.advisor, 5 + 25);
    assert.equal(state.ora, 5 + 25);
    assert.equal(tipGift("cards")?.name, "Psychic Cardz");
  });
});

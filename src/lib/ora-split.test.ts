import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADVISOR_SHARE_PCT,
  PLATFORM_SHARE_MAX,
  PLATFORM_SHARE_PCT,
  panelSplit,
  splitCoins,
} from "./ora-split.ts";

describe("splitCoins", () => {
  it("gives the advisor 20% and Ora 80%", () => {
    assert.equal(ADVISOR_SHARE_PCT, 20);
    assert.equal(PLATFORM_SHARE_PCT, 80);
    assert.equal(PLATFORM_SHARE_MAX, 90);
    assert.deepEqual(splitCoins(20), { advisorEarned: 4, platformFee: 16 });
    assert.deepEqual(splitCoins(100), { advisorEarned: 20, platformFee: 80 });
    assert.deepEqual(splitCoins(7), { advisorEarned: 1, platformFee: 6 });
    assert.deepEqual(splitCoins(0), { advisorEarned: 0, platformFee: 0 });
  });

  it("uses the supplied house percent when it is within the cap", () => {
    assert.deepEqual(splitCoins(20, 80), { advisorEarned: 4, platformFee: 16 });
    assert.deepEqual(splitCoins(100, 90), { advisorEarned: 10, platformFee: 90 });
  });

  it("does not clamp 80% house down to the old 50% maximum", () => {
    assert.deepEqual(splitCoins(20, 80), { advisorEarned: 4, platformFee: 16 });
    assert.notDeepEqual(splitCoins(20, 80), { advisorEarned: 10, platformFee: 10 });
    assert.notDeepEqual(splitCoins(20, 80), { advisorEarned: 14, platformFee: 6 });
  });
});

describe("panelSplit", () => {
  it("matches billing for advisor desk totals", () => {
    assert.deepEqual(panelSplit(20), { advisorEarnings: 4, platformRevenue: 16 });
    assert.deepEqual(panelSplit(100), { advisorEarnings: 20, platformRevenue: 80 });
  });
});

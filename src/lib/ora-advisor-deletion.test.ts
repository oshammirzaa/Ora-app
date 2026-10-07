import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADVISOR_DELETION_PAYOUT_BLOCK,
  advisorDeletionRefusal,
  advisorOwesPayout,
} from "./ora-advisor-deletion.ts";

describe("advisor account deletion", () => {
  it("blocks unpaid available, pending, and open payout balances", () => {
    assert.equal(advisorOwesPayout({ payoutCoins: 1, pendingCoins: 0, openPayoutCoins: 0 }), true);
    assert.equal(advisorOwesPayout({ payoutCoins: 0, pendingCoins: 4, openPayoutCoins: 0 }), true);
    assert.equal(advisorOwesPayout({ payoutCoins: 0, pendingCoins: 0, openPayoutCoins: 12 }), true);
    assert.equal(advisorOwesPayout({ payoutCoins: 0, pendingCoins: 0, openPayoutCoins: 0, uncreditedCents: 25 }), true);
    assert.equal(advisorOwesPayout({ payoutCoins: 0, pendingCoins: 0, openPayoutCoins: 0, uncreditedCents: 0 }), false);
  });

  it("uses the outstanding-payout message and still allows a settled advisor", () => {
    assert.equal(
      advisorDeletionRefusal({ payoutCoins: 2, pendingCoins: 0, openPayoutCoins: 0, liveReadings: 0 }),
      ADVISOR_DELETION_PAYOUT_BLOCK,
    );
    assert.match(advisorDeletionRefusal({ liveReadings: 1, payoutCoins: 0 }), /live reading/i);
    assert.equal(
      advisorDeletionRefusal({ payoutCoins: 0, pendingCoins: 0, openPayoutCoins: 0, messageRemainderCents: 0, liveReadings: 0 }),
      "",
    );
  });
});

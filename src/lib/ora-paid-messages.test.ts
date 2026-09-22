import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panelSplit } from "./ora-split.ts";
import {
  LIFETIME_FREE_CUSTOMER_MESSAGES,
  PAID_CUSTOMER_MESSAGE_COINS,
  PAID_MESSAGE_COINS_PER_DOLLAR,
  applySimulatedSend,
  canChargePaidMessage,
  claimLifetimeFreeSlot,
  coinsToCents,
  customerMessageNotice,
  customerMessageQuote,
  emptySimulatedState,
  liveReadingSplitUnchanged,
  needsFirstPaidConfirm,
  paidMessageSplit,
  pairAllowance,
  remainingFreeLabel,
} from "./ora-paid-messages.ts";

function send(state: ReturnType<typeof emptySimulatedState>, n: number, extra?: { advisorId?: string; confirmPaid?: boolean; role?: "customer" | "advisor"; body?: string }) {
  return applySimulatedSend(state, {
    advisorId: extra?.advisorId || "adv_a",
    requestId: `req_${n}`,
    body: extra?.body ?? `hello ${n}`,
    confirmPaid: extra?.confirmPaid,
    role: extra?.role,
  });
}

describe("lifetime free customer messages", () => {
  it("makes the 1st, 2nd, and 3rd customer messages free", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    assert.equal(pairAllowance(state, "adv_a").freeUsed, 3);
    assert.equal(state.wallet, 20);
    assert.equal(state.messages.filter((m) => m.coins === 0).length, 3);
    assert.deepEqual(customerMessageQuote(0), { coins: 0, free: true, remainingFree: 3 });
    assert.deepEqual(customerMessageQuote(1), { coins: 0, free: true, remainingFree: 2 });
    assert.deepEqual(customerMessageQuote(2), { coins: 0, free: true, remainingFree: 1 });
  });

  it("charges 2 coins on the 4th message and every message after", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    state = send(state, 4, { confirmPaid: true });
    state = send(state, 5, { confirmPaid: true });
    assert.equal(state.wallet, 16);
    assert.equal(state.messages.filter((m) => m.coins === 2).length, 2);
    assert.equal(pairAllowance(state, "adv_a").paidSent, 2);
    assert.deepEqual(customerMessageQuote(3), { coins: 2, free: false, remainingFree: 0 });
    assert.equal(PAID_CUSTOMER_MESSAGE_COINS, 2);
  });

  it("never charges advisor replies", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1);
    state = send(state, 2, { role: "advisor" });
    state = send(state, 3);
    assert.equal(state.wallet, 20);
    assert.equal(pairAllowance(state, "adv_a").freeUsed, 2);
    assert.equal(state.messages.filter((m) => m.role === "advisor")[0]?.coins, 0);
  });

  it("gives a different advisor a separate 3-message allowance", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1, { advisorId: "adv_a" });
    state = send(state, 2, { advisorId: "adv_a" });
    state = send(state, 3, { advisorId: "adv_a" });
    state = send(state, 4, { advisorId: "adv_b" });
    assert.equal(pairAllowance(state, "adv_a").freeUsed, 3);
    assert.equal(pairAllowance(state, "adv_b").freeUsed, 1);
    assert.equal(state.wallet, 20);
  });

  it("does not reset the allowance when a new thread is opened with the same advisor", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    const samePair = pairAllowance(state, "adv_a");
    state = send(state, 4, { confirmPaid: true });
    assert.equal(samePair.freeUsed, 3);
    assert.equal(pairAllowance(state, "adv_a").freeUsed, 3);
    assert.equal(state.wallet, 18);
  });

  it("does not reset after logout or reload because allowance is keyed by customer+advisor", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    const persisted = pairAllowance(state, "adv_a");
    let reloaded = emptySimulatedState(20);
    reloaded = { ...reloaded, pairs: { adv_a: persisted } };
    reloaded = send(reloaded, 4, { confirmPaid: true });
    assert.equal(pairAllowance(reloaded, "adv_a").freeUsed, 3);
    assert.equal(reloaded.wallet, 18);
  });

  it("cannot obtain more than 3 lifetime free messages with 10 distinct request ids", () => {
    let used = 0;
    let claimed = 0;
    for (let i = 0; i < 10; i += 1) {
      const slot = claimLifetimeFreeSlot(used);
      if (slot.ok) {
        used = slot.freeUsed;
        claimed += 1;
      }
    }
    assert.equal(LIFETIME_FREE_CUSTOMER_MESSAGES, 3);
    assert.equal(claimed, 3);
    assert.equal(used, 3);
    assert.equal(claimLifetimeFreeSlot(3).ok, false);

    let state = emptySimulatedState(40);
    for (let i = 1; i <= 10; i += 1) {
      state = send(state, i, { confirmPaid: true });
    }
    assert.equal(pairAllowance(state, "adv_a").freeUsed, 3);
    assert.equal(state.messages.filter((m) => m.coins === 0).length, 3);
    assert.equal(state.messages.filter((m) => m.coins === 2).length, 7);
    assert.equal(state.wallet, 26);
    assert.equal(state.ledger.length, 7);
    assert.equal(state.ledger.reduce((n, row) => n + row.advisorShare, 0), 7);
    assert.equal(state.ledger.reduce((n, row) => n + row.oraShare, 0), 7);
  });
});

describe("paid message wallet and ledger", () => {
  it("blocks sending when the wallet has fewer than 2 coins", () => {
    let state = emptySimulatedState(1);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    state = send(state, 4, { confirmPaid: true });
    assert.equal(state.lastReject, "insufficient");
    assert.equal(state.wallet, 1);
    assert.equal(state.messages.length, 3);
    assert.equal(canChargePaidMessage(1), false);
    assert.equal(canChargePaidMessage(2), true);
  });

  it("does not charge coins or consume a free message when the send is empty/failed", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1, { body: "   " });
    assert.equal(state.lastReject, "empty");
    assert.equal(state.messages.length, 0);
    assert.equal(pairAllowance(state, "adv_a").freeUsed, 0);
    assert.equal(state.wallet, 20);
  });

  it("cannot double charge a retried request id", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    state = send(state, 4, { confirmPaid: true });
    const once = state.wallet;
    state = send(state, 4, { confirmPaid: true });
    assert.equal(state.wallet, once);
    assert.equal(state.ledger.length, 1);
    assert.equal(state.messages.filter((m) => m.requestId === "req_4").length, 1);
  });

  it("deducts exactly 2 coins and splits 50/50 using Ora coin accounting", () => {
    const split = paidMessageSplit(2);
    assert.deepEqual(split, { advisorShare: 1, oraShare: 1 });
    assert.equal(PAID_MESSAGE_COINS_PER_DOLLAR, 10);
    assert.equal(coinsToCents(2), 20);
    assert.equal(coinsToCents(1), 10);
    let state = emptySimulatedState(10);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    state = send(state, 4, { confirmPaid: true });
    assert.equal(state.wallet, 8);
    assert.deepEqual(state.ledger[0], {
      requestId: "req_4",
      advisorId: "adv_a",
      coins: 2,
      advisorShare: 1,
      oraShare: 1,
      amountCents: 20,
    });
  });

  it("leaves the live-reading 20/80 split unchanged", () => {
    assert.deepEqual(liveReadingSplitUnchanged(20), { advisorEarnings: 4, platformRevenue: 16 });
    assert.deepEqual(panelSplit(20), { advisorEarnings: 4, platformRevenue: 16 });
    assert.notDeepEqual(paidMessageSplit(20), panelSplit(20));
  });
});

describe("customer pricing notice", () => {
  it("shows remaining free messages then 2 coins per message", () => {
    assert.equal(customerMessageNotice(3).intro, "Your first 3 messages with this advisor are free. After that, each message costs 2 coins.");
    assert.equal(remainingFreeLabel(3), "3 free messages left");
    assert.equal(remainingFreeLabel(2), "2 free messages left");
    assert.equal(remainingFreeLabel(1), "1 free message left");
    assert.equal(customerMessageNotice(0).intro, "2 coins per message");
    assert.equal(needsFirstPaidConfirm({ remainingFree: 0, paidNoticeSeen: false }), true);
    assert.equal(needsFirstPaidConfirm({ remainingFree: 0, paidNoticeSeen: true }), false);
    assert.equal(needsFirstPaidConfirm({ remainingFree: 1, paidNoticeSeen: false }), false);
  });

  it("asks for a one-time paid confirmation then keeps the 2-coin indicator", () => {
    let state = emptySimulatedState(20);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    state = send(state, 4);
    assert.equal(state.lastReject, "confirm");
    assert.equal(state.messages.length, 3);
    state = send(state, 4, { confirmPaid: true });
    assert.equal(state.lastReject, "");
    assert.equal(pairAllowance(state, "adv_a").paidNoticeSeen, true);
    state = send(state, 5);
    assert.equal(state.lastReject, "");
    assert.equal(state.wallet, 16);
  });
});

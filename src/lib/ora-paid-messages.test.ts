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
  appendPaidMessageCredit,
  messageShowsAdvisorCoin,
  summarizeMessageEarnings,
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

describe("coin-paid message marker and 50% earnings", () => {
  const now = new Date("2026-09-23T15:00:00.000Z");

  it("does not mark free messages or credit the advisor", () => {
    assert.equal(messageShowsAdvisorCoin("customer", 0), false);
    assert.equal(messageShowsAdvisorCoin("advisor", 2), false);
    assert.equal(messageShowsAdvisorCoin("customer", 2), true);
    let ledger = appendPaidMessageCredit([], {
      requestId: "free",
      messageId: "m-free",
      customerId: "c1",
      customerName: "Demetri",
      at: now.toISOString(),
      coins: 0,
      advisorShare: 0,
      oraShare: 0,
    });
    assert.equal(ledger.length, 0);
    const summary = summarizeMessageEarnings({
      exchanges: 3,
      now,
      paid: [{ customerId: "c1", customerName: "Demetri", at: now.toISOString(), coins: 0, advisorShare: 0, oraShare: 0 }],
    });
    assert.equal(summary.paidMessages, 0);
    assert.equal(summary.advisorEarnings, 0);
    assert.equal(summary.oraShare, 0);
    assert.equal(summary.exchanges, 3);
    assert.equal(summary.history.length, 0);
  });

  it("charges 2 coins, pays the advisor exactly 1, and pays Ora exactly 1", () => {
    let state = emptySimulatedState(10);
    state = send(state, 1);
    state = send(state, 2);
    state = send(state, 3);
    state = send(state, 4, { confirmPaid: true });
    assert.equal(state.wallet, 8);
    assert.equal(state.messages[3]?.coins, 2);
    assert.equal(messageShowsAdvisorCoin("customer", state.messages[3]?.coins), true);
    assert.equal(messageShowsAdvisorCoin("customer", state.messages[0]?.coins), false);
    let ledger = appendPaidMessageCredit([], {
      requestId: "req_4",
      messageId: "m4",
      customerId: "c1",
      customerName: "Demetri",
      at: now.toISOString(),
      coins: PAID_CUSTOMER_MESSAGE_COINS,
      advisorShare: 0,
      oraShare: 0,
    });
    assert.equal(ledger[0]?.advisorShare, 1);
    assert.equal(ledger[0]?.oraShare, 1);
    assert.equal(ledger[0]?.advisorShare + ledger[0]?.oraShare, 2);
    const again = appendPaidMessageCredit(ledger, ledger[0]!);
    assert.equal(again.length, 1);
    const summary = summarizeMessageEarnings({
      exchanges: 4,
      now,
      paid: ledger.map((row) => ({ ...row })),
    });
    const refreshed = summarizeMessageEarnings({
      exchanges: 4,
      now,
      paid: ledger.map((row) => ({ ...row })),
    });
    assert.deepEqual(refreshed, summary);
    assert.equal(summary.paidMessages, 1);
    assert.equal(summary.todayPaidMessages, 1);
    assert.equal(summary.advisorEarnings, 1);
    assert.equal(summary.oraShare, 1);
    assert.equal(summary.todayEarnings, 1);
    assert.equal(summary.history[0]?.paidCount, 1);
    assert.equal(summary.history[0]?.charged, 2);
    assert.equal(summary.history[0]?.advisorShare, 1);
    assert.equal(summary.history[0]?.customerName, "Demetri");
  });

  it("groups the same client on the same day and ignores another advisor's rows only when filtered out", () => {
    const summary = summarizeMessageEarnings({
      exchanges: 6,
      now,
      paid: [
        { customerId: "c1", customerName: "Demetri", at: "2026-09-23T10:00:00.000Z", coins: 2, advisorShare: 1, oraShare: 1 },
        { customerId: "c1", customerName: "Demetri", at: "2026-09-23T12:00:00.000Z", coins: 2, advisorShare: 1, oraShare: 1 },
        { customerId: "c1", customerName: "Demetri", at: "2026-09-22T12:00:00.000Z", coins: 2, advisorShare: 1, oraShare: 1 },
      ],
    });
    assert.equal(summary.paidMessages, 3);
    assert.equal(summary.charged, 6);
    assert.equal(summary.advisorEarnings, 3);
    assert.equal(summary.oraShare, 3);
    assert.equal(summary.todayPaidMessages, 2);
    assert.equal(summary.todayEarnings, 2);
    assert.equal(summary.history.length, 2);
    assert.equal(summary.history[0]?.paidCount, 2);
    assert.equal(summary.history[0]?.charged, 4);
    assert.equal(summary.history[0]?.advisorShare, 2);
    assert.equal(summary.history[1]?.paidCount, 1);
  });
});


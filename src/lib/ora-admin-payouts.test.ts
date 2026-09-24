import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advisorBalance,
  advisorEarningsSummary,
  availablePayoutCoins,
  buildAdvisorPayout,
  canMarkRequestPaid,
  coinsToEarningCents,
  filterAdvisorEarnings,
  paidMinuteValue,
  paidMinutesLabel,
  payoutBoardSummary,
  payoutStatusLabel,
  recordedPayoutCents,
  unpaidCents,
  withPayoutStatus,
  type EarningSource,
} from "./ora-admin-payouts.ts";
import { assembleFinance, summarizeFinance, type FinanceSources } from "./ora-admin-finance.ts";

const earning = (id: string, at: string, cents: number): EarningSource => ({
  id,
  at,
  customer: "Sarah",
  reference: `Sarah · ${id}`,
  type: "live reading",
  grossCents: cents * 2,
  advisorCents: cents,
});

describe("admin advisor payouts", () => {
  it("keeps unpaid balance as the coins still owed, including open payouts and the message remainder", () => {
    assert.equal(
      unpaidCents({ payoutCoins: 10, pendingCoins: 5, openPayoutCoins: 3, messageRemainderCents: 4 }),
      184,
    );
    assert.equal(unpaidCents({ payoutCoins: 0, pendingCoins: 0, openPayoutCoins: 0, messageRemainderCents: 0 }), 0);
  });

  it("labels stored payout rows without rewriting rejected or paid history", () => {
    assert.equal(payoutStatusLabel("requested", ""), "pending");
    assert.equal(payoutStatusLabel("requested", "processing"), "processing");
    assert.equal(payoutStatusLabel("paid", ""), "paid");
    assert.equal(payoutStatusLabel("rejected", "processing"), "rejected");
    assert.equal(canMarkRequestPaid("requested"), true);
    assert.equal(canMarkRequestPaid("paid"), false);
  });

  it("builds one advisor from stored shares and does not derive unpaid by subtracting payouts from lifetime", () => {
    const row = buildAdvisorPayout(
      {
        id: "adv_mira",
        name: "Mira",
        photoUrl: "/images/mira.jpg",
        email: "mira@example.com",
        status: "live",
        payoutCoins: 4,
        pendingCoins: 1,
        messageRemainderCents: 4,
        paidMinutes: 6.25,
        readingCents: coinsToEarningCents(10),
        messageCents: 4,
        tipCents: coinsToEarningCents(5),
        payouts: [
          { id: "pay_old", coins: 6, status: "paid", workflow: "", paidAt: "2026-09-02T12:00:00.000Z", createdAt: "2026-09-02T11:00:00.000Z" },
          { id: "pay_open", coins: 2, status: "requested", workflow: "processing", paidAt: "", createdAt: "2026-09-20T12:00:00.000Z" },
        ],
      },
      new Date("2026-09-24T00:00:00.000Z"),
    );
    assert.equal(row.lifetimeCents, 100 + 4 + 50);
    assert.equal(row.paidCents, 60);
    assert.equal(row.owedCents, (4 + 1 + 2) * 10 + 4);
    assert.notEqual(row.owedCents, row.lifetimeCents - row.paidCents);
    assert.equal(row.payoutStatus, "processing");
    assert.equal(row.lastPayoutAt, "2026-09-02T12:00:00.000Z");
    assert.equal(row.paidThisMonthCents, 60);
    assert.equal(row.paidMinutes, 6.25);
    assert.equal(paidMinutesLabel(125), "2 min 5s");
    assert.equal(paidMinuteValue(6.256), 6.26);
    assert.equal(row.requests[0]?.id, "pay_open");
    assert.equal(row.requests[0]?.label, "processing");
  });

  it("counts this month's paid payouts and advisors who are still owed money", () => {
    const now = new Date("2026-09-24T08:00:00.000Z");
    const owed = buildAdvisorPayout(
      {
        id: "a",
        name: "A",
        photoUrl: "",
        email: "",
        status: "live",
        payoutCoins: 3,
        pendingCoins: 0,
        messageRemainderCents: 0,
        paidMinutes: 5,
        readingCents: 30,
        messageCents: 0,
        tipCents: 0,
        payouts: [
          { id: "p1", coins: 2, status: "paid", workflow: "", paidAt: "2026-09-10T00:00:00.000Z", createdAt: "2026-09-10T00:00:00.000Z" },
        ],
      },
      now,
    );
    const clear = buildAdvisorPayout(
      {
        id: "b",
        name: "B",
        photoUrl: "",
        email: "b@example.com",
        status: "paused",
        payoutCoins: 0,
        pendingCoins: 0,
        messageRemainderCents: 0,
        paidMinutes: 0,
        readingCents: 20,
        messageCents: 0,
        tipCents: 0,
        payouts: [
          { id: "p2", coins: 2, status: "paid", workflow: "", paidAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" },
        ],
      },
      now,
    );
    const summary = payoutBoardSummary([owed, clear]);
    assert.equal(summary.owedCents, 30);
    assert.equal(summary.pendingPayoutCents, 0);
    assert.equal(summary.paidThisMonthCents, 20);
    assert.equal(summary.advisorsWithUnpaid, 1);
    assert.equal(clear.payoutStatus, "paid");
  });

  it("assigns payout status in time order and never changes stored earning amounts", () => {
    const rows = [
      earning("e1", "2026-09-01T00:00:00.000Z", 50),
      earning("e2", "2026-09-02T00:00:00.000Z", 40),
      earning("e3", "2026-09-03T00:00:00.000Z", 30),
    ];
    const before = rows.map((row) => row.advisorCents).sort((a, b) => a - b);
    const history = withPayoutStatus(rows, 50, 40);
    assert.deepEqual(
      history.map((row) => row.advisorCents).sort((a, b) => a - b),
      before,
    );
    assert.deepEqual(
      history.map((row) => [row.id, row.payoutStatus]),
      [
        ["e3", "pending"],
        ["e2", "processing"],
        ["e1", "paid"],
      ],
    );
  });

  it("refuses to mark an empty available balance as paid", () => {
    assert.equal(availablePayoutCoins(12), 12);
    assert.throws(() => availablePayoutCoins(0), /No available balance/);
    assert.throws(() => availablePayoutCoins(-4), /No available balance/);
  });

  it("sets pending to stored earnings minus completed payouts, once each", () => {
    const balance = advisorBalance({
      readingCents: 100,
      messageCents: 4,
      tipCents: 50,
      adjustmentCents: -10,
      payouts: [
        { id: "paid", status: "paid", workflow: "", coins: 6, amountCents: 60 },
        { id: "paid", status: "paid", workflow: "", coins: 6, amountCents: 60 },
        { id: "open", status: "requested", workflow: "processing", coins: 4, amountCents: 40 },
        { id: "no", status: "rejected", workflow: "", coins: 9, amountCents: 90 },
        { id: "stop", status: "cancelled", workflow: "", coins: 3, amountCents: 30 },
        { id: "back", status: "reversed", coins: 2 },
      ],
    });
    assert.equal(balance.earnedCents, 144);
    assert.equal(balance.paidCents, 60);
    assert.equal(balance.pendingCents, 84);
    assert.equal(recordedPayoutCents({ coins: 6, amountCents: 0 }), 60);
    assert.equal(recordedPayoutCents({ coins: 6, amountCents: 55 }), 55);
  });

  it("searches, filters, and sorts advisors without changing amounts", () => {
    const rows = [
      buildAdvisorPayout({
        id: "adv_mira",
        name: "Mira",
        photoUrl: "",
        email: "mira@example.com",
        status: "live",
        payoutCoins: 0,
        pendingCoins: 0,
        messageRemainderCents: 0,
        paidMinutes: 0,
        readingCents: 80,
        messageCents: 0,
        tipCents: 0,
        payouts: [{ id: "p", coins: 2, status: "paid", workflow: "", paidAt: "2026-09-02T00:00:00.000Z", createdAt: "2026-09-02T00:00:00.000Z" }],
      }),
      buildAdvisorPayout({
        id: "adv_rowan",
        name: "Rowan",
        photoUrl: "",
        email: "rowan@example.com",
        status: "live",
        payoutCoins: 0,
        pendingCoins: 0,
        messageRemainderCents: 0,
        paidMinutes: 0,
        readingCents: 20,
        messageCents: 0,
        tipCents: 0,
        payouts: [{ id: "r", coins: 2, status: "paid", workflow: "", paidAt: "2026-09-20T00:00:00.000Z", createdAt: "2026-09-20T00:00:00.000Z" }],
      }),
      buildAdvisorPayout({
        id: "adv_new",
        name: "New",
        photoUrl: "",
        email: "",
        status: "applied",
        payoutCoins: 0,
        pendingCoins: 0,
        messageRemainderCents: 0,
        paidMinutes: 0,
        readingCents: 0,
        messageCents: 0,
        tipCents: 0,
        payouts: [],
      }),
    ];
    assert.deepEqual(filterAdvisorEarnings(rows, { query: "mira@" }).map((row) => row.id), ["adv_mira"]);
    assert.deepEqual(filterAdvisorEarnings(rows, { filter: "pending", sort: "name" }).map((row) => row.id), ["adv_mira"]);
    assert.deepEqual(filterAdvisorEarnings(rows, { filter: "paid" }).map((row) => row.id), ["adv_rowan"]);
    assert.deepEqual(filterAdvisorEarnings(rows, { filter: "none" }).map((row) => row.id), ["adv_new"]);
    assert.deepEqual(filterAdvisorEarnings(rows, { sort: "recent" }).map((row) => row.id), ["adv_rowan", "adv_mira", "adv_new"]);
    const summary = advisorEarningsSummary(rows);
    assert.equal(summary.earnedCents, 100);
    assert.equal(summary.paidOutCents, 40);
    assert.equal(summary.pendingBalanceCents, 60);
    assert.equal(summary.pendingMatches, true);
    assert.equal(summary.advisorsWithPending, 1);
  });

  it("matches finance advisor earnings and completed payouts, and ignores coin purchases", () => {
    const sources: FinanceSources = {
      payments: [
        {
          id: "pay_cash",
          userId: "u1",
          customer: "Sarah",
          email: "",
          packId: "50",
          provider: "stripe",
          amountCents: 500,
          currency: "USD",
          coins: 50,
          status: "succeeded",
          paidAt: "2026-09-01T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      readings: [
        {
          id: "read_old",
          at: "2026-01-01T00:00:00.000Z",
          customerId: "u1",
          customer: "Sarah",
          email: "",
          advisorId: "adv_mira",
          advisor: "Mira",
          status: "ended",
          coinsSpent: 10,
          advisorEarned: 7,
          platformFee: 3,
          clawed: false,
        },
        {
          id: "read_back",
          at: "2026-02-01T00:00:00.000Z",
          customerId: "u1",
          customer: "Sarah",
          email: "",
          advisorId: "adv_mira",
          advisor: "Mira",
          status: "ended",
          coinsSpent: 20,
          advisorEarned: 4,
          platformFee: 16,
          clawed: true,
        },
      ],
      messages: [
        {
          id: "msg",
          at: "2026-03-01T00:00:00.000Z",
          customerId: "u1",
          customer: "Sarah",
          email: "",
          advisorId: "adv_mira",
          advisor: "Mira",
          coins: 2,
          amountCents: 20,
          advisorCents: 4,
          oraCents: 16,
          credited: true,
        },
      ],
      tips: [
        {
          id: "tip",
          at: "2026-03-02T00:00:00.000Z",
          customerId: "u1",
          customer: "Sarah",
          email: "",
          advisorId: "adv_mira",
          advisor: "Mira",
          gift: "flower",
          coins: 10,
          advisorShare: 5,
          oraShare: 5,
          charged: true,
          credited: true,
        },
      ],
      payouts: [
        {
          id: "po",
          at: "2026-04-01T00:00:00.000Z",
          paidAt: "2026-04-02T00:00:00.000Z",
          advisorId: "adv_mira",
          advisor: "Mira",
          coins: 6,
          amountCents: 60,
          status: "paid",
          workflow: "paid",
          currency: "USD",
        },
        {
          id: "po",
          at: "2026-04-01T00:00:00.000Z",
          paidAt: "2026-04-02T00:00:00.000Z",
          advisorId: "adv_mira",
          advisor: "Mira",
          coins: 6,
          amountCents: 60,
          status: "paid",
          workflow: "paid",
          currency: "USD",
        },
        {
          id: "po_no",
          at: "2026-04-03T00:00:00.000Z",
          paidAt: "",
          advisorId: "adv_mira",
          advisor: "Mira",
          coins: 9,
          amountCents: 90,
          status: "rejected",
          workflow: "",
          currency: "USD",
        },
      ],
      adjustments: [],
    };
    const txns = assembleFinance(sources);
    const finance = summarizeFinance(txns, new Date("2026-09-24T00:00:00.000Z"));
    const reading = txns.filter((row) => row.activity && row.type === "live reading").reduce((sum, row) => sum + row.advisorCents, 0);
    const message = txns.filter((row) => row.activity && row.type === "paid message").reduce((sum, row) => sum + row.advisorCents, 0);
    const tip = txns.filter((row) => row.activity && row.type === "tip/gift").reduce((sum, row) => sum + row.advisorCents, 0);
    const row = buildAdvisorPayout({
      id: "adv_mira",
      name: "Mira",
      photoUrl: "",
      email: "mira@example.com",
      status: "live",
      payoutCoins: 0,
      pendingCoins: 0,
      messageRemainderCents: 0,
      paidMinutes: 5,
      readingCents: reading,
      messageCents: message,
      tipCents: tip,
      payouts: sources.payouts.map((payout) => ({
        id: payout.id,
        coins: payout.coins,
        amountCents: payout.amountCents,
        status: payout.status,
        workflow: payout.workflow,
        paidAt: payout.paidAt,
        createdAt: payout.at,
      })),
    });
    const summary = advisorEarningsSummary([row]);
    assert.equal(summary.earnedCents, finance.advisorEarningsCents);
    assert.equal(summary.paidOutCents, finance.completedPayoutCents);
    assert.equal(summary.pendingBalanceCents, finance.advisorEarningsCents - finance.completedPayoutCents);
    assert.equal(summary.pendingMatches, true);
    assert.equal(row.lifetimeCents, 70 + 4 + 50);
    assert.notEqual(row.lifetimeCents, finance.grossLifetimeCents);
    assert.equal(finance.grossLifetimeCents, 500);
  });
});

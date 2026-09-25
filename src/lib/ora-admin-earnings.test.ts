import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  ADVISOR_EARNINGS_PAY_SQL,
  READY_UNPAID_CENTS,
  buildAdvisorEarningsBoard,
  buildAdvisorEarningsDetail,
  filterEarningsList,
  payAdvisorEarnings,
  type EarningEvent,
  type EarningsAdvisor,
  type PayoutEvent,
} from "./ora-admin-earnings.ts";

const now = new Date("2026-09-24T15:00:00.000Z");

function advisor(id: string, name: string): EarningsAdvisor {
  return { id, name, photoUrl: "", email: `${id}@ora.test`, status: "live" };
}

function earn(partial: Partial<EarningEvent> & Pick<EarningEvent, "id" | "advisorId" | "kind" | "advisorCents">): EarningEvent {
  return { at: "2026-09-02T00:00:00.000Z", ...partial };
}

function payout(partial: Partial<PayoutEvent> & Pick<PayoutEvent, "id" | "advisorId">): PayoutEvent {
  return {
    coins: 0,
    amountCents: 0,
    status: "paid",
    workflow: "paid",
    paidAt: "2026-09-10T00:00:00.000Z",
    createdAt: "2026-09-10T00:00:00.000Z",
    method: "",
    referenceId: "",
    note: "",
    ...partial,
  };
}

describe("advisor earnings ready list", () => {
  it("uses the advisor share and hides anyone under $50 unpaid", () => {
    const board = buildAdvisorEarningsBoard(
      {
        advisors: [advisor("adv_low", "Low"), advisor("adv_ready", "Ready")],
        earnings: [
          earn({ id: "r1", advisorId: "adv_low", kind: "reading", advisorCents: 4_990, at: "2026-09-01T00:00:00.000Z" }),
          earn({ id: "r2", advisorId: "adv_ready", kind: "reading", advisorCents: 5_000, at: "2026-08-01T00:00:00.000Z" }),
          earn({ id: "m1", advisorId: "adv_ready", kind: "message", advisorCents: 200, at: "2026-09-03T00:00:00.000Z" }),
          earn({ id: "t1", advisorId: "adv_ready", kind: "tip", advisorCents: 300, at: "2026-09-04T00:00:00.000Z" }),
        ],
        payouts: [],
      },
      now,
    );
    assert.equal(READY_UNPAID_CENTS, 5_000);
    assert.deepEqual(board.ready.map((row) => row.id), ["adv_ready"]);
    assert.equal(board.ready[0].unpaidCents, 5_500);
    assert.equal(board.ready[0].lifetimeCents, 5_500);
    assert.equal(board.ready[0].monthEarningsCents, 500);
    assert.equal(board.ready[0].paymentStatus, "ready");
    assert.equal(board.summary.readyCount, 1);
    assert.equal(board.summary.unpaidCents, 4_990 + 5_500);
    assert.equal(board.summary.monthEarningsCents, 4_990 + 500);
  });

  it("keeps monthly and lifetime earnings after a completed payout", () => {
    const earnings = [
      earn({ id: "r_aug", advisorId: "adv_mira", kind: "reading", advisorCents: 3_000, at: "2026-08-15T00:00:00.000Z" }),
      earn({ id: "r_sep", advisorId: "adv_mira", kind: "reading", advisorCents: 4_000, at: "2026-09-02T00:00:00.000Z" }),
      earn({ id: "m_sep", advisorId: "adv_mira", kind: "message", advisorCents: 1_000, at: "2026-09-05T00:00:00.000Z" }),
      earn({ id: "t_jul", advisorId: "adv_mira", kind: "tip", advisorCents: 2_000, at: "2026-07-20T00:00:00.000Z" }),
    ];
    const payouts = [
      payout({ id: "pay_old", advisorId: "adv_mira", amountCents: 2_000, paidAt: "2026-08-20T00:00:00.000Z" }),
      payout({ id: "pay_old", advisorId: "adv_mira", amountCents: 2_000, paidAt: "2026-08-20T00:00:00.000Z" }),
      payout({ id: "pay_now", advisorId: "adv_mira", amountCents: 1_500, paidAt: "2026-09-12T00:00:00.000Z", method: "Bank transfer", referenceId: "REF1", note: "September" }),
      payout({ id: "pay_open", advisorId: "adv_mira", amountCents: 9_000, status: "requested", workflow: "processing", paidAt: "" }),
      payout({ id: "pay_no", advisorId: "adv_mira", amountCents: 9_000, status: "rejected", workflow: "", paidAt: "" }),
    ];
    const board = buildAdvisorEarningsBoard({ advisors: [advisor("adv_mira", "Mira")], earnings, payouts }, now);
    assert.equal(board.ready.length, 1);
    assert.equal(board.ready[0].lifetimeCents, 10_000);
    assert.equal(board.ready[0].paidCents, 3_500);
    assert.equal(board.ready[0].unpaidCents, 6_500);
    assert.equal(board.ready[0].monthEarningsCents, 5_000);
    assert.equal(board.summary.paidThisMonthCents, 1_500);
    const detail = buildAdvisorEarningsDetail({ advisor: advisor("adv_mira", "Mira"), earnings, payouts, month: "2026-09" }, now);
    assert.deepEqual(
      detail.months.map((row) => [row.label, row.cents]),
      [
        ["September 2026", 5_000],
        ["August 2026", 3_000],
        ["July 2026", 2_000],
      ],
    );
    assert.equal(detail.breakdown.readingCents, 4_000);
    assert.equal(detail.breakdown.messageCents, 1_000);
    assert.equal(detail.breakdown.tipCents, 0);
    assert.equal(detail.breakdown.otherCents, 0);
    assert.equal(detail.breakdown.totalCents, 5_000);
    assert.equal(detail.payments[0].id, "pay_now");
    assert.equal(detail.payments[0].method, "Bank transfer");
    assert.equal(detail.payments[0].referenceId, "REF1");
    assert.equal(detail.lifetimeCents, 10_000);
  });

  it("drops a paid advisor below $50 without erasing history, then returns them at $50", () => {
    const earnings = [earn({ id: "r1", advisorId: "adv_a", kind: "reading", advisorCents: 6_000 })];
    const before = buildAdvisorEarningsBoard({ advisors: [advisor("adv_a", "A")], earnings, payouts: [] }, now);
    assert.equal(before.ready.length, 1);
    const after = buildAdvisorEarningsBoard(
      {
        advisors: [advisor("adv_a", "A")],
        earnings,
        payouts: [payout({ id: "pay_1", advisorId: "adv_a", amountCents: 2_000 })],
      },
      now,
    );
    assert.equal(after.ready.length, 0);
    assert.equal(after.summary.unpaidCents, 4_000);
    const detail = buildAdvisorEarningsDetail(
      {
        advisor: advisor("adv_a", "A"),
        earnings,
        payouts: [payout({ id: "pay_1", advisorId: "adv_a", amountCents: 2_000 })],
      },
      now,
    );
    assert.equal(detail.lifetimeCents, 6_000);
    assert.equal(detail.months[0].cents, 6_000);
    assert.equal(detail.ready, false);
    const back = buildAdvisorEarningsBoard(
      {
        advisors: [advisor("adv_a", "A")],
        earnings: [...earnings, earn({ id: "r2", advisorId: "adv_a", kind: "tip", advisorCents: 1_000 })],
        payouts: [payout({ id: "pay_1", advisorId: "adv_a", amountCents: 2_000 })],
      },
      now,
    );
    assert.equal(back.ready[0].unpaidCents, 5_000);
  });

  it("sorts the highest unpaid balance first", () => {
    const board = buildAdvisorEarningsBoard(
      {
        advisors: [advisor("adv_b", "B"), advisor("adv_a", "A")],
        earnings: [
          earn({ id: "a", advisorId: "adv_a", kind: "reading", advisorCents: 8_000 }),
          earn({ id: "b", advisorId: "adv_b", kind: "reading", advisorCents: 9_000 }),
        ],
        payouts: [],
      },
      now,
    );
    assert.deepEqual(board.ready.map((row) => row.id), ["adv_b", "adv_a"]);
  });

  it("records when the unpaid share last crossed $50 and keeps earlier months", () => {
    const earnings = [
      earn({ id: "early", advisorId: "adv_a", kind: "reading", advisorCents: 6_000, at: "2026-07-01T00:00:00.000Z" }),
      earn({ id: "again", advisorId: "adv_a", kind: "tip", advisorCents: 5_000, at: "2026-09-08T00:00:00.000Z" }),
    ];
    const payouts = [payout({ id: "pay_1", advisorId: "adv_a", amountCents: 2_000, paidAt: "2026-08-01T00:00:00.000Z" })];
    const board = buildAdvisorEarningsBoard({ advisors: [advisor("adv_a", "Aria"), advisor("adv_zero", "Zero")], earnings, payouts }, now);
    assert.equal(board.ready[0].readySince, "2026-09-08T00:00:00.000Z");
    assert.equal(board.ready[0].unpaidCents, 9_000);
    const firstCross = buildAdvisorEarningsBoard(
      { advisors: [advisor("adv_a", "Aria")], earnings: [earnings[0]], payouts: [] },
      now,
    );
    assert.equal(firstCross.ready[0].readySince, "2026-07-01T00:00:00.000Z");
    const dropped = buildAdvisorEarningsBoard(
      {
        advisors: [advisor("adv_a", "Aria")],
        earnings,
        payouts: [payout({ id: "pay_1", advisorId: "adv_a", amountCents: 7_000, paidAt: "2026-08-01T00:00:00.000Z" })],
      },
      now,
    );
    assert.equal(dropped.ready.length, 0);
    assert.equal(dropped.listed[0].readySince, "");
    assert.equal(dropped.listed[0].unpaidCents, 4_000);
    const found = filterEarningsList(board.listed, { query: "adv_a@", cohort: "ready" }, now);
    assert.deepEqual(found.map((row) => row.id), ["adv_a"]);
    const lastMonth = filterEarningsList(board.listed, { cohort: "ready", period: "last" }, now);
    assert.equal(lastMonth.length, 0);
    const below = filterEarningsList(dropped.listed, { cohort: "below" }, now);
    assert.deepEqual(below.map((row) => row.id), ["adv_a"]);
    const held = buildAdvisorEarningsBoard(
      {
        advisors: [advisor("adv_a", "Aria")],
        earnings: [earn({ id: "small", advisorId: "adv_a", kind: "message", advisorCents: 1_000 })],
        payouts: [payout({ id: "pay_bad", advisorId: "adv_a", amountCents: 1_000, status: "rejected", workflow: "", paidAt: "" })],
      },
      now,
    );
    assert.equal(filterEarningsList(held.listed, { cohort: "held" }, now)[0].paymentStatus, "held");
  });
});

describe("advisor earnings payment", () => {
  it("records one payout, lowers only the unpaid balance, and rejects a duplicate", async () => {
    const db = new PGlite();
    await db.exec(`
      create table ora_advisors (
        id text primary key,
        user_id text not null,
        payout_coins integer not null default 0
      );
      create table ora_readings (
        id text primary key,
        advisor_id text not null,
        status text not null,
        coins_spent integer not null,
        advisor_earned integer not null,
        ended_at timestamptz
      );
      create table ora_earnings (
        id text primary key,
        reading_id text not null,
        status text not null
      );
      create table ora_paid_messages (
        id text primary key,
        advisor_id text not null,
        coins integer not null,
        advisor_share_cents integer not null,
        credited boolean not null
      );
      create table ora_customer_tips (
        id text primary key,
        advisor_id text not null,
        coins integer not null,
        advisor_share_coins integer not null,
        charged boolean not null,
        credited boolean not null
      );
      create table ora_payouts (
        id text primary key,
        user_id text not null,
        advisor_id text not null,
        coins integer not null,
        usd numeric(10,2) not null,
        status text not null,
        currency text not null default 'USD',
        amount_cents integer not null default 0,
        note text not null default '',
        method text not null default '',
        reference_id text not null default '',
        idempotency_key text not null default '',
        decided_at timestamptz,
        approved_at timestamptz,
        paid_at timestamptz,
        workflow text not null default ''
      );
      insert into ora_advisors values ('adv_mira', 'user_mira', 80);
      insert into ora_readings values
        ('read_live', 'adv_mira', 'ended', 2500, 500, '2026-09-02T00:00:00Z'),
        ('read_small', 'adv_mira', 'ended', 10000, 40, '2026-08-02T00:00:00Z'),
        ('read_claw', 'adv_mira', 'ended', 8000, 500, '2026-07-02T00:00:00Z');
      insert into ora_earnings values ('ern_claw', 'read_claw', 'clawed');
      insert into ora_paid_messages values ('msg_1', 'adv_mira', 2, 400, true);
      insert into ora_customer_tips values ('tip_1', 'adv_mira', 10, 5, true, true);
      insert into ora_payouts (id, user_id, advisor_id, coins, usd, status, amount_cents, workflow)
      values ('pay_old', 'user_mira', 'adv_mira', 10, 1.00, 'rejected', 1000, '');
    `);
    const sql = {
      query: async <T>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows,
    };
    assert.match(ADVISOR_EARNINGS_PAY_SQL, /for update/);
    assert.doesNotMatch(ADVISOR_EARNINGS_PAY_SQL, /payout_coins|coins_spent|ora_wallets|ora_payments/);
    const payment = {
      advisorId: "adv_mira",
      amountCents: 2_000,
      method: "Bank transfer",
      referenceId: "TX-100",
      note: "First half",
      requestId: "request01",
      payoutId: "pay_new",
      currency: "USD",
    };
    const saved = await payAdvisorEarnings(sql, payment);
    assert.equal(saved.payoutId, "pay_new");
    assert.equal(saved.paidCents, 2_000);
    assert.equal(saved.unpaidBefore, 5_850);
    assert.equal(saved.unpaidAfter, 3_850);
    await assert.rejects(() => payAdvisorEarnings(sql, { ...payment, payoutId: "pay_again" }), /already recorded/);
    await assert.rejects(
      () => payAdvisorEarnings(sql, { ...payment, requestId: "request02", payoutId: "pay_more", amountCents: 3_450 }),
      /under \$50/,
    );
    const readings = await db.query<{ advisor_earned: number }>("select advisor_earned from ora_readings order by id");
    assert.deepEqual(readings.rows.map((row) => Number(row.advisor_earned)), [500, 500, 40]);
    const wallet = await db.query<{ payout_coins: number }>("select payout_coins from ora_advisors");
    assert.equal(Number(wallet.rows[0].payout_coins), 80);
    const payouts = await db.query<{ id: string; amount_cents: number; status: string; method: string; reference_id: string }>(
      "select id, amount_cents, status, method, reference_id from ora_payouts order by id",
    );
    assert.equal(payouts.rows.length, 2);
    const recorded = payouts.rows.find((row) => row.id === "pay_new");
    assert.equal(Number(recorded?.amount_cents), 2_000);
    assert.equal(recorded?.status, "paid");
    assert.equal(recorded?.method, "Bank transfer");
    assert.equal(recorded?.reference_id, "TX-100");
    await db.close();
  });
});

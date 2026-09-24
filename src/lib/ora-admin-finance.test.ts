import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  assembleFinance,
  detailHasSecrets,
  filterFinance,
  financeDetail,
  paymentProduct,
  reconcileFinance,
  summarizeFinance,
  type FinanceSources,
} from "./ora-admin-finance.ts";

const now = new Date("2026-09-24T15:00:00.000Z");

function sources(extra: Partial<FinanceSources> = {}): FinanceSources {
  return {
    payments: [],
    readings: [],
    messages: [],
    tips: [],
    payouts: [],
    adjustments: [],
    ...extra,
  };
}

describe("admin finance", () => {
  it("classifies packs with the existing membership plans and does not invent a split", () => {
    assert.equal(paymentProduct("10"), "coin purchase");
    assert.equal(paymentProduct("300"), "coin purchase");
    assert.equal(paymentProduct("membership-mini"), "ora mini membership");
    assert.equal(paymentProduct("membership"), "ora membership");
  });

  it("counts succeeded cash once, keeps failed and refunded payments out of sales, and ignores payouts", () => {
    const txns = assembleFinance(
      sources({
        payments: [
          {
            id: "pay_ok",
            userId: "u1",
            customer: "Sarah",
            email: "sarah@example.com",
            packId: "50",
            provider: "stripe",
            amountCents: 500,
            currency: "USD",
            coins: 50,
            status: "succeeded",
            paidAt: "2026-09-24T12:00:00.000Z",
            createdAt: "2026-09-24T11:00:00.000Z",
          },
          {
            id: "pay_old",
            userId: "u1",
            customer: "Sarah",
            email: "sarah@example.com",
            packId: "10",
            provider: "stripe",
            amountCents: 100,
            currency: "USD",
            coins: 10,
            status: "succeeded",
            paidAt: "2026-08-02T12:00:00.000Z",
            createdAt: "2026-08-02T12:00:00.000Z",
          },
          {
            id: "pay_fail",
            userId: "u2",
            customer: "Noah",
            email: "",
            packId: "100",
            provider: "stripe",
            amountCents: 1000,
            currency: "USD",
            coins: 100,
            status: "failed",
            paidAt: "",
            createdAt: "2026-09-24T10:00:00.000Z",
          },
          {
            id: "pay_back",
            userId: "u3",
            customer: "Ava",
            email: "",
            packId: "membership",
            provider: "stripe",
            amountCents: 2500,
            currency: "USD",
            coins: 50,
            status: "refunded",
            paidAt: "2026-09-10T00:00:00.000Z",
            createdAt: "2026-09-10T00:00:00.000Z",
          },
          {
            id: "pay_mini",
            userId: "u4",
            customer: "Lina",
            email: "lina@example.com",
            packId: "membership-mini",
            provider: "stripe",
            amountCents: 1000,
            currency: "USD",
            coins: 20,
            status: "succeeded",
            paidAt: "2026-09-20T00:00:00.000Z",
            createdAt: "2026-09-20T00:00:00.000Z",
          },
        ],
        adjustments: [
          {
            id: "adj_dup",
            at: "2026-09-11T00:00:00.000Z",
            userId: "u3",
            customer: "Ava",
            email: "",
            readingId: "pay_back",
            coins: -50,
            kind: "refund",
            note: "Payment refund",
          },
          {
            id: "adj_read",
            at: "2026-09-12T00:00:00.000Z",
            userId: "u1",
            customer: "Sarah",
            email: "",
            readingId: "read_other",
            coins: 4,
            kind: "refund",
            note: "Sitting refund",
          },
        ],
        payouts: [
          {
            id: "po_paid",
            at: "2026-09-21T00:00:00.000Z",
            paidAt: "2026-09-22T00:00:00.000Z",
            advisorId: "adv_mira",
            advisor: "Mira",
            coins: 6,
            amountCents: 60,
            status: "paid",
            workflow: "paid",
            currency: "USD",
          },
          {
            id: "po_open",
            at: "2026-09-23T00:00:00.000Z",
            paidAt: "",
            advisorId: "adv_mira",
            advisor: "Mira",
            coins: 2,
            amountCents: 20,
            status: "requested",
            workflow: "processing",
            currency: "USD",
          },
        ],
      }),
    );
    const summary = summarizeFinance(txns, now);
    assert.equal(summary.grossLifetimeCents, 500 + 100 + 1000);
    assert.equal(summary.grossTodayCents, 500);
    assert.equal(summary.grossMonthCents, 500 + 1000);
    assert.equal(summary.coinPurchaseCents, 600);
    assert.equal(summary.miniCents, 1000);
    assert.equal(summary.fullMembershipCents, 0);
    assert.equal(summary.membershipCents, 1000);
    assert.equal(summary.oraRevenueCents, 1000);
    assert.equal(summary.refundCents, 2500 + 40);
    assert.equal(summary.completedPayoutCents, 60);
    assert.equal(summary.pendingPayoutCents, 20);
    assert.equal(txns.filter((row) => row.id === "pay_back").length, 1);
    assert.equal(txns.some((row) => row.id === "adj_dup"), false);
    assert.equal(summary.advisorEarningsCents, 0);
    const check = reconcileFinance(summary);
    assert.equal(check.cashMatches, true);
    assert.equal(check.oraExcludesCoinPurchases, true);
    assert.equal(check.payoutsSeparate, true);
  });

  it("uses stored reading, message, and tip shares and does not rewrite a historical split", () => {
    const txns = assembleFinance(
      sources({
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
            status: "completed",
            coinsSpent: 20,
            advisorEarned: 4,
            platformFee: 16,
            clawed: true,
          },
          {
            id: "read_live",
            at: "2026-09-24T00:00:00.000Z",
            customerId: "u1",
            customer: "Sarah",
            email: "",
            advisorId: "adv_mira",
            advisor: "Mira",
            status: "live",
            coinsSpent: 99,
            advisorEarned: 20,
            platformFee: 79,
            clawed: false,
          },
        ],
        messages: [
          {
            id: "msg_ok",
            at: "2026-09-01T00:00:00.000Z",
            customerId: "u1",
            customer: "Sarah",
            email: "",
            advisorId: "adv_rowan",
            advisor: "Rowan",
            coins: 2,
            amountCents: 20,
            advisorCents: 4,
            oraCents: 16,
            credited: true,
          },
          {
            id: "msg_no",
            at: "2026-09-01T00:00:00.000Z",
            customerId: "u1",
            customer: "Sarah",
            email: "",
            advisorId: "adv_rowan",
            advisor: "Rowan",
            coins: 2,
            amountCents: 20,
            advisorCents: 4,
            oraCents: 16,
            credited: false,
          },
        ],
        tips: [
          {
            id: "tip_ok",
            at: "2026-09-02T00:00:00.000Z",
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
          {
            id: "tip_bad",
            at: "2026-09-02T00:00:00.000Z",
            customerId: "u1",
            customer: "Sarah",
            email: "",
            advisorId: "adv_mira",
            advisor: "Mira",
            gift: "moon",
            coins: 30,
            advisorShare: 30,
            oraShare: 0,
            charged: false,
            credited: false,
          },
        ],
      }),
    );
    const reading = txns.find((row) => row.id === "read_old");
    assert.equal(reading?.advisorCents, 70);
    assert.equal(reading?.oraCents, 30);
    assert.equal(txns.filter((row) => row.id === "read_old").length, 1);
    assert.equal(txns.some((row) => row.id === "read_live"), false);
    assert.equal(txns.some((row) => row.id === "msg_no"), false);
    assert.equal(txns.some((row) => row.id === "tip_bad"), false);
    const summary = summarizeFinance(txns, now);
    assert.equal(summary.readingGrossCents, 100);
    assert.equal(summary.readingAdvisorCents, 70);
    assert.equal(summary.readingOraCents, 30);
    assert.equal(summary.messageGrossCents, 20);
    assert.equal(summary.messageAdvisorCents, 4);
    assert.equal(summary.messageOraCents, 16);
    assert.equal(summary.tipGrossCents, 100);
    assert.equal(summary.tipAdvisorCents, 50);
    assert.equal(summary.tipOraCents, 50);
    assert.equal(summary.activityGrossCents, 220);
    assert.equal(summary.activityAdvisorCents, 124);
    assert.equal(summary.activityOraCents, 96);
    assert.equal(summary.advisorEarningsCents, 124);
    assert.equal(summary.oraRevenueCents, 96);
    assert.equal(summary.shareGapCents, 0);
    assert.equal(reconcileFinance(summary).activityMatches, true);
    const clawed = txns.find((row) => row.id === "read_back");
    assert.equal(clawed?.status, "refunded");
    assert.equal(clawed?.activity, false);
  });

  it("filters the ledger without changing the stored amounts", () => {
    const txns = assembleFinance(
      sources({
        payments: [
          {
            id: "pay_today",
            userId: "u1",
            customer: "Sarah",
            email: "sarah@example.com",
            packId: "10",
            provider: "stripe",
            amountCents: 100,
            currency: "USD",
            coins: 10,
            status: "succeeded",
            paidAt: "2026-09-24T08:00:00.000Z",
            createdAt: "2026-09-24T08:00:00.000Z",
          },
        ],
        readings: [
          {
            id: "read_week",
            at: "2026-09-20T00:00:00.000Z",
            customerId: "u9",
            customer: "Noah",
            email: "",
            advisorId: "adv_mira",
            advisor: "Mira",
            status: "ended",
            coinsSpent: 10,
            advisorEarned: 2,
            platformFee: 8,
            clawed: false,
          },
        ],
      }),
    );
    assert.equal(filterFinance(txns, { range: "today" }, now).map((row) => row.id).join(), "pay_today");
    assert.deepEqual(
      filterFinance(txns, { range: "7d", type: "live reading", advisor: "mira" }, now).map((row) => row.id),
      ["read_week"],
    );
    assert.equal(
      filterFinance(txns, { range: "custom", from: "2026-09-01", to: "2026-09-30", customer: "sarah" }, now).length,
      1,
    );
    assert.equal(filterFinance(txns, { range: "all", status: "succeeded" }, now).length, 2);
    const detail = financeDetail(txns[0]!);
    assert.equal(detailHasSecrets(detail), false);
    assert.equal(JSON.stringify(detail).includes("provider_ref"), false);
    assert.equal(JSON.stringify(txns).includes("4242"), false);
  });

  it("drops card numbers and processor references even when a source row carries them", () => {
    const dirty = {
      id: "pay_secret",
      userId: "u1",
      customer: "Sarah",
      email: "sarah@example.com",
      packId: "10",
      provider: "stripe",
      amountCents: 100,
      currency: "USD",
      coins: 10,
      status: "succeeded",
      paidAt: "2026-09-24T08:00:00.000Z",
      createdAt: "2026-09-24T08:00:00.000Z",
      provider_ref: "cs_test_secret",
      cardNumber: "4242424242424242",
    };
    const txns = assembleFinance(sources({ payments: [dirty] }));
    const blob = JSON.stringify(txns);
    assert.equal(blob.includes("cs_test_secret"), false);
    assert.equal(blob.includes("4242424242424242"), false);
    assert.equal(detailHasSecrets(financeDetail(txns[0]!)), false);
  });
});

describe("admin finance database", () => {
  it("sums each stored row once and matches the display totals", async () => {
    const db = new PGlite();
    await db.exec(`
      create table ora_payments (
        id text primary key,
        user_id text not null,
        pack_id text not null,
        amount_cents integer not null,
        coins integer not null,
        status text not null,
        paid_at timestamptz,
        created_at timestamptz not null
      );
      create table ora_readings (
        id text primary key,
        client_id text not null,
        advisor_id text not null,
        status text not null,
        coins_spent integer not null,
        advisor_earned integer not null,
        platform_fee integer not null,
        started_at timestamptz not null
      );
      create table ora_earnings (
        id text primary key,
        reading_id text not null,
        status text not null
      );
      create table ora_paid_messages (
        id text primary key,
        customer_id text not null,
        advisor_id text not null,
        coins integer not null,
        amount_cents integer not null,
        advisor_share_cents integer not null,
        ora_share_cents integer not null,
        credited boolean not null,
        created_at timestamptz not null
      );
      create table ora_customer_tips (
        id text primary key,
        customer_id text not null,
        advisor_id text not null,
        gift text not null,
        coins integer not null,
        advisor_share_coins integer not null,
        ora_share_coins integer not null,
        charged boolean not null,
        credited boolean not null,
        created_at timestamptz not null
      );
      create table ora_payouts (
        id text primary key,
        advisor_id text not null,
        coins integer not null,
        amount_cents integer not null,
        status text not null,
        workflow text not null default '',
        paid_at timestamptz,
        created_at timestamptz not null
      );
      create table ora_adjustments (
        id text primary key,
        user_id text not null,
        reading_id text not null,
        coins integer not null,
        kind text not null,
        created_at timestamptz not null
      );
      insert into ora_payments values
        ('pay_ok', 'u1', '50', 500, 50, 'succeeded', '2026-09-24T12:00:00Z', '2026-09-24T12:00:00Z'),
        ('pay_fail', 'u2', '100', 1000, 100, 'failed', null, '2026-09-24T12:00:00Z'),
        ('pay_back', 'u3', 'membership', 2500, 50, 'refunded', '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'),
        ('pay_mini', 'u4', 'membership-mini', 1000, 20, 'succeeded', '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z');
      insert into ora_readings values
        ('read_old', 'u1', 'adv_mira', 'ended', 10, 7, 3, '2026-01-01T00:00:00Z'),
        ('read_back', 'u1', 'adv_mira', 'ended', 20, 4, 16, '2026-02-01T00:00:00Z');
      insert into ora_earnings values
        ('ern1', 'read_old', 'available'),
        ('ern2', 'read_back', 'clawed');
      insert into ora_paid_messages values
        ('msg_ok', 'u1', 'adv_rowan', 2, 20, 4, 16, true, '2026-09-01T00:00:00Z'),
        ('msg_no', 'u1', 'adv_rowan', 2, 20, 4, 16, false, '2026-09-01T00:00:00Z');
      insert into ora_customer_tips values
        ('tip_ok', 'u1', 'adv_mira', 'flower', 10, 5, 5, true, true, '2026-09-02T00:00:00Z');
      insert into ora_payouts values
        ('po_paid', 'adv_mira', 6, 60, 'paid', 'paid', '2026-09-22T00:00:00Z', '2026-09-21T00:00:00Z'),
        ('po_open', 'adv_mira', 2, 20, 'requested', 'processing', null, '2026-09-23T00:00:00Z');
      insert into ora_adjustments values
        ('adj_dup', 'u3', 'pay_back', -50, 'refund', '2026-09-11T00:00:00Z');
    `);
    const payments = await db.query<{
      id: string;
      user_id: string;
      pack_id: string;
      amount_cents: number;
      coins: number;
      status: string;
      paid_at: string | null;
      created_at: string;
    }>(`
      select id, user_id, pack_id, amount_cents, coins, status, paid_at::text as paid_at, created_at::text as created_at
      from ora_payments
    `);
    const readings = await db.query<{
      id: string;
      client_id: string;
      advisor_id: string;
      status: string;
      coins_spent: number;
      advisor_earned: number;
      platform_fee: number;
      at: string;
      clawed: boolean;
    }>(`
      select r.id, r.client_id, r.advisor_id, r.status, r.coins_spent, r.advisor_earned, r.platform_fee,
             r.started_at::text as at,
             exists (select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed') as clawed
      from ora_readings r
      where r.status in ('ended', 'completed')
    `);
    assert.equal(readings.rows.length, 2);
    const txns = assembleFinance(
      sources({
        payments: payments.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          customer: row.user_id,
          email: "",
          packId: row.pack_id,
          provider: "stripe",
          amountCents: Number(row.amount_cents),
          currency: "USD",
          coins: Number(row.coins),
          status: row.status,
          paidAt: row.paid_at || "",
          createdAt: String(row.created_at),
        })),
        readings: readings.rows.map((row) => ({
          id: row.id,
          at: row.at,
          customerId: row.client_id,
          customer: row.client_id,
          email: "",
          advisorId: row.advisor_id,
          advisor: row.advisor_id,
          status: row.status,
          coinsSpent: Number(row.coins_spent),
          advisorEarned: Number(row.advisor_earned),
          platformFee: Number(row.platform_fee),
          clawed: Boolean(row.clawed),
        })),
        messages: (
          await db.query<{
            id: string;
            customer_id: string;
            advisor_id: string;
            coins: number;
            amount_cents: number;
            advisor_share_cents: number;
            ora_share_cents: number;
            credited: boolean;
            created_at: string;
          }>(`
            select id, customer_id, advisor_id, coins, amount_cents, advisor_share_cents, ora_share_cents,
                   credited, created_at::text as created_at
            from ora_paid_messages
            where credited = true
          `)
        ).rows.map((row) => ({
          id: row.id,
          at: String(row.created_at),
          customerId: row.customer_id,
          customer: row.customer_id,
          email: "",
          advisorId: row.advisor_id,
          advisor: row.advisor_id,
          coins: Number(row.coins),
          amountCents: Number(row.amount_cents),
          advisorCents: Number(row.advisor_share_cents),
          oraCents: Number(row.ora_share_cents),
          credited: Boolean(row.credited),
        })),
        tips: (
          await db.query<{
            id: string;
            customer_id: string;
            advisor_id: string;
            gift: string;
            coins: number;
            advisor_share_coins: number;
            ora_share_coins: number;
            charged: boolean;
            credited: boolean;
            created_at: string;
          }>(`
            select id, customer_id, advisor_id, gift, coins, advisor_share_coins, ora_share_coins,
                   charged, credited, created_at::text as created_at
            from ora_customer_tips
            where charged = true and credited = true
          `)
        ).rows.map((row) => ({
          id: row.id,
          at: String(row.created_at),
          customerId: row.customer_id,
          customer: row.customer_id,
          email: "",
          advisorId: row.advisor_id,
          advisor: row.advisor_id,
          gift: row.gift,
          coins: Number(row.coins),
          advisorShare: Number(row.advisor_share_coins),
          oraShare: Number(row.ora_share_coins),
          charged: Boolean(row.charged),
          credited: Boolean(row.credited),
        })),
        payouts: (
          await db.query<{
            id: string;
            advisor_id: string;
            coins: number;
            amount_cents: number;
            status: string;
            workflow: string;
            paid_at: string | null;
            created_at: string;
          }>(`
            select id, advisor_id, coins, amount_cents, status, workflow, paid_at::text as paid_at, created_at::text as created_at
            from ora_payouts
          `)
        ).rows.map((row) => ({
          id: row.id,
          at: String(row.created_at),
          paidAt: row.paid_at || "",
          advisorId: row.advisor_id,
          advisor: row.advisor_id,
          coins: Number(row.coins),
          amountCents: Number(row.amount_cents),
          status: row.status,
          workflow: row.workflow,
          currency: "USD",
        })),
        adjustments: (
          await db.query<{
            id: string;
            user_id: string;
            reading_id: string;
            coins: number;
            kind: string;
            created_at: string;
          }>("select id, user_id, reading_id, coins, kind, created_at::text as created_at from ora_adjustments")
        ).rows.map((row) => ({
          id: row.id,
          at: String(row.created_at),
          userId: row.user_id,
          customer: row.user_id,
          email: "",
          readingId: row.reading_id,
          coins: Number(row.coins),
          kind: row.kind,
          note: "",
        })),
      }),
    );
    const ids = txns.map((row) => `${row.type}:${row.id}`);
    assert.equal(new Set(ids).size, ids.length);
    const summary = summarizeFinance(txns, now);
    assert.equal(summary.grossLifetimeCents, 1500);
    assert.equal(summary.coinPurchaseCents, 500);
    assert.equal(summary.miniCents, 1000);
    assert.equal(summary.refundCents, 2500);
    assert.equal(summary.readingGrossCents, 100);
    assert.equal(summary.readingAdvisorCents, 70);
    assert.equal(summary.readingOraCents, 30);
    assert.equal(summary.messageGrossCents, 20);
    assert.equal(summary.messageAdvisorCents, 4);
    assert.equal(summary.tipGrossCents, 100);
    assert.equal(summary.advisorEarningsCents, 70 + 4 + 50);
    assert.equal(summary.oraRevenueCents, 30 + 16 + 50 + 1000);
    assert.equal(summary.completedPayoutCents, 60);
    assert.equal(summary.pendingPayoutCents, 20);
    assert.equal(summary.grossLifetimeCents + summary.readingGrossCents + summary.messageGrossCents + summary.tipGrossCents > summary.oraRevenueCents, true);
    const check = reconcileFinance(summary);
    assert.equal(check.cashMatches, true);
    assert.equal(check.activityMatches, true);
    assert.equal(check.payoutsSeparate, true);
    await db.close();
  });
});

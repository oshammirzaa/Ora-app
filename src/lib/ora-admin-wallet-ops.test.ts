import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { confirmAdvisorPayout, releaseAdvisorPayout, reserveAdvisorPayout } from "./ora-admin-payout-ops.ts";
import { applyAdminCoinChange } from "./ora-admin-wallet-ops.ts";
import type { WalletSql } from "./ora-admin-wallet-ops.ts";

const SCHEMA = `
create table ora_wallets (
  user_id text primary key,
  coins integer not null default 0,
  promo_coins integer not null default 0
);
create table ora_adjustments (
  id text primary key,
  user_id text not null,
  reading_id text not null default '',
  coins integer not null,
  kind text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  actor_id text not null default '',
  previous_coins integer,
  next_coins integer,
  direction text not null default '',
  idempotency_key text not null default ''
);
create unique index ora_adjustments_idem_idx on ora_adjustments (idempotency_key) where idempotency_key <> '';
create table ora_ledger (
  id text primary key,
  user_id text not null,
  kind text not null,
  amount_coins integer not null default 0,
  seconds integer not null default 0,
  note text not null default '',
  ref_id text not null default '',
  created_at timestamptz not null default now()
);
create table ora_owner_log (
  id text primary key,
  actor_id text not null,
  act text not null,
  target_type text not null default '',
  target_id text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);
create table ora_advisors (
  id text primary key,
  user_id text not null,
  name text not null default '',
  payout_coins integer not null default 0,
  status text not null default 'live'
);
create table ora_payouts (
  id text primary key,
  user_id text not null,
  advisor_id text not null,
  coins integer not null,
  usd numeric(10,2) not null,
  status text not null default 'requested',
  currency text not null default 'USD',
  amount_cents integer not null default 0,
  note text not null default '',
  method text not null default '',
  reference_id text not null default '',
  idempotency_key text not null default '',
  workflow text not null default '',
  decided_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index ora_payouts_idempotency_idx on ora_payouts (idempotency_key) where idempotency_key <> '';
create table ora_payout_ledger (
  id text primary key,
  payout_id text not null default '',
  advisor_id text not null,
  actor_id text not null,
  verb text not null,
  coins integer not null,
  previous_available integer not null,
  next_available integer not null,
  reference_id text not null default '',
  note text not null default '',
  idempotency_key text not null default '',
  created_at timestamptz not null default now()
);
create unique index ora_payout_ledger_idem_idx on ora_payout_ledger (idempotency_key) where idempotency_key <> '';
create table ora_readings (
  id text primary key,
  advisor_id text not null,
  status text not null,
  advisor_earned integer not null default 0
);
create table ora_earnings (
  id text primary key,
  reading_id text not null,
  status text not null
);
create table ora_paid_messages (
  id text primary key,
  advisor_id text not null,
  advisor_share_cents integer not null default 0,
  credited boolean not null default false,
  coins integer not null default 0
);
create table ora_customer_tips (
  id text primary key,
  advisor_id text not null,
  advisor_share_coins integer not null default 0,
  charged boolean not null default false,
  credited boolean not null default false
);
`;

function sqlFor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): WalletSql {
  const run = async <T>(text: string, params: unknown[] = []) => (await db.query(text, params)).rows as T[];
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as WalletSql;
  sql.query = run;
  return sql;
}

describe("admin wallet and payout database", () => {
  it("adds and deducts coins once, stores the audit, and refuses a negative balance", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec("insert into ora_wallets (user_id, coins, promo_coins) values ('cust_1', 40, 10)");
    const sql = sqlFor(db);
    const added = await applyAdminCoinChange(sql, {
      userId: "cust_1",
      actorId: "admin_1",
      direction: "add",
      amount: 10,
      reason: "Goodwill credit",
      requestId: "req_addcoin1",
      adjustmentId: "adj_1",
      ledgerId: "led_1",
      auditId: "aud_1",
    });
    assert.equal(added.duplicate, false);
    assert.equal(added.previous, 40);
    assert.equal(added.next, 50);
    const again = await applyAdminCoinChange(sql, {
      userId: "cust_1",
      actorId: "admin_1",
      direction: "add",
      amount: 10,
      reason: "Goodwill credit",
      requestId: "req_addcoin1",
    });
    assert.equal(again.duplicate, true);
    const deducted = await applyAdminCoinChange(sql, {
      userId: "cust_1",
      actorId: "admin_1",
      direction: "deduct",
      amount: 15,
      reason: "Correct a duplicate pack",
      requestId: "req_deduct01",
      adjustmentId: "adj_2",
    });
    assert.equal(deducted.next, 35);
    const wallet = await db.query<{ coins: number; promo_coins: number }>("select coins, promo_coins from ora_wallets");
    assert.equal(Number(wallet.rows[0].coins), 35);
    assert.equal(Number(wallet.rows[0].promo_coins), 5);
    await assert.rejects(
      () =>
        applyAdminCoinChange(sql, {
          userId: "cust_1",
          actorId: "admin_1",
          direction: "deduct",
          amount: 36,
          reason: "Too much to remove",
          requestId: "req_toomuch1",
        }),
      /available balance/,
    );
    const still = await db.query<{ coins: number }>("select coins from ora_wallets");
    assert.equal(Number(still.rows[0].coins), 35);
    const audit = await db.query<{ actor_id: string; previous_coins: number; next_coins: number; direction: string }>(
      "select actor_id, previous_coins, next_coins, direction from ora_adjustments order by id",
    );
    assert.equal(audit.rows.length, 2);
    assert.equal(audit.rows[0].actor_id, "admin_1");
    assert.equal(Number(audit.rows[0].previous_coins), 40);
    assert.equal(Number(audit.rows[0].next_coins), 50);
    assert.equal(audit.rows[0].direction, "add");
  });

  it("reserves a payout once, confirms without a second deduction, and leaves monthly earnings unchanged", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec("insert into ora_advisors (id, user_id, name, payout_coins) values ('adv_1', 'user_adv', 'Mira', 5000)");
    await db.exec("insert into ora_readings (id, advisor_id, status, advisor_earned) values ('read_1', 'adv_1', 'ended', 5000)");
    const sql = sqlFor(db);
    const reserved = await reserveAdvisorPayout(sql, {
      advisorId: "adv_1",
      actorId: "admin_1",
      coins: 2000,
      method: "Bank transfer",
      note: "March transfer",
      requestId: "req_reserve1",
      currency: "USD",
      payoutId: "pay_1",
      ledgerId: "plg_1",
    });
    assert.equal(reserved.duplicate, false);
    assert.equal(reserved.available, 3000);
    const duplicate = await reserveAdvisorPayout(sql, {
      advisorId: "adv_1",
      actorId: "admin_1",
      coins: 2000,
      method: "Bank transfer",
      note: "March transfer",
      requestId: "req_reserve1",
      currency: "USD",
    });
    assert.equal(duplicate.duplicate, true);
    const afterReserve = await db.query<{ payout_coins: number }>("select payout_coins from ora_advisors");
    assert.equal(Number(afterReserve.rows[0].payout_coins), 3000);
    const earned = await db.query<{ coins: number }>("select advisor_earned as coins from ora_readings");
    assert.equal(Number(earned.rows[0].coins), 5000);
    const paid = await confirmAdvisorPayout(sql, {
      id: "pay_1",
      actorId: "admin_1",
      referenceId: "BANK-4582",
      note: "",
      requestId: "req_confirm1",
      ledgerId: "plg_2",
    });
    assert.equal(paid.duplicate, false);
    assert.equal(paid.available, 3000);
    const again = await confirmAdvisorPayout(sql, {
      id: "pay_1",
      actorId: "admin_1",
      referenceId: "BANK-4582",
      note: "",
      requestId: "req_confirm2",
      ledgerId: "plg_3",
    });
    assert.equal(again.duplicate, true);
    const afterPaid = await db.query<{ payout_coins: number }>("select payout_coins from ora_advisors");
    assert.equal(Number(afterPaid.rows[0].payout_coins), 3000);
    const status = await db.query<{ status: string; amount_cents: number }>("select status, amount_cents from ora_payouts");
    assert.equal(status.rows[0].status, "paid");
    assert.equal(Number(status.rows[0].amount_cents), 20000);
    const stillEarned = await db.query<{ coins: number }>("select advisor_earned as coins from ora_readings");
    assert.equal(Number(stillEarned.rows[0].coins), 5000);
    await assert.rejects(
      () =>
        releaseAdvisorPayout(sql, {
          id: "pay_1",
          actorId: "admin_1",
          note: "too late",
          requestId: "req_release1",
        }),
      /cannot be released/,
    );
  });

  it("returns a cancelled reservation to the available balance", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec("insert into ora_advisors (id, user_id, payout_coins) values ('adv_2', 'user_2', 1000)");
    await db.exec("insert into ora_readings (id, advisor_id, status, advisor_earned) values ('read_2', 'adv_2', 'ended', 1000)");
    const sql = sqlFor(db);
    const reserved = await reserveAdvisorPayout(sql, {
      advisorId: "adv_2",
      actorId: "admin_1",
      coins: 400,
      method: "PayPal",
      note: "",
      requestId: "req_hold0001",
      currency: "USD",
      payoutId: "pay_2",
    });
    assert.equal(reserved.available, 600);
    const released = await releaseAdvisorPayout(sql, {
      id: "pay_2",
      actorId: "admin_1",
      note: "Transfer failed",
      requestId: "req_fail0001",
      ledgerId: "plg_rel",
    });
    assert.equal(released.available, 1000);
    const wallet = await db.query<{ payout_coins: number }>("select payout_coins from ora_advisors");
    assert.equal(Number(wallet.rows[0].payout_coins), 1000);
    const row = await db.query<{ status: string }>("select status from ora_payouts");
    assert.equal(row.rows[0].status, "failed");
    const second = await releaseAdvisorPayout(sql, {
      id: "pay_2",
      actorId: "admin_1",
      note: "Transfer failed",
      requestId: "req_fail0002",
    });
    assert.equal(second.duplicate, true);
    const still = await db.query<{ payout_coins: number }>("select payout_coins from ora_advisors");
    assert.equal(Number(still.rows[0].payout_coins), 1000);
  });
});

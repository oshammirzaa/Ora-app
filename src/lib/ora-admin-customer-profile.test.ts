import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  assembleCustomerActivity,
  filterCustomerActivity,
  latestActivityAt,
  loadCustomerActivity,
  loadCustomerProfile,
  membershipView,
  readingMinuteTotals,
  succeededSpendCents,
} from "./ora-admin-customer-profile.ts";
import { buildPrivateReading } from "./ora-private-readings.ts";
import type { TransactionSql } from "./ora-admin-transactions.ts";

function sqlFor(db: PGlite): TransactionSql {
  const run = async <T>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows;
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] || "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as TransactionSql;
  sql.query = run;
  return sql;
}

describe("customer profile totals", () => {
  it("uses stored coins and does not invent referral or daily rewards", () => {
    const totals = readingMinuteTotals([
      { seconds: 180, bonusUsed: 180, weeklyUsed: 0, coins: 0 },
      { seconds: 300, bonusUsed: 180, weeklyUsed: 0, coins: 40 },
    ]);
    assert.equal(totals.readings, 2);
    assert.equal(totals.freeSeconds, 360);
    assert.equal(totals.paidSeconds, 120);
    assert.equal(totals.coins, 40);
    assert.equal(succeededSpendCents([{ status: "succeeded", amountCents: 2500 }, { status: "pending", amountCents: 9000 }]), 2500);
    assert.equal(membershipView({ plan: "membership", active: true, renewsAt: "" }).expiresAt, "");
    assert.equal(membershipView({}).name, "None");
    const reading = buildPrivateReading({
      id: "r1",
      clientId: "cust-a",
      clientName: "Ada",
      advisorId: "adv-1",
      advisorName: "Mira",
      startedAt: "2026-11-10T05:00:00.000Z",
      seconds: 180,
      bonusUsed: 180,
      coinsSpent: 0,
      status: "ended",
    });
    const activity = assembleCustomerActivity({ readings: [reading] });
    assert.deepEqual(activity.map((row) => row.kind), ["reading"]);
    assert.equal(activity.some((row) => row.label.toLowerCase().includes("referral")), false);
    assert.equal(activity.some((row) => row.label.toLowerCase().includes("daily")), false);
    assert.equal(latestActivityAt(["2026-11-01T00:00:00.000Z", "2026-11-10T05:00:00.000Z"]), "2026-11-10T05:00:00.000Z");
  });

  it("loads only the requested customer's stored rows", async () => {
    const db = new PGlite();
    await db.exec(`
      create table "user" (
        id text primary key,
        name text not null default '',
        email text not null default '',
        image text,
        "emailVerified" boolean not null default false,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now()
      );
      create table ora_profiles (
        user_id text primary key,
        display_name text not null default '',
        email text not null default '',
        role text not null default 'client',
        status text not null default 'active',
        created_at timestamptz not null default now()
      );
      create table ora_wallets (
        user_id text primary key,
        coins integer not null default 0,
        promo_coins integer not null default 0,
        bonus_seconds integer not null default 0,
        weekly_seconds integer not null default 0,
        subscribed boolean not null default false
      );
      create table ora_advisors (id text primary key, name text not null);
      create table ora_readings (
        id text primary key,
        client_id text not null,
        advisor_id text not null,
        started_at timestamptz not null default now(),
        ended_at timestamptz,
        seconds integer not null default 0,
        coins_spent integer not null default 0,
        bonus_used integer not null default 0,
        weekly_used integer not null default 0,
        status text not null
      );
      create table ora_messages (
        id text primary key,
        reading_id text not null,
        role text not null,
        body text not null default '',
        created_at timestamptz not null default now()
      );
      create table ora_payments (
        id text primary key,
        user_id text not null,
        pack_id text not null,
        amount_cents integer not null,
        coins integer not null,
        status text not null,
        created_at timestamptz not null default now()
      );
      create table ora_adjustments (
        id text primary key,
        user_id text not null,
        coins integer not null,
        kind text not null,
        note text not null default '',
        created_at timestamptz not null default now()
      );
      create table ora_ledger (
        id text primary key,
        user_id text not null,
        kind text not null,
        amount_coins integer not null default 0,
        created_at timestamptz not null default now()
      );
      insert into "user" (id, name, email, image) values
        ('cust-a', 'Ada', 'ada@example.com', 'https://cdn.example/ada.jpg'),
        ('cust-b', 'Bea', 'bea@example.com', null);
      insert into ora_profiles (user_id, display_name, email, created_at) values
        ('cust-a', 'Ada', 'ada@example.com', '2026-01-02T00:00:00Z'),
        ('cust-b', 'Bea', 'bea@example.com', '2026-01-03T00:00:00Z');
      insert into ora_wallets (user_id, coins, subscribed) values ('cust-a', 12, false);
      insert into ora_advisors (id, name) values ('adv-1', 'Mira');
      insert into ora_readings (id, client_id, advisor_id, started_at, ended_at, seconds, coins_spent, bonus_used, status) values
        ('r-a', 'cust-a', 'adv-1', '2026-11-10T05:00:00Z', '2026-11-10T05:03:00Z', 180, 0, 180, 'ended'),
        ('r-b', 'cust-b', 'adv-1', '2026-11-10T08:00:00Z', '2026-11-10T08:05:00Z', 300, 40, 0, 'ended');
      insert into ora_payments (id, user_id, pack_id, amount_cents, coins, status, created_at) values
        ('pay-a', 'cust-a', '50', 500, 50, 'succeeded', '2026-11-09T00:00:00Z'),
        ('pay-b', 'cust-b', '50', 500, 50, 'succeeded', '2026-11-09T00:00:00Z');
      insert into ora_adjustments (id, user_id, coins, kind, note, created_at) values
        ('adj-a', 'cust-a', 5, 'adjustment', 'Goodwill', '2026-11-08T00:00:00Z');
    `);
    const sql = sqlFor(db);
    const profile = await loadCustomerProfile(sql, "cust-a");
    assert.ok(profile);
    assert.equal(profile?.name, "Ada");
    assert.equal(profile?.email, "ada@example.com");
    assert.equal(profile?.image, "https://cdn.example/ada.jpg");
    assert.equal(profile?.coins, 12);
    assert.equal(profile?.readings, 1);
    assert.equal(profile?.coinsSpent, 0);
    assert.equal(profile?.spendCents, 500);
    assert.equal(profile?.membershipName, "None");
    assert.equal(profile?.membershipExpiresAt, "");
    assert.equal("password" in (profile || {}), false);
    const activity = await loadCustomerActivity(sql, "cust-a");
    assert.equal(activity.some((row) => row.id === "reading:r-b"), false);
    assert.equal(activity.some((row) => row.id === "payment:pay-b"), false);
    assert.equal(activity.some((row) => row.kind === "reading"), true);
    assert.equal(activity.some((row) => row.kind === "purchase"), true);
    assert.equal(activity.some((row) => row.kind === "adjustment"), true);
    assert.equal(filterCustomerActivity(activity, { advisor: "nobody" }).length, 0);
    assert.equal(filterCustomerActivity(activity, { advisor: "Mira" }).every((row) => row.kind === "reading"), true);
    const other = await loadCustomerProfile(sql, "missing");
    assert.equal(other, null);
  });
});

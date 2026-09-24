import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  ADVISOR_PROFILE_PROTECTED_COLUMNS,
  ADVISOR_PROFILE_UPDATE_SQL,
  ADVISOR_PROFILE_WRITE_COLUMNS,
  advisorEditDefaults,
  validateAdvisorProfileEdit,
  writeAdvisorProfile,
  type AdvisorProfileEditInput,
} from "./ora-admin-advisor-edit.ts";

function draft(extra: Partial<AdvisorProfileEditInput> = {}): AdvisorProfileEditInput {
  return {
    id: "adv_mira",
    name: "Mira Solane",
    bio: "Quiet tarot.",
    specialties: "Love, Tarot",
    years: 12,
    languages: "English",
    rateCoins: 22,
    online: true,
    visible: true,
    featured: false,
    approval: "approved",
    photoUrl: "/images/mira.jpg",
    ...extra,
  };
}

describe("advisor profile edit", () => {
  it("rejects invalid profile fields", () => {
    assert.throws(() => validateAdvisorProfileEdit(draft({ name: "  " })), /Display name is required/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ rateCoins: 3 })), /8 and 80/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ rateCoins: 81 })), /8 and 80/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ years: 61 })), /Years of experience/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ years: 1.5 })), /Years of experience/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ languages: "" })), /Languages are required/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ bio: "x".repeat(1201) })), /Bio must be 1200/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ specialties: "y".repeat(121) })), /Specialties must be 120/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ photoUrl: "javascript:alert(1)" })), /Photo must be/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ approval: "deleted" })), /approval status/);
    assert.throws(() => validateAdvisorProfileEdit(draft({ id: "" })), /Advisor is required/);
  });

  it("maps visibility, approval, and featured onto the existing status", () => {
    const live = validateAdvisorProfileEdit(draft({ featured: true, online: true }));
    assert.equal(live.status, "live");
    assert.equal(live.online, true);
    assert.equal(live.featured, true);
    const hidden = validateAdvisorProfileEdit(draft({ visible: false, online: true }));
    assert.equal(hidden.status, "paused");
    assert.equal(hidden.online, false);
    const suspended = validateAdvisorProfileEdit(draft({ approval: "suspended", visible: true, online: true }));
    assert.equal(suspended.status, "suspended");
    assert.equal(suspended.online, false);
    assert.deepEqual(advisorEditDefaults("live"), { approval: "approved", visible: true });
    assert.deepEqual(advisorEditDefaults("paused"), { approval: "approved", visible: false });
    assert.deepEqual(advisorEditDefaults("suspended"), { approval: "suspended", visible: false });
    assert.deepEqual(advisorEditDefaults("pending"), { approval: "pending", visible: false });
  });

  it("updates the same advisor row and leaves payout and revenue tables alone", async () => {
    const sqlText = ADVISOR_PROFILE_UPDATE_SQL.toLowerCase();
    const setClause = sqlText.slice(sqlText.indexOf("set"), sqlText.indexOf("where"));
    for (const column of ADVISOR_PROFILE_WRITE_COLUMNS) assert.match(setClause, new RegExp(`\\b${column}\\b`));
    for (const column of ADVISOR_PROFILE_PROTECTED_COLUMNS) {
      assert.equal(setClause.includes(column), false, column);
    }

    const db = new PGlite();
    await db.exec(`
      create table ora_advisors (
        id text primary key,
        user_id text not null,
        name text not null,
        slug text not null,
        bio text not null,
        specialties text not null,
        rate_coins integer not null,
        photo_url text not null,
        status text not null,
        trusted boolean not null,
        years integer not null,
        languages text not null,
        online boolean not null,
        busy boolean not null,
        payout_coins integer not null,
        pending_coins integer not null,
        message_earn_cents integer not null,
        rating numeric(2,1) not null,
        reviews integer not null
      );
      create table ora_readings (
        id text primary key,
        advisor_id text not null,
        coins_spent integer not null,
        advisor_earned integer not null,
        platform_fee integer not null
      );
      create table ora_payouts (
        id text primary key,
        advisor_id text not null,
        coins integer not null,
        amount_cents integer not null,
        status text not null
      );
      create table ora_payments (
        id text primary key,
        user_id text not null,
        amount_cents integer not null,
        status text not null
      );
      create table ora_wallets (
        user_id text primary key,
        coins integer not null
      );
      insert into ora_advisors values (
        'adv_mira', 'seed:mira', 'Mira Solane', 'mira', 'Quiet tarot.', 'Love, Tarot',
        22, '/images/mira.jpg', 'live', false, 12, 'English', true, true,
        40, 7, 15, 4.8, 10
      );
      insert into ora_readings values ('read_1', 'adv_mira', 10, 2, 8);
      insert into ora_payouts values ('pay_1', 'adv_mira', 6, 60, 'paid');
      insert into ora_payments values ('cash_1', 'cust_1', 500, 'succeeded');
      insert into ora_wallets values ('cust_1', 80);
    `);
    const sql = {
      query: async <T>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows,
    };
    const profile = validateAdvisorProfileEdit(
      draft({
        name: "Mira Night",
        bio: "A shorter about me.",
        specialties: "Tarot, Timing",
        years: 13,
        languages: "English, Spanish",
        rateCoins: 30,
        featured: true,
        visible: false,
        online: true,
        photoUrl: "/images/mira-new.jpg",
      }),
    );
    assert.equal(profile.status, "paused");
    assert.equal(profile.online, false);
    const saved = await writeAdvisorProfile(sql, profile);
    assert.equal(saved?.id, "adv_mira");
    const again = await writeAdvisorProfile(sql, profile);
    assert.equal(again?.id, "adv_mira");

    const advisors = await db.query<{
      id: string;
      name: string;
      slug: string;
      user_id: string;
      bio: string;
      specialties: string;
      rate_coins: number;
      photo_url: string;
      status: string;
      trusted: boolean;
      years: number;
      languages: string;
      online: boolean;
      busy: boolean;
      payout_coins: number;
      pending_coins: number;
      message_earn_cents: number;
      rating: string | number;
      reviews: number;
    }>("select * from ora_advisors");
    assert.equal(advisors.rows.length, 1);
    const row = advisors.rows[0];
    assert.equal(row.name, "Mira Night");
    assert.equal(row.slug, "mira");
    assert.equal(row.user_id, "seed:mira");
    assert.equal(row.bio, "A shorter about me.");
    assert.equal(row.specialties, "Tarot, Timing");
    assert.equal(Number(row.rate_coins), 30);
    assert.equal(row.photo_url, "/images/mira-new.jpg");
    assert.equal(row.status, "paused");
    assert.equal(Boolean(row.trusted), true);
    assert.equal(Number(row.years), 13);
    assert.equal(row.languages, "English, Spanish");
    assert.equal(Boolean(row.online), false);
    assert.equal(Boolean(row.busy), false);
    assert.equal(Number(row.payout_coins), 40);
    assert.equal(Number(row.pending_coins), 7);
    assert.equal(Number(row.message_earn_cents), 15);
    assert.equal(Number(row.rating), 4.8);
    assert.equal(Number(row.reviews), 10);

    const readings = await db.query<{ advisor_earned: number; platform_fee: number }>(
      "select advisor_earned, platform_fee from ora_readings",
    );
    assert.deepEqual(readings.rows.map((item) => [Number(item.advisor_earned), Number(item.platform_fee)]), [[2, 8]]);
    const payouts = await db.query<{ amount_cents: number; status: string }>("select amount_cents, status from ora_payouts");
    assert.equal(Number(payouts.rows[0].amount_cents), 60);
    assert.equal(payouts.rows[0].status, "paid");
    const payments = await db.query<{ amount_cents: number }>("select amount_cents from ora_payments");
    assert.equal(Number(payments.rows[0].amount_cents), 500);
    const wallets = await db.query<{ coins: number }>("select coins from ora_wallets");
    assert.equal(Number(wallets.rows[0].coins), 80);
    await db.close();
  });
});

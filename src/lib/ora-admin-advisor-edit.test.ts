import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  ADVISOR_PROFILE_PROTECTED_COLUMNS,
  ADVISOR_PROFILE_UPDATE_SQL,
  ADVISOR_PROFILE_WRITE_COLUMNS,
  advisorEditDefaults,
  applicationStatusForFloor,
  floorStatusAfterApprovalEdit,
  syncAdvisorApprovalRecord,
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

  it("restores a live desk when pending or suspended is approved again", () => {
    const leftoverHidden = validateAdvisorProfileEdit(draft({ visible: false, online: true, approval: "approved" }));
    assert.equal(leftoverHidden.status, "paused");
    assert.deepEqual(floorStatusAfterApprovalEdit("pending", leftoverHidden), { status: "live", online: false });
    assert.deepEqual(floorStatusAfterApprovalEdit("suspended", leftoverHidden), { status: "live", online: false });
    const stillHidden = floorStatusAfterApprovalEdit("paused", leftoverHidden);
    assert.deepEqual(stillHidden, { status: "paused", online: false });
    assert.deepEqual(floorStatusAfterApprovalEdit("live", leftoverHidden), { status: "paused", online: false });
    const shown = validateAdvisorProfileEdit(draft({ visible: true, online: false, approval: "approved" }));
    assert.deepEqual(floorStatusAfterApprovalEdit("pending", shown), { status: "live", online: false });
    const backToPending = validateAdvisorProfileEdit(draft({ approval: "pending", visible: true, online: true }));
    assert.equal(floorStatusAfterApprovalEdit("live", backToPending).status, "pending");
    assert.equal(applicationStatusForFloor("live"), "approved");
    assert.equal(applicationStatusForFloor("pending"), "pending");
    assert.equal(applicationStatusForFloor("paused"), null);
    assert.equal(applicationStatusForFloor("suspended"), null);
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

  it("syncs the application when pending is approved again and leaves a deliberate pause alone", async () => {
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
        payout_coins integer not null default 0,
        pending_coins integer not null default 0,
        message_earn_cents integer not null default 0,
        rating numeric(2,1) not null default 0,
        reviews integer not null default 0
      );
      create table ora_profiles (
        user_id text primary key,
        role text not null
      );
      create table ora_applications (
        id text primary key,
        user_id text not null,
        status text not null,
        created_at timestamptz not null,
        decided_at timestamptz,
        decided_by text not null default ''
      );
      insert into ora_advisors (
        id, user_id, name, slug, bio, specialties, rate_coins, photo_url, status, trusted, years, languages, online, busy, payout_coins
      ) values (
        'adv_ada', 'user_ada', 'Ada Mora', 'ada', 'Tarot.', 'Love', 22, '/images/ada.jpg', 'pending', false, 6, 'English', false, false, 12
      );
      insert into ora_profiles values ('user_ada', 'client');
      insert into ora_applications values
        ('app_old', 'user_ada', 'rejected', '2026-01-01T00:00:00Z', null, ''),
        ('app_new', 'user_ada', 'approved', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', 'owner');
    `);
    const sql = {
      query: async <T>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows,
    };
    const reapproved = validateAdvisorProfileEdit(draft({ id: "adv_ada", name: "Ada Mora", visible: false, online: true }));
    const restored = floorStatusAfterApprovalEdit("pending", reapproved);
    assert.equal(restored.status, "live");
    await writeAdvisorProfile(sql, { ...reapproved, ...restored });
    await syncAdvisorApprovalRecord(sql, {
      userId: "user_ada",
      previousStatus: "pending",
      status: restored.status,
      decidedBy: "admin_1",
    });
    const [advisor] = (await db.query<{ status: string; online: boolean; payout_coins: number }>(
      "select status, online, payout_coins from ora_advisors where id = 'adv_ada'",
    )).rows;
    assert.equal(advisor.status, "live");
    assert.equal(Boolean(advisor.online), false);
    assert.equal(Number(advisor.payout_coins), 12);
    const [role] = (await db.query<{ role: string }>("select role from ora_profiles where user_id = 'user_ada'")).rows;
    assert.equal(role.role, "advisor");
    const apps = (
      await db.query<{ id: string; status: string }>("select id, status from ora_applications order by created_at")
    ).rows;
    assert.deepEqual(
      apps.map((row) => [row.id, row.status]),
      [
        ["app_old", "rejected"],
        ["app_new", "approved"],
      ],
    );

    const paused = validateAdvisorProfileEdit(draft({ id: "adv_ada", name: "Ada Mora", visible: false, online: true }));
    const kept = floorStatusAfterApprovalEdit("live", paused);
    assert.equal(kept.status, "paused");
    await writeAdvisorProfile(sql, { ...paused, ...kept });
    await syncAdvisorApprovalRecord(sql, {
      userId: "user_ada",
      previousStatus: "live",
      status: kept.status,
      decidedBy: "admin_1",
    });
    const [hidden] = (await db.query<{ status: string }>("select status from ora_advisors where id = 'adv_ada'")).rows;
    assert.equal(hidden.status, "paused");
    const [stillApproved] = (
      await db.query<{ status: string }>("select status from ora_applications where id = 'app_new'")
    ).rows;
    assert.equal(stillApproved.status, "approved");

    const pendingAgain = validateAdvisorProfileEdit(draft({ id: "adv_ada", name: "Ada Mora", approval: "pending" }));
    await writeAdvisorProfile(sql, pendingAgain);
    await syncAdvisorApprovalRecord(sql, {
      userId: "user_ada",
      previousStatus: "paused",
      status: pendingAgain.status,
      decidedBy: "admin_1",
    });
    const [pendingRow] = (await db.query<{ status: string }>("select status from ora_advisors where id = 'adv_ada'")).rows;
    assert.equal(pendingRow.status, "pending");
    const [pendingApp] = (
      await db.query<{ status: string }>("select status from ora_applications where id = 'app_new'")
    ).rows;
    assert.equal(pendingApp.status, "pending");
    const [roleKept] = (await db.query<{ role: string }>("select role from ora_profiles where user_id = 'user_ada'")).rows;
    assert.equal(roleKept.role, "advisor");

    const approvedAgain = validateAdvisorProfileEdit(draft({ id: "adv_ada", name: "Ada Mora", visible: false, online: true }));
    const liveAgain = floorStatusAfterApprovalEdit("pending", approvedAgain);
    await writeAdvisorProfile(sql, { ...approvedAgain, ...liveAgain });
    await syncAdvisorApprovalRecord(sql, {
      userId: "user_ada",
      previousStatus: "pending",
      status: liveAgain.status,
      decidedBy: "admin_2",
    });
    const [restoredRow] = (await db.query<{ status: string }>("select status from ora_advisors where id = 'adv_ada'")).rows;
    assert.equal(restoredRow.status, "live");
    const [restoredApp] = (
      await db.query<{ status: string; decided_by: string }>(
        "select status, decided_by from ora_applications where id = 'app_new'",
      )
    ).rows;
    assert.equal(restoredApp.status, "approved");
    assert.equal(restoredApp.decided_by, "admin_2");
    await db.close();
  });
});

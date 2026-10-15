import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alertAllowed,
  buildSlots,
  canCustomerCancel,
  chargeableSeconds,
  civilWeekday,
  firstNonOverlapping,
  giftPurchaseLocked,
  giftRedeemAllowed,
  nextStreak,
  parseSmartReplies,
  performanceScore,
  PERFORMANCE_MIN_SAMPLE,
  rangesOverlap,
  recoveredDisplaySeconds,
  referralEligible,
  rewardCoinsForDay,
  referralFraudDecision,
  streakNotice,
  streakRewardMinutes,
  rewardIpBlocked,
  wallTimeToUtcMs,
} from "./ora-advanced-rules.ts";
import { journalKeyIsProductionReady, openText, sealText, totpCodes, verifyTotp } from "./ora-advanced-crypto.server.ts";

describe("schedule rules", () => {
  it("converts wall time and builds non-overlapping future slots", () => {
    const noon = wallTimeToUtcMs("2026-01-15", "12:00", "UTC");
    assert.equal(noon, Date.UTC(2026, 0, 15, 12, 0, 0));
    const winter = wallTimeToUtcMs("2026-01-15", "12:00", "America/New_York");
    assert.equal(winter, Date.UTC(2026, 0, 15, 17, 0, 0));
    assert.equal(civilWeekday("2026-01-15", "UTC"), "thu");
    const slots = buildSlots({
      date: "2026-01-15",
      timeZone: "UTC",
      windows: [{ start: "12:00", end: "13:00" }],
      durationMin: 30,
      nowMs: Date.UTC(2026, 0, 15, 11, 0, 0),
      leadMin: 15,
      busy: [{ startMs: noon, endMs: noon + 30 * 60 * 1000 }],
    });
    assert.equal(slots.length, 1);
    assert.equal(slots[0].startMs, noon + 30 * 60 * 1000);
    assert.equal(rangesOverlap(0, 10, 10, 20), false);
    assert.equal(rangesOverlap(0, 11, 10, 20), true);
  });

  it("keeps the cancellation window and rejects a second booking on the same range", () => {
    const start = Date.UTC(2026, 3, 1, 15, 0, 0);
    assert.equal(canCustomerCancel(start, start - 3 * 3600 * 1000, 2), true);
    assert.equal(canCustomerCancel(start, start - 30 * 60 * 1000, 2), false);
    const kept = firstNonOverlapping([
      { id: "a", startMs: 0, endMs: 10 },
      { id: "b", startMs: 5, endMs: 15 },
      { id: "c", startMs: 10, endMs: 20 },
    ]);
    assert.deepEqual(kept.map((row) => row.id), ["a", "c"]);
  });
});

describe("daily rewards", () => {
  it("enforces a 24h cooldown and a seven-day ladder", () => {
    const now = 10 * 24 * 3600 * 1000;
    assert.equal(nextStreak({ lastClaimAt: null, streak: 0, now }).day, 1);
    const early = nextStreak({ lastClaimAt: now - 60_000, streak: 3, now });
    assert.equal(early.ok, false);
    const next = nextStreak({ lastClaimAt: now - 25 * 3600 * 1000, streak: 3, now });
    assert.deepEqual({ ok: next.ok, day: next.day }, { ok: true, day: 4 });
    const reset = nextStreak({ lastClaimAt: now - 50 * 3600 * 1000, streak: 6, now });
    assert.equal(reset.day, 1);
    const wrap = nextStreak({ lastClaimAt: now - 25 * 3600 * 1000, streak: 7, now });
    assert.equal(wrap.day, 1);
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((day) => rewardCoinsForDay(day)), [1, 1, 2, 2, 3, 3, 5]);
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((day) => streakRewardMinutes(day)), [0, 0, 0, 0, 0, 0, 3]);
    assert.equal(streakNotice(1).body, "Day 1 streak completed! Keep going!");
    assert.equal(streakNotice(2).title, "2-Day Streak Completed");
    assert.equal(streakNotice(2).body, "2-day streak successful! Only 5 days left!");
    assert.equal(streakNotice(6).body, "6-day streak completed! Just one more day!");
    assert.equal(streakNotice(7).title, "3 Free Minutes Earned");
    assert.equal(streakNotice(7).body, "Congratulations! You've earned 3 FREE reading minutes!");
    assert.equal(rewardIpBlocked(1, 2), false);
    assert.equal(rewardIpBlocked(2, 2), true);
  });
});

describe("smart replies and alerts", () => {
  it("caps replies at 30, keeps categories, and dedupes", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ body: `Hello ${i}`, category: i % 2 ? "thanks" : "nope" }));
    rows.push({ body: "Hello 0", category: "greetings" });
    const parsed = parseSmartReplies(rows);
    assert.equal(parsed.length, 30);
    assert.equal(parsed[0].category, "general");
    assert.equal(parsed[1].category, "thanks");
  });

  it("blocks repeat online alerts inside the cooldown", () => {
    const now = 1_000_000;
    assert.equal(alertAllowed(null, now), true);
    assert.equal(alertAllowed(now - 60_000, now, 6 * 3600 * 1000), false);
    assert.equal(alertAllowed(now - 7 * 3600 * 1000, now, 6 * 3600 * 1000), true);
  });
});

describe("referrals, gifts, and performance", () => {
  it("pays a referral only after a real paid reading", () => {
    assert.equal(
      referralEligible({ referrerId: "a", referredId: "a", alreadyRewarded: false, paidCoins: 10 }),
      false,
    );
    assert.equal(
      referralEligible({
        referrerId: "a",
        referredId: "b",
        referrerEmail: "A@x.com",
        referredEmail: "a@x.com",
        alreadyRewarded: false,
        paidCoins: 10,
      }),
      false,
    );
    assert.equal(
      referralEligible({ referrerId: "a", referredId: "b", alreadyRewarded: false, paidCoins: 0 }),
      false,
    );
    assert.equal(
      referralEligible({ referrerId: "a", referredId: "b", alreadyRewarded: true, paidCoins: 12 }),
      false,
    );
    assert.equal(
      referralEligible({ referrerId: "a", referredId: "b", alreadyRewarded: false, paidCoins: 12, refunded: true }),
      false,
    );
    assert.equal(
      referralEligible({ referrerId: "a", referredId: "b", alreadyRewarded: false, paidCoins: 12 }),
      true,
    );
    assert.equal(
      referralFraudDecision({
        referredIp: "h1",
        referrerIp: "h1",
        referredDevice: "d1",
        referrerDevice: "d2",
        sameDeviceAsOther: false,
        sameIpAsOther: false,
      }).status,
      "review",
    );
    assert.equal(
      referralFraudDecision({
        referredIp: "h1",
        referrerIp: "h1",
        referredDevice: "d1",
        referrerDevice: "d1",
        sameDeviceAsOther: false,
        sameIpAsOther: false,
      }).status,
      "blocked",
    );
    assert.equal(
      referralFraudDecision({
        referredIp: "h1",
        referrerIp: "h2",
        referredDevice: "d1",
        referrerDevice: "d2",
        sameDeviceAsOther: false,
        sameIpAsOther: false,
      }).status,
      "ok",
    );
  });

  it("keeps unpaid gifts locked and refuses a second redeem", () => {
    assert.equal(giftRedeemAllowed("unpaid"), false);
    assert.equal(giftRedeemAllowed("redeemed"), false);
    assert.equal(giftRedeemAllowed("paid"), true);
    assert.equal(giftPurchaseLocked(false, false), true);
    assert.equal(giftPurchaseLocked(true, false), true);
    assert.equal(giftPurchaseLocked(true, true), false);
  });

  it("hides the score below the sample and never marks it public", () => {
    const base = {
      paidCompleted: PERFORMANCE_MIN_SAMPLE - 1,
      returningClients: 1,
      distinctClients: 2,
      avgRating: 5,
      ratingCount: 2,
      avgResponseSeconds: 20,
      accepted: 4,
      missed: 0,
      onlineSeconds: 10_000,
      scheduledCompleted: 1,
      rangeSeconds: 7 * 86400,
    };
    const thin = performanceScore(base);
    assert.equal(thin.score, null);
    assert.equal(thin.public, false);
    const ready = performanceScore({ ...base, paidCompleted: 8 });
    assert.equal(typeof ready.score, "number");
    assert.equal(ready.public, false);
    assert.ok((ready.score ?? 0) >= 0 && (ready.score ?? 0) <= 100);
  });
});

describe("chat recovery and journal seal", () => {
  it("does not let the device lower server time or invent chargeable seconds", () => {
    assert.equal(recoveredDisplaySeconds(10, 40), 40);
    assert.equal(recoveredDisplaySeconds(50, 40), 50);
    const start = 1_000_000;
    assert.equal(chargeableSeconds(start, start + 90_500), 90);
    assert.equal(chargeableSeconds(Number.NaN, start), 0);
  });

  it("seals journal text and checks a totp window", () => {
    const sealed = sealText("private note");
    assert.equal(sealed.includes("private"), false);
    assert.equal(openText(sealed), "private note");
    const secret = "JBSWY3DPEHPK3PXP";
    const [code] = totpCodes(secret, 1_700_000_000_000);
    assert.equal(verifyTotp(secret, code, 1_700_000_000_000), true);
    assert.equal(verifyTotp(secret, "000000", 1_700_000_000_000), false);
    assert.equal(typeof journalKeyIsProductionReady(), "boolean");
  });

  it("survives a burst of overlapping booking attempts", () => {
    const attempts = Array.from({ length: 250 }, (_, i) => ({
      startMs: i < 100 ? 0 : i * 10,
      endMs: i < 100 ? 30 : i * 10 + 5,
    }));
    const kept = firstNonOverlapping(attempts);
    assert.equal(kept.filter((row) => row.startMs === 0).length, 1);
    assert.ok(kept.length < attempts.length);
  });
});

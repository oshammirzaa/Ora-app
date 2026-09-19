import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCountdown,
  MEMBERSHIP_PLANS,
  nextRefreshAt,
  planByPackId,
} from "./ora-membership-plan.ts";

test("plans are monthly and do not share refresh windows", () => {
  assert.equal(MEMBERSHIP_PLANS.mini.amountCents, 1000);
  assert.equal(MEMBERSHIP_PLANS.mini.coins, 20);
  assert.equal(MEMBERSHIP_PLANS.mini.refreshMs, 7 * 24 * 3600 * 1000);
  assert.equal(MEMBERSHIP_PLANS.membership.amountCents, 2500);
  assert.equal(MEMBERSHIP_PLANS.membership.coins, 50);
  assert.equal(MEMBERSHIP_PLANS.membership.refreshMs, 48 * 3600 * 1000);
  assert.notEqual(MEMBERSHIP_PLANS.mini.packId, MEMBERSHIP_PLANS.membership.packId);
});

test("pack lookup only returns one plan", () => {
  assert.equal(planByPackId("membership-mini")?.plan, "mini");
  assert.equal(planByPackId("membership")?.plan, "membership");
  assert.equal(planByPackId("500"), null);
});

test("unused minutes reset to a future window instead of accumulating", () => {
  const interval = MEMBERSHIP_PLANS.mini.refreshMs;
  const now = Date.parse("2026-09-19T00:00:00Z");
  const stale = now - interval * 2 - 1000;
  const next = nextRefreshAt(stale, interval, now);
  assert.ok(next > now);
  assert.ok(next - now <= interval);
});

test("countdown copy", () => {
  const now = Date.parse("2026-09-19T00:00:00Z");
  const inFourDays = new Date(now + 4 * 86400000 + 12 * 3600000).toISOString();
  assert.equal(formatCountdown(inFourDays, now), "4 days 12 hours");
});

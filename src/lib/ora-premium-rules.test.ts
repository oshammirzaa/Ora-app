import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { premiumFlags, resolvePremiumFlags } from "./ora-feature-flags.ts";
import {
  badgeSnapshot,
  checkInStreak,
  compatibilityReport,
  extensionDecision,
  extensionQuote,
  extensionRefundCoins,
  localDateKey,
  moonAgeDays,
  moonPhaseId,
  offerExpired,
  oracleDeal,
  premiumAccess,
  queuePosition,
  sunSign,
  tarotFor,
  vaultBodyAllowed,
  waitEstimateMinutes,
} from "./ora-premium-rules.ts";

describe("ora membership gate", () => {
  it("allows only a live Ora Membership", () => {
    assert.equal(premiumAccess({ active: true, plan: "membership", renewsAt: "2099-01-01T00:00:00.000Z" }), true);
    assert.equal(premiumAccess({ active: true, plan: "mini", renewsAt: "2099-01-01T00:00:00.000Z" }), false);
    assert.equal(premiumAccess({ active: false, plan: "membership" }), false);
    assert.equal(
      premiumAccess({ active: true, plan: "membership", renewsAt: "2020-01-01T00:00:00.000Z" }, Date.parse("2024-01-01T00:00:00.000Z")),
      false,
    );
  });
});

describe("compatibility and daily cards", () => {
  it("is stable for the same two people", () => {
    const a = compatibilityReport({
      selfName: "Nora",
      selfBirth: "1992-04-04",
      partnerName: "Jules",
      partnerBirth: "1990-11-02",
    });
    const b = compatibilityReport({
      selfName: "Nora",
      selfBirth: "1992-04-04",
      partnerName: "Jules",
      partnerBirth: "1990-11-02",
    });
    assert.ok(a && b);
    assert.deepEqual(a, b);
    assert.equal(a?.selfSign, "aries");
    assert.equal(sunSign(11, 2), "scorpio");
    assert.ok((a?.overall || 0) >= 42 && (a?.overall || 0) <= 96);
  });

  it("keeps the same daily tarot and the same three-card deal", () => {
    assert.equal(tarotFor("user-1", "2026-10-15").id, tarotFor("user-1", "2026-10-15").id);
    const deal = oracleDeal("user-1", "2026-10-15").map((card) => card.id);
    assert.deepEqual(deal, oracleDeal("user-1", "2026-10-15").map((card) => card.id));
    assert.equal(new Set(deal).size, 3);
  });
});

describe("moon", () => {
  it("treats the reference new moon as new", () => {
    const age = moonAgeDays(Date.UTC(2000, 0, 6, 18, 14, 0));
    assert.ok(age < 0.01);
    assert.equal(moonPhaseId(age), "new");
    assert.equal(moonPhaseId(14.8), "full");
  });

  it("respects a timezone when naming the local day", () => {
    const ms = Date.UTC(2026, 0, 1, 2, 30);
    assert.equal(localDateKey(ms, "UTC"), "2026-01-01");
    assert.equal(localDateKey(ms, "America/Los_Angeles"), "2025-12-31");
  });
});

describe("reading extensions", () => {
  it("prices from the existing per-minute rate and refuses unsafe charges", () => {
    assert.deepEqual(extensionQuote(5, 8), { minutes: 5, seconds: 300, coins: 40, rate: 8 });
    assert.equal(extensionQuote(4, 8), null);
    assert.equal(extensionRefundCoins(120, 8), 16);
    assert.deepEqual(extensionDecision({ enabled: false, member: true, live: true, balance: 100, cost: 40, duplicate: false }), {
      charge: false,
      reason: "disabled",
    });
    assert.equal(extensionDecision({ enabled: true, member: false, live: true, balance: 100, cost: 40, duplicate: false }).reason, "locked");
    assert.equal(extensionDecision({ enabled: true, member: true, live: true, balance: 10, cost: 40, duplicate: false }).reason, "balance");
    assert.equal(extensionDecision({ enabled: true, member: true, live: true, balance: 40, cost: 40, duplicate: true }).reason, "duplicate");
    assert.equal(extensionDecision({ enabled: true, member: true, live: true, balance: 40, cost: 40, duplicate: false }).charge, true);
  });
});

describe("queue, streaks, badges", () => {
  it("orders the queue and expires invitations", () => {
    const rows = ["2026-01-01T00:00:00.000Z", "2026-01-01T00:01:00.000Z", "2026-01-01T00:02:00.000Z"];
    assert.equal(queuePosition(rows, rows[0]!), 1);
    assert.equal(queuePosition(rows, rows[2]!), 3);
    assert.equal(offerExpired("2026-01-01T00:01:00.000Z", Date.parse("2026-01-01T00:01:01.000Z")), true);
    assert.equal(waitEstimateMinutes(2, [60, 60, 60]), null);
    assert.equal(waitEstimateMinutes(2, [60, 90, 60, 90, 60]), 2);
  });

  it("counts a check-in streak and does not duplicate badge math", () => {
    assert.equal(checkInStreak(["2026-01-01", "2026-01-02", "2026-01-03"], "2026-01-03"), 3);
    assert.equal(checkInStreak(["2026-01-01", "2026-01-03"], "2026-01-03"), 1);
    const badges = badgeSnapshot({
      endedReadings: 1,
      checkInStreak: 7,
      tarotReveals: 3,
      moonDays: 7,
      journalEntries: 2,
      memberYears: 0.2,
    });
    assert.equal(badges.filter((badge) => badge.earned).map((badge) => badge.id).join(","), "first-connection,seven-day,moon-explorer");
    assert.equal(badges.find((badge) => badge.id === "tarot-explorer")?.progress, 3);
  });

  it("blocks payment solicitation in the vault", () => {
    assert.equal(vaultBodyAllowed("A note for the week ahead."), true);
    assert.equal(vaultBodyAllowed("Please paypal me extra."), false);
  });
});

describe("premium flags", () => {
  it("keeps paid extensions off unless explicitly enabled", () => {
    const flags = premiumFlags();
    if (process.env.ORA_ADVANCED_PREVIEW === "1" || process.env.ORA_ADVANCED_FEATURES === "1") {
      assert.equal(flags.tarot, true);
    }
    assert.equal(flags.extensions, process.env.ORA_FLAG_EXTENSIONS === "1");
    const enabled = resolvePremiumFlags({ ...flags, extensions: false }, { extensions: true, tarot: false });
    assert.equal(enabled.extensions, process.env.ORA_FLAG_EXTENSIONS === "0" ? false : true);
    assert.equal(enabled.tarot, false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advisorAccessGate,
  advisorDeniedMessage,
  advisorLoginOutcome,
  applicationBucket,
  formatDuration,
  overlapSeconds,
  panelSplit,
  readingMinutes,
  requiredApplicationError,
  safeApplicationPhoto,
} from "./ora-advisor-auth.ts";

describe("advisorAccessGate", () => {
  it("rejects customers, pending applicants, and paused desks", () => {
    assert.equal(advisorAccessGate({ signedIn: false }).reason, "unauthenticated");
    assert.equal(advisorAccessGate({ signedIn: true }).reason, "not_advisor");
    assert.equal(advisorAccessGate({ signedIn: true, advisorStatus: "pending" }).reason, "pending");
    assert.equal(advisorAccessGate({ signedIn: true, advisorStatus: "declined" }).reason, "declined");
    assert.equal(advisorAccessGate({ signedIn: true, advisorStatus: "paused" }).reason, "paused");
    assert.equal(advisorAccessGate({ signedIn: true, advisorStatus: "suspended" }).reason, "suspended");
    assert.equal(
      advisorAccessGate({ signedIn: true, profileStatus: "suspended", advisorStatus: "live" }).reason,
      "suspended",
    );
  });

  it("allows only an approved live advisor", () => {
    assert.deepEqual(advisorAccessGate({ signedIn: true, advisorStatus: "live" }), { ok: true });
    assert.equal(advisorDeniedMessage("not_advisor"), "Advisor access only.");
  });
});

describe("panelSplit", () => {
  it("gives the advisor 20% and Ora 80%", () => {
    assert.deepEqual(panelSplit(100), { advisorEarnings: 20, platformRevenue: 80 });
    assert.deepEqual(panelSplit(7), { advisorEarnings: 1, platformRevenue: 6 });
    assert.deepEqual(panelSplit(0), { advisorEarnings: 0, platformRevenue: 0 });
  });

  it("converts seconds to reading minutes", () => {
    assert.equal(readingMinutes(90), 1.5);
    assert.equal(readingMinutes(0), 0);
  });
});

describe("overlapSeconds", () => {
  it("counts only the time inside a day/week/month window", () => {
    const start = new Date("2026-09-12T10:00:00.000Z");
    const end = new Date("2026-09-12T12:00:00.000Z");
    const dayStart = new Date("2026-09-12T00:00:00.000Z");
    const dayEnd = new Date("2026-09-13T00:00:00.000Z");
    assert.equal(overlapSeconds(start, end, dayStart, dayEnd), 7200);
    assert.equal(formatDuration(7200), "2h 0m");
  });
});

describe("applicationBucket", () => {
  it("groups pending, approved, and rejected applications", () => {
    assert.equal(applicationBucket("pending"), "pending");
    assert.equal(applicationBucket("approved"), "approved");
    assert.equal(applicationBucket("declined"), "rejected");
    assert.equal(applicationBucket("rejected"), "rejected");
  });
});

describe("requiredApplicationError", () => {
  it("requires contact, bio, rate, and availability before submit", () => {
    const base = {
      legalName: "Ada Mora",
      name: "Ada",
      email: "ada@example.com",
      phone: "+1 555 0100",
      country: "US",
      bio: "Tarot and timing for love questions.",
      specialties: "Love, Tarot",
      years: 6,
      rateCoins: 22,
      availability: "Evenings UTC",
      photoUrl: "",
    };
    assert.equal(requiredApplicationError(base), null);
    assert.equal(requiredApplicationError({ ...base, phone: "" }), "Phone is required.");
  });
});

describe("safeApplicationPhoto", () => {
  it("does not store base64 data URLs", () => {
    assert.equal(safeApplicationPhoto("data:image/jpeg;base64,abc"), "");
    assert.equal(safeApplicationPhoto("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  });
});

describe("advisorLoginOutcome", () => {
  it("allows only approved live advisors into the desk", () => {
    assert.deepEqual(advisorLoginOutcome("live"), { ok: true });
    const pending = advisorLoginOutcome("pending");
    assert.equal(pending.ok, false);
    if (!pending.ok) assert.match(pending.message, /still in review/);
    const rejected = advisorLoginOutcome("rejected");
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.match(rejected.message, /rejected/);
    assert.equal(advisorLoginOutcome("none").ok, false);
  });
});

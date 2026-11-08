import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  READING_EARNINGS_SQL,
  TOP_EARNINGS_RANK,
  centsToOvertake,
  customerRank,
  eligibleAdvisorTotals,
  formatRankUsd,
  overtakeMessage,
  rankEligibleAdvisors,
  rankingProgress,
  readingCents,
} from "./ora-earnings-rank.ts";

describe("eligible advisor earnings rank", () => {
  it("counts the advisor share in cents, not the customer payment", () => {
    assert.equal(readingCents(4), 40);
    assert.notEqual(readingCents(4), readingCents(20));
    assert.match(READING_EARNINGS_SQL, /advisor_earned/);
    assert.doesNotMatch(READING_EARNINGS_SQL, /coins_spent/);
    assert.match(READING_EARNINGS_SQL, /clawed/);
    assert.match(READING_EARNINGS_SQL, /reversed/);
    assert.match(READING_EARNINGS_SQL, /refunded/);
  });

  it("drops refunded rows and duplicate transactions", () => {
    const totals = eligibleAdvisorTotals([
      { advisorId: "a", source: "reading", id: "r1", cents: 400, at: 1 },
      { advisorId: "a", source: "reading", id: "r1", cents: 400, at: 2 },
      { advisorId: "a", source: "reading", id: "r2", cents: 100, at: 3, voided: true },
      { advisorId: "a", source: "message", id: "m1", cents: 50, at: 4 },
      { advisorId: "a", source: "tip", id: "t1", cents: 0, at: 5 },
    ]);
    assert.deepEqual(totals, [{ advisorId: "a", cents: 450, reachedAt: 4 }]);
  });

  it("ranks every eligible advisor with the highest earnings at #1", () => {
    const board = rankEligibleAdvisors(
      [
        { advisorId: "low", cents: 50_000, reachedAt: 2 },
        { advisorId: "high", cents: 100_000, reachedAt: 5 },
      ],
      ["high", "low", "zero"],
    );
    assert.deepEqual(
      board.map((row) => [row.advisorId, row.rank, row.cents]),
      [
        ["high", 1, 100_000],
        ["low", 2, 50_000],
        ["zero", 3, 0],
      ],
    );
    assert.equal(board.length, 3);
  });

  it("breaks ties by who reached the total first, then advisor id", () => {
    const board = rankEligibleAdvisors([
      { advisorId: "b", cents: 1000, reachedAt: 20 },
      { advisorId: "a", cents: 1000, reachedAt: 10 },
      { advisorId: "d", cents: 1000, reachedAt: 10 },
      { advisorId: "c", cents: 500, reachedAt: 1 },
    ]);
    assert.deepEqual(board.map((row) => row.advisorId), ["a", "d", "b", "c"]);
  });

  it("uses one cent to overtake and matches the displayed target", () => {
    const board = rankEligibleAdvisors(
      [
        { advisorId: "ten", cents: 100_000, reachedAt: 1 },
        { advisorId: "eleven", cents: 50_000, reachedAt: 2 },
      ],
      ["ten", "eleven"],
    );
    const progress = rankingProgress(board, "eleven");
    assert.ok(progress);
    assert.equal(progress.rank, 2);
    assert.equal(progress.aboveRank, 1);
    assert.equal(progress.aboveCents, 100_000);
    assert.equal(progress.earningsCents, 50_000);
    assert.equal(centsToOvertake(50_000, 100_000), 50_001);
    assert.equal(progress.centsToNext, 50_001);
    assert.equal(formatRankUsd(50_000), "$500");
    assert.equal(formatRankUsd(100_000), "$1,000");
    assert.equal(formatRankUsd(50_001), "$500.01");
    assert.equal(overtakeMessage(progress), "Earn $500.01 more to reach Rank #1.");
    assert.equal(progress.progressPercent, Math.floor((50_000 * 100) / 100_001));
  });

  it("updates the target after the advisor passes the next rank and stops at #1", () => {
    const before = rankEligibleAdvisors([
      { advisorId: "nine", cents: 200_000, reachedAt: 1 },
      { advisorId: "ten", cents: 100_000, reachedAt: 2 },
      { advisorId: "eleven", cents: 50_000, reachedAt: 3 },
    ]);
    assert.equal(rankingProgress(before, "eleven")?.aboveRank, 2);
    const passed = rankEligibleAdvisors([
      { advisorId: "nine", cents: 200_000, reachedAt: 1 },
      { advisorId: "ten", cents: 100_000, reachedAt: 2 },
      { advisorId: "eleven", cents: 100_001, reachedAt: 4 },
    ]);
    const next = rankingProgress(passed, "eleven");
    assert.equal(next?.rank, 2);
    assert.equal(next?.aboveRank, 1);
    assert.equal(next?.centsToNext, 200_000 - 100_001 + 1);
    const leader = rankEligibleAdvisors([
      { advisorId: "eleven", cents: 200_001, reachedAt: 5 },
      { advisorId: "nine", cents: 200_000, reachedAt: 1 },
    ]);
    const top = rankingProgress(leader, "eleven");
    assert.equal(top?.leader, true);
    assert.equal(top?.centsToNext, null);
    assert.equal(overtakeMessage(top!), "Congratulations! You are the #1 Trusted Psychic on Ora Psychic!");
  });

  it("does not publish earnings on the customer rank", () => {
    const card = customerRank({ advisorId: "a", rank: 3, cents: 999_999 });
    assert.deepEqual(card, { advisorId: "a", rank: 3 });
    assert.equal("cents" in card, false);
    assert.equal(customerRank({ advisorId: "a", rank: 11, cents: 1 }).rank, null);
    assert.equal(TOP_EARNINGS_RANK, 10);
  });
});

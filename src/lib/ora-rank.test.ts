import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_FREE_CLIENTS,
  TOP_RANK_LIMIT,
  TRUSTED_PSYCHICS,
  isGenuineSession,
  isTrustedPsychicsFilter,
  monthEndUtc,
  monthStartUtc,
  rankAdvisorsForMonth,
  topTrustedPsychics,
  trustedWindowStart,
  TRUSTED_WINDOW_MS,
  usedFree,
  usedPaid,
  type RankSession,
} from "./ora-rank.ts";

function sitting(partial: Partial<RankSession> & Pick<RankSession, "id" | "clientId" | "advisorId">): RankSession {
  return {
    startedAt: Date.UTC(2026, 8, 10, 12, 0, 0),
    seconds: 180,
    coinsSpent: 0,
    bonusUsed: 180,
    weeklyUsed: 0,
    status: "ended",
    ...partial,
  };
}

function nFree(advisorId: string, count: number, start = 1): RankSession[] {
  return Array.from({ length: count }, (_, i) =>
    sitting({
      id: `${advisorId}-free-${start + i}`,
      clientId: `c${start + i}`,
      advisorId,
      startedAt: Date.UTC(2026, 8, 2, 10, 0, 0) + i * 60_000,
    }),
  );
}

describe("isGenuineSession", () => {
  it("accepts ended sittings with real duration", () => {
    assert.equal(isGenuineSession(sitting({ id: "1", clientId: "c", advisorId: "a" })), true);
  });
  it("rejects live, cancelled, short, and test sittings", () => {
    const base = { id: "1", clientId: "c", advisorId: "a" };
    assert.equal(isGenuineSession(sitting({ ...base, status: "live" })), false);
    assert.equal(isGenuineSession(sitting({ ...base, status: "cancelled" })), false);
    assert.equal(isGenuineSession(sitting({ ...base, seconds: 12 })), false);
    assert.equal(isGenuineSession(sitting({ ...base, test: true })), false);
    assert.equal(isGenuineSession(sitting({ ...base, refunded: true, coinsSpent: 40 })), false);
  });
});

describe("usedFree / usedPaid", () => {
  it("treats bonus or weekly seconds as free and coins as paid", () => {
    assert.equal(usedFree(sitting({ id: "1", clientId: "c", advisorId: "a", bonusUsed: 0, weeklyUsed: 20 })), true);
    assert.equal(usedFree(sitting({ id: "1", clientId: "c", advisorId: "a", bonusUsed: 0, weeklyUsed: 0 })), false);
    assert.equal(usedPaid(sitting({ id: "1", clientId: "c", advisorId: "a", coinsSpent: 8 })), true);
    assert.equal(usedPaid(sitting({ id: "1", clientId: "c", advisorId: "a", coinsSpent: 0 })), false);
  });
});

describe("rankAdvisorsForMonth", () => {
  it("does not rank below the unique free-client minimum", () => {
    const rows = nFree("adv_a", MIN_FREE_CLIENTS - 1);
    const [a] = rankAdvisorsForMonth(rows);
    assert.equal(a?.eligible, false);
    assert.equal(a?.rank, null);
    assert.equal(a?.eligibleFreeClients, MIN_FREE_CLIENTS - 1);
  });

  it("counts unique free clients, not repeated sittings from the same person", () => {
    const repeats = Array.from({ length: 12 }, (_, i) =>
      sitting({
        id: `r${i}`,
        clientId: "same",
        advisorId: "adv_a",
        startedAt: Date.UTC(2026, 8, 3, 8, 0, 0) + i * 3600_000,
      }),
    );
    const rest = nFree("adv_a", 9, 2);
    const [a] = rankAdvisorsForMonth([...repeats, ...rest]);
    assert.equal(a?.eligibleFreeClients, 10);
  });

  it("counts a same-sitting free-then-paid as one conversion", () => {
    const free = nFree("adv_a", MIN_FREE_CLIENTS);
    free[0] = sitting({
      id: "hybrid",
      clientId: "c1",
      advisorId: "adv_a",
      bonusUsed: 120,
      weeklyUsed: 0,
      coinsSpent: 40,
      seconds: 240,
    });
    const [a] = rankAdvisorsForMonth(free);
    assert.equal(a?.eligible, true);
    assert.equal(a?.convertedPaidClients, 1);
    assert.equal(a?.conversionRate, 0.1);
    assert.equal(a?.paidSessionRevenue, 40);
    assert.equal(a?.rank, 1);
  });

  it("counts a later paid sitting with the same advisor as a conversion", () => {
    const free = nFree("adv_a", MIN_FREE_CLIENTS);
    const paid = sitting({
      id: "later",
      clientId: "c1",
      advisorId: "adv_a",
      bonusUsed: 0,
      weeklyUsed: 0,
      coinsSpent: 22,
      seconds: 60,
      startedAt: Date.UTC(2026, 8, 20, 12, 0, 0),
    });
    const [a] = rankAdvisorsForMonth([...free, paid]);
    assert.equal(a?.convertedPaidClients, 1);
  });

  it("does not convert a paid sitting that happened before any free sitting", () => {
    const paidFirst = sitting({
      id: "paid-first",
      clientId: "c1",
      advisorId: "adv_a",
      bonusUsed: 0,
      coinsSpent: 30,
      seconds: 90,
      startedAt: Date.UTC(2026, 8, 1, 8, 0, 0),
    });
    const free = nFree("adv_a", MIN_FREE_CLIENTS);
    const [a] = rankAdvisorsForMonth([paidFirst, ...free]);
    assert.equal(a?.convertedPaidClients, 0);
  });

  it("counts a conversion only once per client and advisor", () => {
    const free = nFree("adv_a", MIN_FREE_CLIENTS);
    const extras = [
      sitting({
        id: "p1",
        clientId: "c1",
        advisorId: "adv_a",
        coinsSpent: 10,
        bonusUsed: 0,
        startedAt: Date.UTC(2026, 8, 12),
        seconds: 60,
      }),
      sitting({
        id: "p2",
        clientId: "c1",
        advisorId: "adv_a",
        coinsSpent: 15,
        bonusUsed: 0,
        startedAt: Date.UTC(2026, 8, 13),
        seconds: 60,
      }),
    ];
    const [a] = rankAdvisorsForMonth([...free, ...extras]);
    assert.equal(a?.convertedPaidClients, 1);
    assert.equal(a?.paidSessionRevenue, 25);
  });

  it("does not let a paid sitting with a different advisor convert the first advisor", () => {
    const free = nFree("adv_a", MIN_FREE_CLIENTS);
    const other = sitting({
      id: "other",
      clientId: "c1",
      advisorId: "adv_b",
      coinsSpent: 50,
      bonusUsed: 0,
      seconds: 90,
    });
    const ranked = rankAdvisorsForMonth([...free, other]);
    const a = ranked.find((r) => r.advisorId === "adv_a");
    assert.equal(a?.convertedPaidClients, 0);
  });

  it("ranks eligible advisors by conversion rate, then converted clients, then revenue", () => {
    const low = nFree("adv_low", MIN_FREE_CLIENTS);
    low[0] = sitting({ ...low[0]!, coinsSpent: 10, seconds: 240 });
    const high = nFree("adv_high", MIN_FREE_CLIENTS);
    for (let i = 0; i < 5; i += 1) {
      high[i] = sitting({ ...high[i]!, coinsSpent: 8, seconds: 240 });
    }
    const ranked = rankAdvisorsForMonth([...low, ...high]).filter((r) => r.eligible);
    assert.deepEqual(
      ranked.map((r) => r.advisorId),
      ["adv_high", "adv_low"],
    );
    assert.equal(ranked[0]?.rank, 1);
    assert.equal(ranked[1]?.rank, 2);
  });

  it("only assigns public ranks 1 through 10", () => {
    const sessions = Array.from({ length: 12 }, (_, n) =>
      nFree(`adv_${String(n).padStart(2, "0")}`, MIN_FREE_CLIENTS).map((s, i) =>
        sitting({
          ...s,
          advisorId: `adv_${String(n).padStart(2, "0")}`,
          clientId: `c${n}-${i}`,
          id: `adv_${n}-free-${i}`,
          coinsSpent: n < 11 && i === 0 ? 10 + n : 0,
          seconds: n < 11 && i === 0 ? 240 : 180,
        }),
      ),
    ).flat();
    const ranked = rankAdvisorsForMonth(sessions).filter((r) => r.rank != null);
    assert.equal(ranked.length, 10);
    assert.equal(ranked[0]?.rank, 1);
    assert.equal(ranked[9]?.rank, 10);
  });

  it("breaks a conversion tie with unique paid clients, not revenue", () => {
    const few = nFree("adv_few", MIN_FREE_CLIENTS);
    few[0] = sitting({ ...few[0]!, coinsSpent: 80, seconds: 240 });
    few[1] = sitting({ ...few[1]!, coinsSpent: 80, seconds: 240 });
    const many = nFree("adv_many", MIN_FREE_CLIENTS);
    for (let i = 0; i < 2; i += 1) many[i] = sitting({ ...many[i]!, coinsSpent: 5, seconds: 240 });
    for (let i = 0; i < 3; i += 1) {
      many.push(
        sitting({
          id: `paid-only-${i}`,
          clientId: `paid-${i}`,
          advisorId: "adv_many",
          bonusUsed: 0,
          weeklyUsed: 0,
          coinsSpent: 4,
          seconds: 60,
          startedAt: Date.UTC(2026, 8, 18, 12, i, 0),
        }),
      );
    }
    const ranked = rankAdvisorsForMonth([...few, ...many]).filter((r) => r.rank != null);
    assert.equal(ranked[0]?.advisorId, "adv_many");
    assert.equal(ranked[0]?.paidClients, 5);
    assert.equal(ranked[1]?.advisorId, "adv_few");
    assert.equal(ranked[1]?.paidClients, 2);
    assert.ok((ranked[1]?.paidSessionRevenue ?? 0) > (ranked[0]?.paidSessionRevenue ?? 0));
  });

  it("does not give a public rank to an advisor who is not live", () => {
    const sessions = nFree("adv_hidden", MIN_FREE_CLIENTS).map((s, i) =>
      sitting({ ...s, coinsSpent: i === 0 ? 20 : 0, seconds: i === 0 ? 240 : 180 }),
    );
    const [hidden] = rankAdvisorsForMonth(sessions, new Set(["someone_else"]));
    assert.equal(hidden?.eligible, true);
    assert.equal(hidden?.rank, null);
  });

  it("ignores a refunded paid sitting", () => {
    const free = nFree("adv_a", MIN_FREE_CLIENTS);
    const refunded = sitting({
      id: "refunded",
      clientId: "c1",
      advisorId: "adv_a",
      bonusUsed: 0,
      coinsSpent: 40,
      seconds: 90,
      refunded: true,
      startedAt: Date.UTC(2026, 8, 21),
    });
    const [a] = rankAdvisorsForMonth([...free, refunded]);
    assert.equal(a?.convertedPaidClients, 0);
    assert.equal(a?.paidClients, 0);
    assert.equal(a?.paidSessionRevenue, 0);
  });

  it("ignores live and test sittings in both eligibility and conversions", () => {
    const free = nFree("adv_a", MIN_FREE_CLIENTS);
    const noise: RankSession[] = [
      sitting({ id: "live", clientId: "c99", advisorId: "adv_a", status: "live" }),
      sitting({ id: "qa", clientId: "qa:1", advisorId: "adv_a", test: true, coinsSpent: 99 }),
    ];
    const [a] = rankAdvisorsForMonth([...free, ...noise]);
    assert.equal(a?.eligibleFreeClients, MIN_FREE_CLIENTS);
    assert.equal(a?.convertedPaidClients, 0);
    assert.equal(a?.paidSessionRevenue, 0);
  });
});

describe("trusted window", () => {
  it("is the previous 30 days, ending at the supplied time", () => {
    const end = Date.UTC(2026, 8, 25, 4, 0, 0);
    const start = Date.parse(trustedWindowStart(end));
    assert.equal(end - start, TRUSTED_WINDOW_MS);
    assert.equal(TRUSTED_WINDOW_MS, 30 * 24 * 60 * 60 * 1000);
  });
});

describe("monthStartUtc / monthEndUtc", () => {
  it("uses the first of the UTC month and the next month as the exclusive end", () => {
    assert.equal(monthStartUtc(Date.UTC(2026, 8, 12, 18, 0, 0)), "2026-09-01");
    assert.equal(monthEndUtc("2026-09-01"), "2026-10-01T00:00:00.000Z");
  });
});

describe("Trusted Psychics category", () => {
  it("keeps the public tab name and only the monthly top 10", () => {
    assert.equal(TRUSTED_PSYCHICS, "Trusted Psychics");
    assert.equal(isTrustedPsychicsFilter("Trusted Psychics"), true);
    assert.equal(isTrustedPsychicsFilter("Love"), false);
    const advisors = [
      { id: "a", monthlyRank: 2 },
      { id: "b", monthlyRank: null },
      { id: "c", monthlyRank: 1 },
      { id: "d", monthlyRank: 11 },
      { id: "e", monthlyRank: 10 },
    ];
    assert.deepEqual(
      topTrustedPsychics(advisors).map((a) => a.id),
      ["c", "a", "e"],
    );
    assert.equal(TOP_RANK_LIMIT, 10);
  });
});

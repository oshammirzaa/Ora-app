import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advisorRatingFromReviews, matchesAdvisorQuery } from "./ora-advisor-admin-search.ts";

describe("advisor admin search and reviews", () => {
  it("matches name, registered email, and advisor id without case", () => {
    const row = { name: "Mira Solane", email: "Mira@Example.com", id: "adv_mira" };
    assert.equal(matchesAdvisorQuery(row, "mira@example.com"), true);
    assert.equal(matchesAdvisorQuery(row, "ADV_MIRA"), true);
    assert.equal(matchesAdvisorQuery(row, "solane"), true);
    assert.equal(matchesAdvisorQuery(row, "other"), false);
    assert.equal(matchesAdvisorQuery(row, "  "), true);
  });

  it("recalculates the visible average and ignores hidden reviews", () => {
    assert.deepEqual(
      advisorRatingFromReviews([
        { rating: 5, hidden: false },
        { rating: 3, hidden: false },
        { rating: 1, hidden: true },
      ]),
      { rating: 4, reviews: 2 },
    );
    assert.deepEqual(advisorRatingFromReviews([]), { rating: 0, reviews: 0 });
  });
});

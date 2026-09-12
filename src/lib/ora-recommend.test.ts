import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendByReviews, reviewRecommendScore } from "./ora-recommend.ts";

describe("reviewRecommendScore", () => {
  it("is zero without genuine reviews", () => {
    assert.equal(reviewRecommendScore(5, 0), 0);
    assert.equal(reviewRecommendScore(5, -1), 0);
  });

  it("lifts a strong average that has many reviews above a thin 5.0", () => {
    const thin = reviewRecommendScore(5, 2);
    const solid = reviewRecommendScore(4.7, 80);
    assert.ok(solid > thin);
  });
});

describe("recommendByReviews", () => {
  it("does not use conversion rank and orders by review performance", () => {
    const advisors = [
      { id: "a", name: "Ava", rating: 5, reviews: 2, monthlyRank: 1 },
      { id: "b", name: "Bea", rating: 4.8, reviews: 60, monthlyRank: null },
      { id: "c", name: "Cal", rating: 4.9, reviews: 12, monthlyRank: 2 },
      { id: "d", name: "Dee", rating: 5, reviews: 0, monthlyRank: 3 },
    ];
    const rec = recommendByReviews(advisors, 8);
    assert.deepEqual(
      rec.map((a) => a.id),
      ["b", "c", "a"],
    );
    assert.equal(rec.some((a) => a.id === "d"), false);
  });
});

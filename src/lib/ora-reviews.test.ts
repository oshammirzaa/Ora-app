import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REVIEW_ALREADY_TODAY,
  applySimulatedReview,
  emptyReviewState,
  formatReviewDate,
  reviewAverage,
  reviewDayBounds,
  reviewDayKey,
} from "./ora-reviews.ts";

describe("advisor reviews", () => {
  const today = "2026-09-23";
  const tomorrow = "2026-09-24";

  it("uses the UTC calendar day", () => {
    assert.equal(reviewDayKey(new Date("2026-09-23T23:30:00.000Z")), "2026-09-23");
    assert.equal(reviewDayKey(new Date("2026-09-24T00:15:00.000Z")), "2026-09-24");
    const bounds = reviewDayBounds(new Date("2026-09-23T15:00:00.000Z"));
    assert.equal(bounds.day, today);
    assert.equal(bounds.start, "2026-09-23T00:00:00.000Z");
    assert.equal(bounds.end, "2026-09-24T00:00:00.000Z");
    assert.equal(formatReviewDate("2026-09-23T18:00:00.000Z"), "23 Sept 2026");
  });

  it("accepts the first review and keeps the written words", () => {
    const state = applySimulatedReview(emptyReviewState(), {
      clientId: "c1",
      advisorId: "demetri",
      readingId: "r1",
      day: today,
      rating: 5,
      body: "thank you so much for your guidance",
    });
    assert.equal(state.lastReject, "");
    assert.equal(state.reviews[0]?.body, "thank you so much for your guidance");
    assert.equal(state.reviews[0]?.rating, 5);
    assert.deepEqual(reviewAverage(state.reviews.map((review) => review.rating)), { rating: 5, count: 1 });
  });

  it("blocks a second review for the same advisor on the same day without changing the first", () => {
    let state = applySimulatedReview(emptyReviewState(), {
      clientId: "c1",
      advisorId: "demetri",
      readingId: "r1",
      day: today,
      rating: 5,
      body: "first words",
    });
    const blocked = applySimulatedReview(state, {
      clientId: "c1",
      advisorId: "demetri",
      readingId: "r2",
      day: today,
      rating: 1,
      body: "should not replace",
    });
    assert.equal(blocked.lastReject, REVIEW_ALREADY_TODAY);
    assert.equal(blocked.reviews.length, 1);
    assert.equal(blocked.reviews[0]?.body, "first words");
    assert.equal(blocked.reviews[0]?.rating, 5);
    const refreshed = JSON.parse(JSON.stringify(state)) as typeof state;
    const again = applySimulatedReview(refreshed, {
      clientId: "c1",
      advisorId: "demetri",
      readingId: "r3",
      day: today,
      rating: 2,
      body: "other device",
    });
    assert.equal(again.lastReject, REVIEW_ALREADY_TODAY);
    assert.equal(again.reviews[0]?.body, "first words");
  });

  it("allows the next UTC day and a different advisor", () => {
    let state = applySimulatedReview(emptyReviewState(), {
      clientId: "c1",
      advisorId: "demetri",
      readingId: "r1",
      day: today,
      rating: 4,
      body: "today",
    });
    state = applySimulatedReview(state, {
      clientId: "c1",
      advisorId: "mira",
      readingId: "r2",
      day: today,
      rating: 5,
      body: "other advisor",
    });
    assert.equal(state.lastReject, "");
    state = applySimulatedReview(state, {
      clientId: "c1",
      advisorId: "demetri",
      readingId: "r3",
      day: tomorrow,
      rating: 3,
      body: "next day",
      eligible: true,
    });
    assert.equal(state.lastReject, "");
    assert.equal(state.reviews.length, 3);
    const demetri = state.reviews.filter((review) => review.advisorId === "demetri");
    assert.deepEqual(reviewAverage(demetri.map((review) => review.rating)), { rating: 3.5, count: 2 });
    const ineligible = applySimulatedReview(state, {
      clientId: "c1",
      advisorId: "demetri",
      readingId: "r4",
      day: tomorrow,
      rating: 5,
      eligible: false,
    });
    assert.match(ineligible.lastReject, /after it ends/);
    assert.equal(ineligible.reviews.length, 3);
  });
});

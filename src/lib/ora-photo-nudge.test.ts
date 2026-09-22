import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PHOTO_NUDGE_DELAY_MS,
  hasCustomerPhoto,
  photoNudgeQuietPath,
  photoNudgeWaitMs,
  shouldShowPhotoNudge,
} from "./ora-photo-nudge.ts";

describe("customer photo nudge", () => {
  const now = Date.parse("2026-09-21T17:00:00.000Z");

  it("does not treat an empty image as a profile picture", () => {
    assert.equal(hasCustomerPhoto(""), false);
    assert.equal(hasCustomerPhoto(null), false);
    assert.equal(hasCustomerPhoto("not-a-url"), false);
    assert.equal(hasCustomerPhoto("/images/me.jpg"), true);
    assert.equal(hasCustomerPhoto("https://cdn.example/me.jpg"), true);
  });

  it("waits five minutes after the customer begins using Ora", () => {
    assert.equal(photoNudgeWaitMs({ startedAt: null, now }), PHOTO_NUDGE_DELAY_MS);
    assert.equal(photoNudgeWaitMs({ startedAt: new Date(now - 60_000).toISOString(), now }), 4 * 60_000);
    assert.equal(photoNudgeWaitMs({ startedAt: new Date(now - PHOTO_NUDGE_DELAY_MS).toISOString(), now }), 0);
    assert.equal(photoNudgeWaitMs({ startedAt: new Date(now - PHOTO_NUDGE_DELAY_MS - 1).toISOString(), now }), 0);
  });

  it("shows only once the wait has elapsed, and never after a photo or dismissal", () => {
    const startedAt = new Date(now - PHOTO_NUDGE_DELAY_MS).toISOString();
    assert.equal(shouldShowPhotoNudge({ hasPhoto: false, dismissed: false, startedAt, now }), true);
    assert.equal(shouldShowPhotoNudge({ hasPhoto: true, dismissed: false, startedAt, now }), false);
    assert.equal(shouldShowPhotoNudge({ hasPhoto: false, dismissed: true, startedAt, now }), false);
    assert.equal(shouldShowPhotoNudge({ hasPhoto: false, dismissed: false, startedAt: null, now }), false);
    assert.equal(
      shouldShowPhotoNudge({
        hasPhoto: false,
        dismissed: false,
        startedAt: new Date(now - 30_000).toISOString(),
        now,
      }),
      false,
    );
  });

  it("stays out of live readings and the profile form so it does not block the app", () => {
    assert.equal(photoNudgeQuietPath("/"), false);
    assert.equal(photoNudgeQuietPath("/account"), false);
    assert.equal(photoNudgeQuietPath("/me"), true);
    assert.equal(photoNudgeQuietPath("/reading/rd_1"), true);
    assert.equal(photoNudgeQuietPath("/wait/req_1"), true);
    assert.equal(photoNudgeQuietPath("/advisor"), true);
    assert.equal(photoNudgeQuietPath("/login"), true);
  });
});

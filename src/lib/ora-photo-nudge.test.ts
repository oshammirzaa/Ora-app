import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PHOTO_NUDGE_DELAY_MS,
  customerPhotoNudgeEligible,
  hasCustomerPhoto,
  normalizePhotoNudgeSession,
  photoNudgePresentation,
  photoNudgeQuietPath,
  photoNudgeWaitMs,
  shouldShowPhotoNudge,
} from "./ora-photo-nudge.ts";

describe("customer photo nudge", () => {
  const now = Date.parse("2026-09-21T17:00:00.000Z");

  it("does not treat an empty image or a placeholder as a profile picture", () => {
    assert.equal(hasCustomerPhoto(""), false);
    assert.equal(hasCustomerPhoto(null), false);
    assert.equal(hasCustomerPhoto("not-a-url"), false);
    assert.equal(hasCustomerPhoto("null"), false);
    assert.equal(hasCustomerPhoto("/favicon.svg"), false);
    assert.equal(hasCustomerPhoto("/images/ora-logo.png"), false);
    assert.equal(hasCustomerPhoto("https://orapsychic.com/images/ora-logo.png"), false);
    assert.equal(hasCustomerPhoto("https://www.gravatar.com/avatar/abc?d=mp"), false);
    assert.equal(hasCustomerPhoto("https://ui-avatars.com/api/?name=Ora"), false);
    assert.equal(hasCustomerPhoto("blob:http://localhost/abc"), false);
    assert.equal(hasCustomerPhoto("data:image/svg+xml;base64,abc"), false);
    assert.equal(hasCustomerPhoto("/images/me.jpg"), true);
    assert.equal(hasCustomerPhoto("https://cdn.example/me.jpg"), true);
    assert.equal(hasCustomerPhoto("data:image/jpeg;base64,abc"), true);
    assert.equal(hasCustomerPhoto("https://lh3.googleusercontent.com/a/real-photo"), true);
  });

  it("waits five minutes after this app session begins", () => {
    assert.equal(photoNudgeWaitMs({ startedAt: null, now }), PHOTO_NUDGE_DELAY_MS);
    assert.equal(photoNudgeWaitMs({ startedAt: now - 60_000, now }), 4 * 60_000);
    assert.equal(photoNudgeWaitMs({ startedAt: now - PHOTO_NUDGE_DELAY_MS, now }), 0);
    assert.equal(photoNudgeWaitMs({ startedAt: now - PHOTO_NUDGE_DELAY_MS - 1, now }), 0);
  });

  it("shows as soon as the customer opens the app when there is no photo", () => {
    assert.equal(
      photoNudgePresentation({
        eligible: true,
        hasPhoto: false,
        quiet: false,
        later: false,
        startedAt: now,
        now,
        delayMs: 0,
      }).show,
      true,
    );
    assert.equal(
      photoNudgePresentation({
        eligible: true,
        hasPhoto: true,
        quiet: false,
        later: false,
        startedAt: now,
        now,
        delayMs: 0,
      }).show,
      false,
    );
  });

  it("still waits out a delay when one is set, and never shows a real photo", () => {
    const startedAt = now - PHOTO_NUDGE_DELAY_MS;
    assert.equal(
      photoNudgePresentation({
        eligible: true,
        hasPhoto: false,
        quiet: false,
        later: false,
        startedAt,
        now,
      }).show,
      true,
    );
    assert.equal(shouldShowPhotoNudge({ hasPhoto: false, dismissed: false, startedAt, now }), true);
    assert.equal(shouldShowPhotoNudge({ hasPhoto: true, dismissed: false, startedAt, now }), false);
    assert.equal(shouldShowPhotoNudge({ hasPhoto: false, dismissed: true, startedAt, now }), false);
    assert.equal(shouldShowPhotoNudge({ hasPhoto: false, dismissed: false, startedAt: null, now }), false);
    assert.equal(
      photoNudgePresentation({
        eligible: true,
        hasPhoto: false,
        quiet: false,
        later: false,
        startedAt: now - 30_000,
        now,
      }).show,
      false,
    );
  });

  it("never targets advisors or admins, and Maybe Later only skips this session", () => {
    assert.equal(customerPhotoNudgeEligible({ role: "client" }), true);
    assert.equal(customerPhotoNudgeEligible({ role: "advisor" }), false);
    assert.equal(customerPhotoNudgeEligible({ role: "admin" }), false);
    assert.equal(customerPhotoNudgeEligible({ role: "owner" }), false);
    assert.equal(customerPhotoNudgeEligible({ role: "client", isAdmin: true }), false);
    assert.equal(customerPhotoNudgeEligible({ role: "client", isAdvisor: true }), false);
    const startedAt = now - PHOTO_NUDGE_DELAY_MS;
    assert.equal(
      photoNudgePresentation({ eligible: false, hasPhoto: false, quiet: false, later: false, startedAt, now }).show,
      false,
    );
    assert.equal(
      photoNudgePresentation({ eligible: true, hasPhoto: false, quiet: false, later: true, startedAt, now }).show,
      false,
    );
    const nextSession = normalizePhotoNudgeSession(null, now + 60_000);
    assert.equal(nextSession.later, false);
    assert.equal(nextSession.startedAt, now + 60_000);
  });

  it("keeps one session clock across navigation and does not restart it", () => {
    const first = normalizePhotoNudgeSession(null, now);
    const again = normalizePhotoNudgeSession(first, now + 60_000);
    assert.equal(again.startedAt, first.startedAt);
    assert.equal(again.later, false);
    const later = normalizePhotoNudgeSession({ ...again, later: true }, now + 120_000);
    assert.equal(later.later, true);
    assert.equal(later.startedAt, first.startedAt);
  });

  it("stays out of live readings but can appear on the customer pages", () => {
    assert.equal(photoNudgeQuietPath("/"), false);
    assert.equal(photoNudgeQuietPath("/home"), false);
    assert.equal(photoNudgeQuietPath("/account"), false);
    assert.equal(photoNudgeQuietPath("/me"), false);
    assert.equal(photoNudgeQuietPath("/reading/rd_1"), true);
    assert.equal(photoNudgeQuietPath("/wait/req_1"), true);
    assert.equal(photoNudgeQuietPath("/advisor"), true);
    assert.equal(photoNudgeQuietPath("/admin"), true);
    assert.equal(photoNudgeQuietPath("/login"), true);
  });
});

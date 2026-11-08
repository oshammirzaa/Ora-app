import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approvalGoesLive,
  fileMatchesMime,
  identityFileError,
  identityFilesReady,
  identityFormError,
  identityPastRetention,
  manualLiveAllowed,
  splitIdentityPayload,
} from "./ora-identity.ts";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, ...new Array(40).fill(0x11)]).toString("base64");

describe("government ID review", () => {
  it("requires consent, a selfie, and the back of a card", () => {
    const file = { mime: "image/jpeg", base64: jpeg };
    assert.match(
      identityFormError({
        legalName: "Ada Lovelace",
        country: "United Kingdom",
        idType: "passport",
        consent: false,
        front: file,
        back: null,
        selfie: file,
        holding: null,
      }) || "",
      /Consent/,
    );
    assert.match(
      identityFormError({
        legalName: "Ada Lovelace",
        country: "United Kingdom",
        idType: "driving_licence",
        consent: true,
        front: file,
        back: null,
        selfie: file,
        holding: file,
      }) || "",
      /back/,
    );
    assert.match(
      identityFormError({
        legalName: "Ada Lovelace",
        country: "United Kingdom",
        idType: "passport",
        consent: true,
        front: file,
        back: null,
        selfie: null,
        holding: file,
      }) || "",
      /selfie/,
    );
    assert.match(
      identityFormError({
        legalName: "Ada Lovelace",
        country: "United Kingdom",
        idType: "passport",
        consent: true,
        front: file,
        back: null,
        selfie: file,
        holding: null,
      }) || "",
      /holding/,
    );
    assert.match(identityFileError({ mime: "application/pdf", base64: jpeg, side: "selfie" }) || "", /JPG or PNG/);
    assert.equal(identityFileError({ mime: "application/pdf", base64: jpeg, side: "front" }), null);
    assert.equal(
      identityFormError({
        legalName: "Ada Lovelace",
        country: "United Kingdom",
        idType: "passport",
        consent: true,
        front: file,
        back: null,
        selfie: file,
        holding: file,
      }),
      null,
    );
    assert.equal(identityFilesReady(["front"], "passport"), false);
    assert.equal(identityFilesReady(["front", "selfie"], "passport"), false);
    assert.equal(identityFilesReady(["front", "selfie", "holding"], "passport"), true);
    assert.equal(identityFilesReady(["front", "selfie", "holding"], "national_id"), false);
    assert.equal(identityFilesReady(["front", "back", "selfie", "holding"], "driving_licence"), true);
    assert.equal(splitIdentityPayload("abcd", 2).join(""), "abcd");
    assert.equal(fileMatchesMime(Uint8Array.from([0xff, 0xd8, 0xff, 1]), "image/jpeg"), true);
    assert.equal(fileMatchesMime(Uint8Array.from([0x25, 0x50, 0x44, 0x46]), "application/pdf"), true);
    assert.equal(fileMatchesMime(Uint8Array.from([1, 2, 3, 4]), "image/png"), false);
  });

  it("keeps a profile private until the application and the ID are both accepted", () => {
    assert.equal(approvalGoesLive("pending"), false);
    assert.equal(approvalGoesLive("rejected"), false);
    assert.equal(approvalGoesLive(null), false);
    assert.equal(approvalGoesLive("verified"), true);
    assert.equal(manualLiveAllowed(null), true);
    assert.equal(manualLiveAllowed("pending"), false);
    assert.equal(identityPastRetention("2020-01-01T00:00:00.000Z", "verified", Date.parse("2026-01-01T00:00:00.000Z")), true);
    assert.equal(identityPastRetention("2026-08-01T00:00:00.000Z", "rejected", Date.parse("2026-11-08T00:00:00.000Z")), true);
    assert.equal(identityPastRetention("2026-10-01T00:00:00.000Z", "pending", Date.parse("2026-11-08T00:00:00.000Z")), false);
  });
});

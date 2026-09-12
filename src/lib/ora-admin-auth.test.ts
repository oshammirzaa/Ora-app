import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminDeniedMessage,
  adminGate,
  adminHasPermission,
  isDesignatedOwnerEmail,
  isPreviewOperatorEligible,
} from "./ora-admin-auth.ts";
import { isGrokPreviewAdminEntry, isGrokPreviewAdminRedirect } from "./preview-embedder-origin.ts";

describe("adminHasPermission", () => {
  it("grants every permission when stored as * or all", () => {
    assert.equal(adminHasPermission("*", "finance"), true);
    assert.equal(adminHasPermission("all", "customers"), true);
    assert.equal(adminHasPermission("*"), true);
  });

  it("grants a listed permission and denies others", () => {
    assert.equal(adminHasPermission("overview,customers", "customers"), true);
    assert.equal(adminHasPermission("overview,customers", "finance"), false);
  });

  it("denies when the stored permission string is empty", () => {
    assert.equal(adminHasPermission("", "overview"), false);
    assert.equal(adminHasPermission("   ", "overview"), false);
  });
});

describe("adminGate", () => {
  it("rejects a signed-out visitor even if they know /admin", () => {
    const r = adminGate({ signedIn: false, profileRole: "client" });
    assert.deepEqual(r, { ok: false, reason: "unauthenticated" });
  });

  it("rejects a normal customer account", () => {
    const r = adminGate({ signedIn: true, profileRole: "client", profileStatus: "active", admin: null });
    assert.deepEqual(r, { ok: false, reason: "not_admin" });
  });

  it("rejects a psychic/advisor profile that is not on the admin roster", () => {
    const r = adminGate({
      signedIn: true,
      profileRole: "advisor",
      profileStatus: "active",
      admin: null,
      permission: "overview",
    });
    assert.deepEqual(r, { ok: false, reason: "not_admin" });
  });

  it("does not promote the first signed-in customer just because the roster is empty", () => {
    const r = adminGate({
      signedIn: true,
      profileRole: "client",
      profileStatus: "active",
      admin: null,
      permission: "overview",
    });
    assert.deepEqual(r, { ok: false, reason: "not_admin" });
  });

  it("does not treat profiles.role=admin as access without an ora_admins row", () => {
    const r = adminGate({
      signedIn: true,
      profileRole: "admin",
      profileStatus: "active",
      admin: null,
    });
    assert.deepEqual(r, { ok: false, reason: "not_admin" });
  });

  it("rejects a suspended owner", () => {
    const r = adminGate({
      signedIn: true,
      profileRole: "admin",
      profileStatus: "suspended",
      admin: { role: "owner", permissions: "*" },
    });
    assert.deepEqual(r, { ok: false, reason: "suspended" });
    assert.equal(adminDeniedMessage("suspended"), "This account is suspended.");
  });

  it("allows an owner with * to call every admin permission", () => {
    const r = adminGate({
      signedIn: true,
      profileRole: "admin",
      profileStatus: "active",
      admin: { role: "owner", permissions: "*" },
      permission: "finance",
    });
    assert.deepEqual(r, { ok: true });
  });

  it("allows a scoped admin only for listed permissions", () => {
    const base = {
      signedIn: true,
      profileRole: "admin",
      profileStatus: "active",
      admin: { role: "admin", permissions: "overview,support" },
    };
    assert.deepEqual(adminGate({ ...base, permission: "support" }), { ok: true });
    assert.deepEqual(adminGate({ ...base, permission: "payouts" }), { ok: false, reason: "forbidden" });
  });

  it("maps forbidden and not_admin to the same public denial message", () => {
    assert.equal(adminDeniedMessage("not_admin"), "Not admin");
    assert.equal(adminDeniedMessage("forbidden"), "Not admin");
  });
});

describe("isPreviewOperatorEligible", () => {
  it("never auto-promotes email/password customers or psychics", () => {
    assert.equal(isPreviewOperatorEligible(true, ["credential"]), false);
    assert.equal(isPreviewOperatorEligible(true, []), false);
    assert.equal(isPreviewOperatorEligible(false, ["grok-gate"]), false);
    assert.equal(isPreviewOperatorEligible(true, ["credential"], "client@example.com"), false);
    assert.equal(isPreviewOperatorEligible(true, ["credential"], "advisor@example.com"), false);
    assert.equal(isPreviewOperatorEligible(true, [], "client@example.com"), false);
  });

  it("allows only the Grok preview operator identity, not deployed viewers", () => {
    assert.equal(isPreviewOperatorEligible(true, ["grok-gate"]), true);
    assert.equal(isPreviewOperatorEligible(false, ["grok-gate"]), false);
    assert.equal(isPreviewOperatorEligible(true, [], "viewer@viewer.grok.invalid"), true);
    assert.equal(isPreviewOperatorEligible(false, [], "viewer@viewer.grok.invalid"), false);
    assert.equal(isPreviewOperatorEligible(true, ["credential"], "owner@x.ai"), false);
  });
});

describe("isDesignatedOwnerEmail", () => {
  it("never matches when the env email is unset or empty", () => {
    assert.equal(isDesignatedOwnerEmail(undefined, "owner@example.com"), false);
    assert.equal(isDesignatedOwnerEmail("", "owner@example.com"), false);
    assert.equal(isDesignatedOwnerEmail("  ", "owner@example.com"), false);
    assert.equal(isDesignatedOwnerEmail("owner@example.com", ""), false);
  });

  it("matches only the configured owner email, case-insensitively", () => {
    assert.equal(isDesignatedOwnerEmail("owner@example.com", "owner@example.com"), true);
    assert.equal(isDesignatedOwnerEmail("Owner@Example.com", "owner@example.com"), true);
    assert.equal(isDesignatedOwnerEmail(" owner@example.com ", "OWNER@EXAMPLE.COM"), true);
    assert.equal(isDesignatedOwnerEmail("owner@example.com", "customer@example.com"), false);
    assert.equal(isDesignatedOwnerEmail("owner@example.com", "advisor@example.com"), false);
  });
});

describe("isGrokPreviewAdminEntry", () => {
  it("does not steal the customer homepage on localhost or production", () => {
    assert.equal(isGrokPreviewAdminEntry({ pathname: "/", hostname: "127.0.0.1", parentIsSelf: true }), false);
    assert.equal(isGrokPreviewAdminEntry({ pathname: "/", hostname: "ora.app", parentIsSelf: true }), false);
    assert.equal(isGrokPreviewAdminEntry({ pathname: "/admin", hostname: "abc.grok-sandbox.com", parentIsSelf: true }), false);
  });

  it("opens /admin for Grok sandbox Open and grok.com iframe guests", () => {
    assert.equal(
      isGrokPreviewAdminEntry({ pathname: "/", hostname: "abc.grok-sandbox.com", parentIsSelf: true }),
      true,
    );
    assert.equal(
      isGrokPreviewAdminEntry({
        pathname: "/",
        hostname: "127.0.0.1",
        parentIsSelf: false,
        referrer: "https://grok.com/",
      }),
      true,
    );
  });
});

describe("isGrokPreviewAdminRedirect", () => {
  it("leaves ordinary homepage document requests alone", () => {
    assert.equal(
      isGrokPreviewAdminRedirect({
        method: "GET",
        pathname: "/",
        accept: "text/html",
        fetchDest: "document",
        host: "127.0.0.1:8080",
      }),
      false,
    );
  });

  it("redirects Grok Open/document traffic from / to /admin", () => {
    assert.equal(
      isGrokPreviewAdminRedirect({
        method: "GET",
        pathname: "/",
        accept: "text/html",
        fetchDest: "document",
        grokIdentity: "token",
      }),
      true,
    );
    assert.equal(
      isGrokPreviewAdminRedirect({
        method: "GET",
        pathname: "/",
        accept: "text/html",
        fetchDest: "document",
        forwardedHost: "abc.grok-sandbox.com",
        host: "127.0.0.1:8080",
      }),
      true,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectTrustedOrigins,
  extraTrustedOrigins,
  resolveBetterAuthBaseURL,
  toOrigin,
} from "./trusted-origins.ts";

describe("toOrigin", () => {
  it("normalizes hosts and trailing slashes to https origins", () => {
    assert.equal(toOrigin("ora-app-sigma.vercel.app"), "https://ora-app-sigma.vercel.app");
    assert.equal(toOrigin("https://ora-app-sigma.vercel.app/"), "https://ora-app-sigma.vercel.app");
    assert.equal(toOrigin("https://ora-app-sigma.vercel.app/signup"), "https://ora-app-sigma.vercel.app");
  });

  it("rejects wildcards, empty values, and non-https public origins", () => {
    assert.equal(toOrigin(""), undefined);
    assert.equal(toOrigin("*.vercel.app"), undefined);
    assert.equal(toOrigin("https://*.vercel.app"), undefined);
    assert.equal(toOrigin("http://ora-app-sigma.vercel.app"), undefined);
    assert.equal(toOrigin("ftp://ora-app-sigma.vercel.app"), undefined);
  });
});

describe("extraTrustedOrigins", () => {
  it("keeps only exact https origins from a comma list", () => {
    assert.deepEqual(
      extraTrustedOrigins("https://ora.example, http://evil.test, *.vercel.app, ora-app-sigma.vercel.app"),
      ["https://ora.example", "https://ora-app-sigma.vercel.app"],
    );
  });
});

describe("resolveBetterAuthBaseURL", () => {
  it("prefers BETTER_AUTH_URL and falls back to the Vercel production host", () => {
    assert.equal(
      resolveBetterAuthBaseURL({
        betterAuthUrl: "https://ora-app-sigma.vercel.app/",
        vercelProductionUrl: "other.vercel.app",
        isVercel: true,
      }),
      "https://ora-app-sigma.vercel.app",
    );
    assert.equal(
      resolveBetterAuthBaseURL({
        vercelProductionUrl: "ora-app-sigma.vercel.app",
        vercelUrl: "ora-app-sigma-git-main.vercel.app",
        isVercel: true,
      }),
      "https://ora-app-sigma.vercel.app",
    );
    assert.equal(
      resolveBetterAuthBaseURL({
        vercelProductionUrl: "ora-app-sigma.vercel.app",
        isVercel: false,
      }),
      undefined,
    );
  });
});

describe("collectTrustedOrigins", () => {
  it("trusts the live Vercel production host and the current deployment host", () => {
    const origins = collectTrustedOrigins({
      betterAuthUrl: "https://ora-app-sigma.vercel.app",
      vercelProductionUrl: "ora-app-sigma.vercel.app",
      vercelUrl: "ora-app-sigma-abc123.vercel.app",
      includeLocalDev: false,
    });
    assert.deepEqual(origins.sort(), [
      "https://ora-app-sigma-abc123.vercel.app",
      "https://ora-app-sigma.vercel.app",
    ]);
  });

  it("does not allow arbitrary origins or preview wildcards in production", () => {
    const origins = collectTrustedOrigins({
      betterAuthUrl: "https://ora-app-sigma.vercel.app",
      extra: "https://evil.example, *",
      previewHosts: ["*.grok-sandbox.com"],
      includeLocalDev: false,
    });
    assert.ok(origins.includes("https://ora-app-sigma.vercel.app"));
    assert.ok(origins.includes("https://evil.example"));
    assert.ok(!origins.some((o) => o.includes("grok-sandbox")));
    assert.ok(!origins.includes("http://localhost:8080"));
    assert.ok(!origins.includes("*"));
  });

  it("keeps preview and loopback origins only for non-production", () => {
    const origins = collectTrustedOrigins({
      previewHosts: ["*.grok-sandbox.com"],
      includeLocalDev: true,
    });
    assert.ok(origins.includes("http://localhost:8080"));
    assert.ok(origins.includes("*.grok-sandbox.com"));
  });
});

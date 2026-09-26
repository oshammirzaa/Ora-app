import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminGate } from "./ora-admin-auth.ts";
import { complianceCategoryLabel } from "./ora-compliance.ts";
import {
  SHARED_IP_CATEGORY_LABEL,
  SHARED_IP_STATUS_CLEAR,
  SHARED_IP_STATUS_MATCH,
  deviceLabel,
  isPublicIp,
  latestAdvisorIps,
  newSharedFingerprints,
  sharedIpClusters,
  sharedIpReportExcerpt,
  trustedClientIp,
  type LoginEvent,
} from "./ora-ip-security.ts";

function headers(input: Record<string, string>) {
  const lower = new Map(Object.entries(input).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

const sample = (over: Partial<LoginEvent>): LoginEvent => ({
  advisorId: "adv_a",
  name: "Mira",
  email: "mira@example.com",
  ip: "203.0.113.10",
  at: "2026-09-20T12:00:00Z",
  device: "Chrome on Mac",
  userAgent: "Mozilla/5.0",
  ...over,
});

describe("trusted advisor login IP", () => {
  it("uses the platform header and ignores a caller-supplied forwarded list", () => {
    const ip = trustedClientIp(
      headers({
        "x-forwarded-for": "198.51.100.9, 203.0.113.4",
        "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.4",
      }),
    );
    assert.equal(ip, "203.0.113.10");
    assert.equal(trustedClientIp(headers({ "x-forwarded-for": "198.51.100.9" })), "");
    assert.equal(trustedClientIp(headers({ "x-real-ip": "203.0.113.8" })), "");
    assert.equal(
      trustedClientIp(headers({ "x-vercel-id": "sfo1::1", "x-real-ip": "203.0.113.8" })),
      "203.0.113.8",
    );
    assert.equal(
      trustedClientIp(headers({ "cf-connecting-ip": "203.0.113.7", "cf-ray": "abc" })),
      "203.0.113.7",
    );
    assert.equal(trustedClientIp(headers({ "cf-connecting-ip": "203.0.113.7" })), "");
  });

  it("does not treat loopback or private addresses as a shared public IP", () => {
    assert.equal(isPublicIp("127.0.0.1"), false);
    assert.equal(isPublicIp("10.1.1.1"), false);
    assert.equal(isPublicIp("192.168.1.20"), false);
    assert.equal(isPublicIp("172.16.4.2"), false);
    assert.equal(isPublicIp(""), false);
    const rows = latestAdvisorIps([
      sample({ advisorId: "adv_a", ip: "10.1.1.1" }),
      sample({ advisorId: "adv_b", name: "Elena", email: "elena@example.com", ip: "10.1.1.1" }),
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows.every((row) => row.status === SHARED_IP_STATUS_CLEAR), true);
    assert.equal(rows.every((row) => row.accountsOnIp === 1), true);
    assert.equal(sharedIpClusters([sample({ ip: "10.1.1.1" }), sample({ advisorId: "adv_b", ip: "10.1.1.1" })]).length, 0);
  });

  it("shows one advisor as clear and two public logins as a potential shared IP", () => {
    const alone = latestAdvisorIps([sample({})]);
    assert.equal(alone[0]?.status, SHARED_IP_STATUS_CLEAR);
    assert.equal(alone[0]?.accountsOnIp, 1);
    const events = [
      sample({ at: "2026-09-20T12:00:00Z" }),
      sample({ advisorId: "adv_b", name: "Elena", email: "elena@example.com", at: "2026-09-21T15:00:00Z", device: "Safari on iOS" }),
      sample({ advisorId: "adv_a", at: "2026-09-22T09:00:00Z", device: "Firefox on Windows" }),
    ];
    const rows = latestAdvisorIps(events);
    assert.equal(rows.length, 2);
    assert.equal(rows.every((row) => row.status === SHARED_IP_STATUS_MATCH), true);
    assert.equal(rows.every((row) => row.accountsOnIp === 2), true);
    const [cluster] = sharedIpClusters(events);
    assert.ok(cluster);
    assert.equal(cluster.ip, "203.0.113.10");
    assert.equal(cluster.accounts.length, 2);
    assert.equal(cluster.firstDetected, "2026-09-20T12:00:00Z");
    assert.equal(cluster.lastDetected, "2026-09-22T09:00:00Z");
    assert.equal(cluster.accounts[0]?.advisorId, "adv_a");
    assert.equal(cluster.accounts[1]?.email, "elena@example.com");
    const excerpt = sharedIpReportExcerpt(cluster);
    assert.match(excerpt, /Potential Shared IP/);
    assert.match(excerpt, /Multiple Accounts Detected on Same IP/);
    assert.match(excerpt, /203\.0\.113\.10/);
    assert.match(excerpt, /Advisor ID: adv_b/);
    assert.match(excerpt, /elena@example.com/);
    assert.doesNotMatch(excerpt, /fraud|fake account|suspend|banned/i);
    const again = newSharedFingerprints([cluster.fingerprint], [cluster]);
    assert.equal(again.length, 0);
    const grown = sharedIpClusters([
      ...events,
      sample({ advisorId: "adv_c", name: "Noah", email: "noah@example.com", at: "2026-09-23T01:00:00Z" }),
    ]);
    assert.equal(newSharedFingerprints([cluster.fingerprint], grown).length, 1);
  });

  it("labels a browser without storing a forwarded-for lookup", () => {
    assert.equal(deviceLabel("Mozilla/5.0 (iPhone) AppleWebKit Safari"), "Safari on iOS");
    assert.equal(complianceCategoryLabel("shared_ip"), SHARED_IP_CATEGORY_LABEL);
    const source = readFileSync(new URL("./ora-ip-security.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /get\(\s*["']x-forwarded-for["']\s*\)/i);
    assert.equal(
      adminGate({ signedIn: true, admin: null, permission: "advisors" }).ok,
      false,
    );
  });

  it("keeps IP Security owner-only and report-only in the admin wiring", () => {
    const api = readFileSync(new URL("./ora-ip-security-api.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../routes/admin/ip-security.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../components/admin-shell.tsx", import.meta.url), "utf8");
    const desk = readFileSync(new URL("../components/advisor-shell.tsx", import.meta.url), "utf8");
    const inbox = readFileSync(new URL("../routes/admin/ai-reports.tsx", import.meta.url), "utf8");
    assert.match(api, /requireAdmin\(context\.userId, "advisors"\)/);
    assert.match(api, /currentViewAs/);
    assert.match(api, /return \{ ok: true as const \}/);
    assert.doesNotMatch(api, /set status = 'suspended'|update ora_advisors set status|manual_rank|reject application/i);
    assert.match(page, /IP Security/);
    assert.match(page, /No duplicate detected/);
    assert.match(page, /Potential Shared IP/);
    assert.doesNotMatch(page, /fraud|fake account/i);
    assert.match(shell, /label: "IP Security"/);
    assert.match(desk, /recordAdvisorLogin/);
    assert.match(inbox, /Shared IP Detection/);
  });
});

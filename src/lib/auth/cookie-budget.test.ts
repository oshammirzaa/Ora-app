import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_TOKEN_COOKIE,
  VERCEL_TOTAL_HEADER_LIMIT,
  applyCookieBudget,
  apexCookieDomain,
  cookiesToExpire,
  estimatedCompactSessionCacheBytes,
  expirationLines,
} from "./cookie-budget.ts";

const TOKEN = `${SESSION_TOKEN_COOKIE}=signed-token.signature`;

test("a profile photo in the session cache crosses Vercel's header limit", () => {
  const empty = estimatedCompactSessionCacheBytes("");
  assert.ok(empty < 2_000, `session without a photo stays small (${empty})`);
  const photo = estimatedCompactSessionCacheBytes("data:image/jpeg;base64," + "a".repeat(28_000));
  assert.ok(
    photo > VERCEL_TOTAL_HEADER_LIMIT,
    `photo cache is ${photo} bytes, over the ${VERCEL_TOTAL_HEADER_LIMIT} byte 494 limit`,
  );
});

test("expires cache chunks and keeps the live session token", () => {
  const header = [
    TOKEN,
    "__Host-grok-auth.session_data.0=" + "x".repeat(20),
    "__Host-grok-auth.session_data.1=" + "y".repeat(20),
    "__Host-grok-auth.account_data=" + "z".repeat(20),
    "__Host-grok_gate_session=1",
    "ora_view_as=advisor_1",
  ].join("; ");
  const expire = cookiesToExpire(header);
  assert.equal(expire.includes(SESSION_TOKEN_COOKIE), false);
  assert.equal(expire.includes("__Host-grok_gate_session"), false);
  assert.equal(expire.includes("ora_view_as"), false);
  assert.ok(expire.includes("__Host-grok-auth.session_data"));
  assert.ok(expire.includes("__Host-grok-auth.session_data.0"));
  assert.ok(expire.includes("__Host-grok-auth.session_data.12"));
  assert.ok(expire.includes("__Host-grok-auth.account_data"));
  assert.ok(expire.includes("__Host-grok-auth.account_data.0"));
});

test("legacy session tokens are duplicates only when the canonical token is present", () => {
  const both = cookiesToExpire(
    `${TOKEN}; __Secure-better-auth.session_token=old; better-auth.session_data.0=chunk`,
  );
  assert.ok(both.includes("__Secure-better-auth.session_token"));
  assert.ok(both.includes("better-auth.session_data"));
  assert.equal(both.includes(SESSION_TOKEN_COOKIE), false);

  const onlyLegacy = cookiesToExpire("__Secure-better-auth.session_token=only-credential");
  assert.deepEqual(onlyLegacy, []);
});

test("clears are HttpOnly, Secure, SameSite=Lax, and __Host- cookies have no Domain", () => {
  const host = expirationLines("__Host-grok-auth.session_data.0", "orapsychic.xyz");
  assert.equal(host.length, 1);
  assert.match(host[0], /Secure/);
  assert.match(host[0], /HttpOnly/);
  assert.match(host[0], /SameSite=Lax/);
  assert.match(host[0], /Path=\//);
  assert.match(host[0], /Max-Age=0/);
  assert.doesNotMatch(host[0], /Domain=/i);

  const legacy = expirationLines("__Secure-better-auth.session_data", "www.orapsychic.com");
  assert.equal(legacy.length, 2);
  assert.match(legacy[1], /Domain=orapsychic\.com/);
  assert.equal(apexCookieDomain("www.orapsychic.xyz"), "orapsychic.xyz");
  assert.equal(apexCookieDomain("preview.example.com"), null);
});

test("response keeps the session token and replaces a cache write with an expiration", async () => {
  const response = new Response("ok", {
    headers: [
      ["set-cookie", `${SESSION_TOKEN_COOKIE}=fresh.sig; Path=/; Secure; HttpOnly; SameSite=Lax`],
      ["set-cookie", "__Host-grok-auth.session_data=huge; Path=/; Secure; HttpOnly; SameSite=Lax"],
      ["x-ok", "1"],
    ],
  });
  const request = new Request("https://orapsychic.xyz/api/auth/get-session", {
    headers: { cookie: `${TOKEN}; __Host-grok-auth.session_data.0=chunk` },
  });
  const next = applyCookieBudget(response, request);
  const set = next.headers.getSetCookie();
  assert.equal(next.headers.get("x-ok"), "1");
  assert.ok(set.some((line) => line.startsWith(`${SESSION_TOKEN_COOKIE}=fresh.sig`)));
  assert.equal(set.some((line) => line.startsWith("__Host-grok-auth.session_data=huge")), false);
  assert.ok(set.some((line) => line.startsWith("__Host-grok-auth.session_data=") && /Max-Age=0/.test(line)));
  assert.ok(set.some((line) => line.startsWith("__Host-grok-auth.session_data.0=") && /Max-Age=0/.test(line)));
  assert.equal(await next.text(), "ok");
});

test("a normal request without cache cookies is left unchanged", () => {
  const response = new Response("page", { status: 200 });
  const request = new Request("https://orapsychic.com/", {
    headers: { cookie: TOKEN },
  });
  const next = applyCookieBudget(response, request);
  assert.equal(next, response);
});

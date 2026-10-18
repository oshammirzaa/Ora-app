/**
 * Vercel rejects a request with 494 REQUEST_HEADER_TOO_LARGE once the combined
 * request headers pass about 32KB. Confirmed against orapsychic.xyz: a 32KB
 * Cookie still returns 200; 36KB returns 494.
 *
 * Better Auth's session cookie cache copies `user.image` into
 * `__Host-grok-auth.session_data`. Profile photos are data URLs up to ~80KB,
 * so that cache is chunked into many cookies and the browser sends all of
 * them on one Cookie header. The session token itself stays small. These
 * helpers drop the cache cookies and any legacy duplicates without touching
 * the live `__Host-` session token.
 */

export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

/** Combined request-header ceiling Vercel enforces on orapsychic.xyz / .com. */
export const VERCEL_TOTAL_HEADER_LIMIT = 32_768;

const CACHE_COOKIE =
  /^(?:__Host-grok-auth|__Secure-better-auth|better-auth|__Secure-grok-auth|grok-auth)\.(?:session_data|account_data)(?:\.\d+)?$/;

const LEGACY_SESSION_TOKEN =
  /^(?:__Secure-better-auth|better-auth|__Secure-grok-auth|grok-auth|__Secure-__Host-grok-auth)\.session_token(?:\.\d+)?$/;

const CACHE_FAMILIES = [
  "__Host-grok-auth.session_data",
  "__Host-grok-auth.account_data",
  "__Secure-better-auth.session_data",
  "__Secure-better-auth.account_data",
  "better-auth.session_data",
  "better-auth.account_data",
] as const;

/** Chunks a single oversized photo can produce. Higher indexes are expired with the family. */
const FAMILY_CHUNK_SWEEP = 24;

export function cookiePairs(header: string): Array<{ name: string; value: string }> {
  const pairs: Array<{ name: string; value: string }> = [];
  for (const part of String(header || "").split(";")) {
    const piece = part.trim();
    if (!piece) continue;
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    const name = piece.slice(0, eq).trim();
    if (!name) continue;
    pairs.push({ name, value: piece.slice(eq + 1) });
  }
  return pairs;
}

export function setCookieName(line: string): string {
  const name = String(line || "").split("=", 1)[0]?.trim() ?? "";
  return name;
}

export function isSessionCacheCookie(name: string): boolean {
  return CACHE_COOKIE.test(name);
}

/** Apex host for a domain-scoped clear. `__Host-` cookies must not use this. */
export function apexCookieDomain(hostname: string): string | null {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (host === "orapsychic.com" || host === "www.orapsychic.com") return "orapsychic.com";
  if (host === "orapsychic.xyz" || host === "www.orapsychic.xyz") return "orapsychic.xyz";
  return null;
}

function expandCacheFamilies(names: Iterable<string>): string[] {
  const set = new Set(names);
  for (const prefix of CACHE_FAMILIES) {
    let hit = false;
    for (const name of set) {
      if (name === prefix || name.startsWith(`${prefix}.`)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    set.add(prefix);
    for (let index = 0; index <= FAMILY_CHUNK_SWEEP; index += 1) {
      set.add(`${prefix}.${index}`);
    }
  }
  return [...set];
}

/**
 * Cookie names to expire. The live session token is never included, so a
 * signed-in visitor stays signed in. Legacy session-token names are removed
 * only when the canonical token is also present (duplicates, not the only
 * credential).
 */
export function cookiesToExpire(cookieHeader: string): string[] {
  const pairs = cookiePairs(cookieHeader);
  const hasCanonical = pairs.some((pair) => pair.name === SESSION_TOKEN_COOKIE);
  const names: string[] = [];
  for (const pair of pairs) {
    const { name } = pair;
    if (name === SESSION_TOKEN_COOKIE) continue;
    if (isSessionCacheCookie(name)) {
      names.push(name);
      continue;
    }
    if (name.startsWith("__Secure-__Host-")) {
      names.push(name);
      continue;
    }
    if (/^__Host-grok-auth\.session_token\.\d+$/.test(name)) {
      names.push(name);
      continue;
    }
    if (hasCanonical && LEGACY_SESSION_TOKEN.test(name)) names.push(name);
  }
  return expandCacheFamilies(names);
}

export function expirationLines(name: string, hostname: string): string[] {
  const hostOnly = `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (name.startsWith("__Host-")) return [hostOnly];
  const apex = apexCookieDomain(hostname);
  if (!apex) return [hostOnly];
  return [hostOnly, `${name}=; Domain=${apex}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`];
}

function requestHostname(request: Request): string {
  try {
    return new URL(request.url).hostname;
  } catch {
    return "";
  }
}

/**
 * Drop Set-Cookie writes for the session/account cache and expire cookies the
 * browser already stored. Session-token writes are preserved.
 */
export function applyCookieBudget(response: Response, request: Request): Response {
  const header = request.headers.get("cookie") ?? "";
  if (header.length > 24_000) {
    const sizes = cookiePairs(header).map((pair) => ({ name: pair.name, bytes: pair.value.length }));
    console.warn("[ora] request cookie header is large", { bytes: header.length, cookies: sizes });
  }
  const expire = new Set(cookiesToExpire(header));
  const existing = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const kept: string[] = [];
  for (const line of existing) {
    const name = setCookieName(line);
    if (name && isSessionCacheCookie(name)) {
      expire.add(name);
      continue;
    }
    kept.push(line);
  }
  for (const name of [...expire]) {
    if (isSessionCacheCookie(name)) {
      for (const extra of expandCacheFamilies([name])) expire.add(extra);
    }
  }
  if (expire.size === 0) return response;
  const hostname = requestHostname(request);
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    headers.append(key, value);
  });
  const emitted = new Set<string>();
  for (const line of kept) {
    headers.append("set-cookie", line);
    emitted.add(line);
  }
  for (const name of expire) {
    for (const line of expirationLines(name, hostname)) {
      if (emitted.has(line)) continue;
      headers.append("set-cookie", line);
      emitted.add(line);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Approximate compact cookie-cache size for a profile image. Used to prove the 494 threshold. */
export function estimatedCompactSessionCacheBytes(image: string): number {
  const sessionData = {
    session: {
      id: "session",
      token: "t".repeat(32),
      userId: "user",
      expiresAt: "2026-10-18T00:00:00.000Z",
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0",
    },
    user: {
      id: "user",
      email: "person@example.com",
      name: "Person",
      image,
      emailVerified: true,
      createdAt: "2026-10-18T00:00:00.000Z",
      updatedAt: "2026-10-18T00:00:00.000Z",
    },
    updatedAt: 1_760_000_000_000,
    version: "1",
  };
  const body = JSON.stringify({
    session: sessionData,
    expiresAt: 1_760_000_300_000,
    signature: "s".repeat(43),
  });
  return Buffer.from(body).toString("base64url").length;
}

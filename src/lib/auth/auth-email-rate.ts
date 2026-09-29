/** Same window for reset and verification sends. Five per address per hour. */
export const AUTH_EMAIL_WINDOW_MS = 60 * 60 * 1000;
export const AUTH_EMAIL_MAX = 5;

const buckets = new Map<string, number[]>();

export function authEmailRateKey(path: string, ip: string, email: string) {
  return `${path}\n${ip.trim() || "unknown"}\n${email.trim().toLowerCase()}`;
}

/** Pure decision so tests can prove registered and unknown addresses share one limit. */
export function authEmailRateDecision(previous: number[], now: number) {
  const recent = previous.filter((stamp) => now - stamp < AUTH_EMAIL_WINDOW_MS);
  return { allowed: recent.length < AUTH_EMAIL_MAX, recent };
}

export function allowAuthEmailRequest(key: string, now = Date.now()) {
  const decision = authEmailRateDecision(buckets.get(key) || [], now);
  if (!decision.allowed) {
    buckets.set(key, decision.recent);
    return false;
  }
  buckets.set(key, [...decision.recent, now]);
  return true;
}

export function resetAuthEmailRateForTests() {
  buckets.clear();
}

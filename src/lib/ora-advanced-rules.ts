/** Pure rules for advanced features. No database, no wallet writes, no auth. */

export const SLOT_DURATIONS = [10, 15, 20, 30] as const;
export type SlotDuration = (typeof SLOT_DURATIONS)[number];

export const BOOKING_BUSY = ["pending", "accepted", "reschedule_requested"] as const;

export const DEFAULT_DAILY_REWARDS = [1, 1, 2, 2, 3, 3, 5] as const;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const PERFORMANCE_MIN_SAMPLE = 5;
export const DEFAULT_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export const SMART_REPLY_CATEGORIES = ["greetings", "followups", "thanks", "general"] as const;
export type SmartReplyCategory = (typeof SMART_REPLY_CATEGORIES)[number];

export const SMART_REPLY_LIMIT = 30;
export const SMART_REPLY_CHARS = 280;

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export function isSlotDuration(value: unknown): value is SlotDuration {
  return SLOT_DURATIONS.includes(Number(value) as SlotDuration);
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function bookingOccupies(status: string) {
  return (BOOKING_BUSY as readonly string[]).includes(status);
}

export function canCustomerCancel(startAtMs: number, nowMs: number, cancelHours = 2) {
  if (!Number.isFinite(startAtMs) || !Number.isFinite(nowMs)) return false;
  const hours = Math.max(0, Number(cancelHours) || 0);
  return startAtMs - nowMs >= hours * 60 * 60 * 1000;
}

export function normalizeHm(value: unknown, fallback = "09:00") {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function hmToMinutes(value: string) {
  const [h, m] = normalizeHm(value).split(":").map(Number);
  return h * 60 + m;
}

export type DayWindow = { start: string; end: string };

export function parseDayWindows(value: unknown): DayWindow[] {
  if (!Array.isArray(value)) return [];
  const out: DayWindow[] = [];
  for (const row of value.slice(0, 4)) {
    if (!row || typeof row !== "object") continue;
    const start = normalizeHm((row as DayWindow).start, "");
    const end = normalizeHm((row as DayWindow).end, "");
    if (!start || !end) continue;
    if (hmToMinutes(end) <= hmToMinutes(start)) continue;
    out.push({ start, end });
  }
  return out;
}

export function tzOffsetMs(timeZone: string, utcMs: number) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((part) => [part.type, part.value]));
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/** Wall-clock date + HH:MM in a timezone, as a UTC epoch. */
export function wallTimeToUtcMs(date: string, hm: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return Number.NaN;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const minutes = hmToMinutes(hm);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  let offset = tzOffsetMs(timeZone || "UTC", asUtc);
  let utc = asUtc - offset;
  const again = tzOffsetMs(timeZone || "UTC", utc);
  if (again !== offset) utc = asUtc - again;
  return utc;
}

export function civilWeekday(date: string, timeZone: string): Weekday {
  const ms = wallTimeToUtcMs(date, "12:00", timeZone);
  if (!Number.isFinite(ms)) return "mon";
  const short = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", weekday: "short" }).format(new Date(ms));
  const map: Record<string, Weekday> = { Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat" };
  return map[short.slice(0, 3)] || "mon";
}

export function buildSlots(input: {
  date: string;
  timeZone: string;
  windows: DayWindow[];
  durationMin: number;
  nowMs: number;
  leadMin?: number;
  busy?: { startMs: number; endMs: number }[];
}) {
  const duration = Number(input.durationMin);
  if (!isSlotDuration(duration)) return [];
  const lead = Math.max(0, Number(input.leadMin ?? 15) || 0) * 60 * 1000;
  const busy = input.busy || [];
  const slots: { startMs: number; endMs: number }[] = [];
  for (const window of input.windows) {
    const open = hmToMinutes(window.start);
    const close = hmToMinutes(window.end);
    for (let cursor = open; cursor + duration <= close; cursor += duration) {
      const hh = String(Math.floor(cursor / 60)).padStart(2, "0");
      const mm = String(cursor % 60).padStart(2, "0");
      const startMs = wallTimeToUtcMs(input.date, `${hh}:${mm}`, input.timeZone);
      if (!Number.isFinite(startMs)) continue;
      const endMs = startMs + duration * 60 * 1000;
      if (startMs < input.nowMs + lead) continue;
      if (busy.some((row) => rangesOverlap(startMs, endMs, row.startMs, row.endMs))) continue;
      slots.push({ startMs, endMs });
    }
  }
  return slots;
}

export function nextStreak(input: {
  lastClaimAt: number | null;
  streak: number;
  now: number;
  cooldownMs?: number;
}) {
  const cooldown = Math.max(60_000, Number(input.cooldownMs ?? DAY_MS) || DAY_MS);
  const streak = Math.max(0, Math.floor(Number(input.streak) || 0));
  if (input.lastClaimAt == null || !Number.isFinite(input.lastClaimAt)) {
    return { ok: true, day: 1, waitMs: 0 };
  }
  const elapsed = input.now - input.lastClaimAt;
  if (elapsed < cooldown) return { ok: false, day: Math.max(1, streak), waitMs: cooldown - elapsed };
  if (elapsed >= cooldown * 2) return { ok: true, day: 1, waitMs: 0 };
  return { ok: true, day: streak >= 7 ? 1 : streak + 1, waitMs: 0 };
}

export function rewardCoinsForDay(day: number, rewards: readonly number[] = DEFAULT_DAILY_REWARDS) {
  const list = rewards.length ? rewards : DEFAULT_DAILY_REWARDS;
  const index = Math.min(list.length, Math.max(1, Math.floor(day))) - 1;
  return Math.max(0, Math.floor(Number(list[index]) || 0));
}

export const STREAK_PRIZE_MINUTES = 3;
export const REFERRAL_MINUTES = 3;

/** Check-ins do not pay coins. Only a completed day 7 adds free reading minutes. */
export function streakRewardMinutes(day: number) {
  return Math.floor(day) === 7 ? STREAK_PRIZE_MINUTES : 0;
}

export function streakNotice(day: number): { title: string; body: string } {
  const d = Math.min(7, Math.max(1, Math.floor(day) || 1));
  if (d === 7) {
    return {
      title: "3 Free Minutes Earned",
      body: "Congratulations! You've earned 3 FREE reading minutes!",
    };
  }
  if (d === 1) return { title: "Day 1 Streak Completed", body: "Day 1 streak completed! Keep going!" };
  if (d === 2) return { title: "2-Day Streak Completed", body: "2-day streak successful! Only 5 days left!" };
  if (d === 3) return { title: "3-Day Streak Completed", body: "3-day streak completed! You're getting closer!" };
  if (d === 6) return { title: "6-Day Streak Completed", body: "6-day streak completed! Just one more day!" };
  const left = 7 - d;
  return {
    title: `${d}-Day Streak Completed`,
    body: `${d}-day streak completed! Only ${left} day${left === 1 ? "" : "s"} left!`,
  };
}

export const REFERRAL_NOTICE = {
  title: "Referral Reward Earned",
  body: "You've earned 3 free reading minutes.",
};

/** Same network alone is only a review. A matching device and network is a confirmed duplicate. */
export function referralFraudDecision(input: {
  referredIp: string;
  referrerIp: string;
  referredDevice: string;
  referrerDevice: string;
  sameDeviceAsOther: boolean;
  sameIpAsOther: boolean;
}): { status: "ok" | "review" | "blocked"; reason: string } {
  const sameIp = Boolean(input.referredIp && input.referrerIp && input.referredIp === input.referrerIp);
  const sameDevice = Boolean(input.referredDevice && input.referrerDevice && input.referredDevice === input.referrerDevice);
  if (sameIp && sameDevice) return { status: "blocked", reason: "Same network and device as the referrer." };
  if (sameDevice) return { status: "review", reason: "Same device as the referrer." };
  if (input.sameDeviceAsOther) return { status: "review", reason: "This device was already used for a referral reward." };
  if (sameIp || input.sameIpAsOther) return { status: "review", reason: "Shared network. Needs a look before minutes are added." };
  return { status: "ok", reason: "" };
}

export function rewardIpBlocked(otherAccounts: number, maxAccounts = 2) {
  const max = Math.max(1, Math.floor(Number(maxAccounts) || 2));
  return Math.max(0, Math.floor(otherAccounts) || 0) >= max;
}

export function parseSmartReplies(input: unknown): { body: string; category: SmartReplyCategory }[] {
  const rows = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: { body: string; category: SmartReplyCategory }[] = [];
  for (const row of rows) {
    const body = String((row && typeof row === "object" ? (row as { body?: unknown }).body : row) ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, SMART_REPLY_CHARS);
    if (!body) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = String((row && typeof row === "object" ? (row as { category?: unknown }).category : "") || "general");
    const category = (SMART_REPLY_CATEGORIES as readonly string[]).includes(raw) ? (raw as SmartReplyCategory) : "general";
    out.push({ body, category });
    if (out.length >= SMART_REPLY_LIMIT) break;
  }
  return out;
}

export function alertAllowed(lastNotifiedAt: number | null, now: number, cooldownMs = DEFAULT_ALERT_COOLDOWN_MS) {
  if (lastNotifiedAt == null || !Number.isFinite(lastNotifiedAt)) return true;
  return now - lastNotifiedAt >= Math.max(0, cooldownMs);
}

export const ONLINE_ALERT_COPY = "Your favourite psychic is now online and available for a reading.";

export function referralEligible(input: {
  referrerId: string;
  referredId: string;
  referrerEmail?: string;
  referredEmail?: string;
  alreadyRewarded: boolean;
  paidCoins: number;
  refunded?: boolean;
  cancelled?: boolean;
}) {
  if (!input.referrerId || !input.referredId) return false;
  if (input.referrerId === input.referredId) return false;
  const left = String(input.referrerEmail || "").trim().toLowerCase();
  const right = String(input.referredEmail || "").trim().toLowerCase();
  if (left && right && left === right) return false;
  if (input.alreadyRewarded) return false;
  if (input.refunded || input.cancelled) return false;
  return Math.floor(Number(input.paidCoins) || 0) > 0;
}

export function giftRedeemAllowed(status: string) {
  return status === "paid";
}

export function giftPurchaseLocked(purchasesEnabled: boolean, paymentEnvOn: boolean) {
  return !(purchasesEnabled && paymentEnvOn);
}

export type PerformanceInput = {
  paidCompleted: number;
  returningClients: number;
  distinctClients: number;
  avgRating: number | null;
  ratingCount: number;
  avgResponseSeconds: number | null;
  accepted: number;
  missed: number;
  onlineSeconds: number;
  scheduledCompleted: number;
  rangeSeconds: number;
};

export type PerformancePart = { key: string; weight: number; value: number; detail: string };

/** Transparent 0–100 score. Null until the minimum paid-reading sample. Never changes commission. */
export function performanceScore(input: PerformanceInput): {
  score: number | null;
  public: false;
  sample: number;
  minimum: number;
  parts: PerformancePart[];
} {
  const paid = Math.max(0, Math.floor(input.paidCompleted) || 0);
  const clients = Math.max(0, Math.floor(input.distinctClients) || 0);
  const returning = Math.max(0, Math.floor(input.returningClients) || 0);
  const returnRate = clients ? Math.min(1, returning / clients) : 0;
  const rating =
    input.ratingCount > 0 && input.avgRating != null ? Math.max(0, Math.min(1, Number(input.avgRating) / 5)) : 0;
  const response =
    input.avgResponseSeconds == null
      ? 0.5
      : Math.max(0, Math.min(1, 1 - (Number(input.avgResponseSeconds) - 30) / 300));
  const decided = Math.max(0, Math.floor(input.accepted) || 0) + Math.max(0, Math.floor(input.missed) || 0);
  const accept = decided ? Math.max(0, Math.floor(input.accepted) || 0) / decided : 0.5;
  const target = Math.max(3600, Math.floor(input.rangeSeconds) * 0.05);
  const online = Math.max(0, Math.min(1, (Number(input.onlineSeconds) || 0) / target));
  const scheduled =
    Math.floor(input.scheduledCompleted) > 0
      ? Math.min(1, Math.floor(input.scheduledCompleted) / Math.max(1, paid))
      : 0.5;
  const parts: PerformancePart[] = [
    { key: "returning", weight: 0.2, value: returnRate, detail: "Clients with 2+ paid readings / distinct paid clients" },
    { key: "rating", weight: 0.25, value: rating, detail: "Average review / 5. Unrated periods score 0 on this part." },
    { key: "response", weight: 0.15, value: response, detail: "Accepted-request wait. 30s = 1, 330s = 0. Missing data = 0.5." },
    { key: "accepted", weight: 0.15, value: accept, detail: "Accepted live requests / (accepted + missed). Missing = 0.5." },
    { key: "online", weight: 0.15, value: online, detail: "Recorded online seconds vs 5% of the range (at least 1 hour)." },
    { key: "scheduled", weight: 0.1, value: scheduled, detail: "Completed appointments / paid readings. None completed = 0.5." },
  ];
  if (paid < PERFORMANCE_MIN_SAMPLE) {
    return { score: null, public: false, sample: paid, minimum: PERFORMANCE_MIN_SAMPLE, parts };
  }
  const raw = parts.reduce((sum, part) => sum + part.weight * part.value, 0);
  return {
    score: Math.round(Math.max(0, Math.min(1, raw)) * 100),
    public: false,
    sample: paid,
    minimum: PERFORMANCE_MIN_SAMPLE,
    parts,
  };
}

export function recoveredDisplaySeconds(local: number, server: number) {
  const left = Number.isFinite(local) ? local : 0;
  const right = Number.isFinite(server) ? server : 0;
  return Math.max(0, Math.floor(Math.max(left, right)));
}

/** Chargeable time comes from the server start instant, never from the device clock alone. */
export function chargeableSeconds(startedAtMs: number, nowMs: number) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

export function rangeStartMs(range: string, now: number) {
  if (range === "all") return null;
  if (range === "today") {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  const days = range === "90" ? 90 : range === "30" ? 30 : 7;
  return now - days * DAY_MS;
}

export function firstNonOverlapping<T extends { startMs: number; endMs: number }>(rows: T[]) {
  const kept: T[] = [];
  for (const row of rows) {
    if (kept.some((item) => rangesOverlap(item.startMs, item.endMs, row.startMs, row.endMs))) continue;
    kept.push(row);
  }
  return kept;
}

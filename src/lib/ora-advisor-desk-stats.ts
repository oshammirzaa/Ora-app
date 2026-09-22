import { overlapSeconds } from "./ora-advisor-auth.ts";
import { panelSplit } from "./ora-split.ts";

export type OrderFilter = "all" | "pending" | "progress" | "completed" | "cancelled";
export type InboxFilter = "all" | "online" | "paying" | "unread";
export type StatsRange = "day" | "week" | "month" | "all";
export type ClientKindFilter = "all" | "repeat" | "first" | "frequent" | "favorites" | "favoritedYou";

export function orderBucket(input: { kind: "request" | "reading"; status: string }): Exclude<OrderFilter, "all"> | "other" {
  const status = String(input.status || "").toLowerCase();
  if (input.kind === "request") {
    if (status === "pending") return "pending";
    if (status === "accepted") return "progress";
    if (status === "declined" || status === "expired" || status === "cancelled") return "cancelled";
    return "other";
  }
  if (status === "live") return "progress";
  if (status === "ended" || status === "completed") return "completed";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  return "other";
}

/** Accepted requests that already opened a reading are shown as that reading, not twice. */
export function includeChatRequestAsOrder(status: string, readingId = "") {
  const bucket = orderBucket({ kind: "request", status });
  if (bucket === "pending" || bucket === "cancelled") return true;
  if (bucket === "progress" && !String(readingId || "").trim()) return true;
  return false;
}

export function matchesOrderFilter(bucket: string, filter: OrderFilter) {
  if (filter === "all") return bucket !== "other";
  return bucket === filter;
}

export function matchesClientKind(
  row: { repeat: boolean; frequent?: boolean; favorite?: boolean; favoritedYou?: boolean } | boolean,
  filter: ClientKindFilter,
) {
  const flags = typeof row === "boolean" ? { repeat: row } : row;
  if (filter === "repeat") return flags.repeat;
  if (filter === "first") return !flags.repeat;
  if (filter === "frequent") return Boolean(flags.frequent);
  if (filter === "favorites") return Boolean(flags.favorite);
  if (filter === "favoritedYou") return Boolean(flags.favoritedYou);
  return true;
}

export function serviceTypeLabel(kind: "request" | "reading", status: string) {
  if (kind === "request" && status === "pending") return "Live text chat request";
  return "Live text chat";
}

export function pct(part: number, whole: number): number | null {
  const w = Number(whole) || 0;
  if (w <= 0) return null;
  return Math.round((Math.max(0, Number(part) || 0) / w) * 1000) / 10;
}

export function answerRate(accepted: number, declined: number) {
  return pct(accepted, accepted + declined);
}

export function completionRate(completed: number, cancelled: number) {
  return pct(completed, completed + cancelled);
}

export function repeatClientRate(repeatClients: number, totalClients: number) {
  return pct(repeatClients, totalClients);
}

export function averageOnlineSeconds(totalSeconds: number, daysWithPresence: number) {
  const days = Math.max(0, Math.floor(Number(daysWithPresence) || 0));
  if (days <= 0) return 0;
  return Math.floor(Math.max(0, Number(totalSeconds) || 0) / days);
}

export function formatPct(value: number | null) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

export function formatCoins(coins: number) {
  const n = Math.max(0, Math.floor(Number(coins) || 0));
  return `${n}c`;
}

export const ADVISOR_DAILY_CLIENT_MESSAGES = 30;
export const FOLLOWUP_MAX_CHARS = 400;
export const FREQUENT_CLIENT_READINGS = 5;

export function remainingDailyClientMessages(sentToday: number, cap = ADVISOR_DAILY_CLIENT_MESSAGES) {
  const sent = Math.max(0, Math.floor(Number(sentToday) || 0));
  const limit = Math.max(0, Math.floor(Number(cap) || 0));
  return Math.max(0, limit - sent);
}

/** UTC calendar day used for the daily outreach allowance, matching statsWindow("day"). */
export function advisorUtcDayKey(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDailyOutreachKind(kind: unknown) {
  const k = String(kind || "message").trim().toLowerCase();
  return k === "message" || k === "followup";
}

export function canClaimDailyMessage(used: number, cap = ADVISOR_DAILY_CLIENT_MESSAGES) {
  return remainingDailyClientMessages(used, cap) > 0;
}

export function dailyMessageQuotaView(sentToday: number, cap = ADVISOR_DAILY_CLIENT_MESSAGES) {
  const sent = Math.max(0, Math.floor(Number(sentToday) || 0));
  const limit = Math.max(0, Math.floor(Number(cap) || 0));
  const remaining = remainingDailyClientMessages(sent, limit);
  return { sent: Math.min(sent, limit), remaining, limit };
}

export function followUpDeniedReason(input: {
  hasEndedSession: boolean;
  alreadySent: boolean;
  remainingToday: number;
}): string | null {
  if (!input.hasEndedSession) return "Follow-up is only for customers you have already read with.";
  if (input.alreadySent) return "You already sent a follow-up for this reading.";
  if (input.remainingToday <= 0) {
    return `Daily client message limit reached. You can send ${ADVISOR_DAILY_CLIENT_MESSAGES} messages per day.`;
  }
  return null;
}

export function clientMessageDeniedReason(input: { hasSession: boolean; remainingToday: number }): string | null {
  if (!input.hasSession) return "You can only message clients you have already read with.";
  if (input.remainingToday <= 0) {
    return `Daily client message limit reached. You can send ${ADVISOR_DAILY_CLIENT_MESSAGES} messages per day.`;
  }
  return null;
}


export function coinsToUsd(coins: number) {
  return Math.max(0, Number(coins) || 0) / 10;
}

export function formatUsdFromCoins(coins: number) {
  return `$${coinsToUsd(coins).toFixed(2)}`;
}

export function inStatsWindow(iso: string | Date | null | undefined, from: Date | null, to: Date) {
  const t = new Date(String(iso || "")).getTime();
  if (!Number.isFinite(t)) return false;
  if (from && t < from.getTime()) return false;
  return t <= to.getTime();
}

/** Ended sittings only. Live, cancelled, and failed chats never count as completed. */
export function isCompletedReadingStatus(status: unknown) {
  const s = String(status || "").trim().toLowerCase();
  return s === "ended" || s === "completed";
}

export function isExcludedReadingStatus(status: unknown) {
  const s = String(status || "").trim().toLowerCase();
  return s === "cancelled" || s === "canceled" || s === "failed" || s === "live" || s === "pending";
}

/**
 * Billed paid minutes from coins actually charged at the sitting rate.
 * Promo, membership, and gifted minutes have no coins, so they return 0.
 */
export function paidMinutesFromCharge(coinsSpent: unknown, rateCoins: unknown) {
  const coins = Math.max(0, Number(coinsSpent) || 0);
  const rate = Math.max(0, Number(rateCoins) || 0);
  if (coins <= 0 || rate <= 0) return 0;
  return Math.round((coins / rate) * 100) / 100;
}

export function formatPaidMinuteValue(minutes: number) {
  const n = Math.max(0, Number(minutes) || 0);
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} min` : `${rounded.toFixed(1)} min`;
}

export type DeskReadingStat = {
  readingId: string;
  customerId: string;
  status: string;
  startedAt: string;
  endedAt: string;
  coinsSpent: number;
  rateCoins: number;
};

export function readingCompletedAt(row: { endedAt?: string; startedAt?: string; status?: string }) {
  const ended = String(row.endedAt || "").trim();
  if (ended) return ended;
  if (isCompletedReadingStatus(row.status)) return String(row.startedAt || "");
  return "";
}

/** Prior sittings with this advisor. Live, cancelled, and unpaid requests are left out. */
export function summarizeIncomingClientHistory(
  rows: Array<{
    status: string;
    coinsSpent?: number;
    rateCoins?: number;
    startedAt?: string;
    endedAt?: string;
  }>,
) {
  const completed = rows.filter((row) => isCompletedReadingStatus(row.status));
  let paidMinutes = 0;
  let lastReadingAt = "";
  let lastMs = 0;
  for (const row of completed) {
    paidMinutes += paidMinutesFromCharge(row.coinsSpent, row.rateCoins);
    const at = readingCompletedAt({
      endedAt: String(row.endedAt || ""),
      startedAt: String(row.startedAt || ""),
      status: row.status,
    });
    const t = new Date(at).getTime();
    if (at && Number.isFinite(t) && t >= lastMs) {
      lastMs = t;
      lastReadingAt = at;
    }
  }
  const previousReadings = completed.length;
  return {
    previousReadings,
    lastReadingAt,
    returning: previousReadings >= 1,
    paidMinutes: Math.round(paidMinutes * 100) / 100,
  };
}

export function incomingClientInfoView(input: {
  returning?: boolean;
  previousReadings?: number;
  lastReadingAt?: string;
  paidMinutes?: number;
  favorited?: boolean;
}) {
  const previousReadings = Math.max(0, Math.floor(Number(input.previousReadings) || 0));
  const returning = Boolean(input.returning) && previousReadings >= 1;
  return {
    kind: returning ? ("returning" as const) : ("new" as const),
    label: returning ? "Returning client" : "New client",
    previousReadings: returning ? previousReadings : 0,
    lastReadingAt: returning ? String(input.lastReadingAt || "").trim() : "",
    paidMinutes: returning ? Math.max(0, Number(input.paidMinutes) || 0) : 0,
    favorited: Boolean(input.favorited),
    showHistory: returning,
  };
}

/** Completed billed activity in a window. Free, live, cancelled, and clawed refunds are left out of paid totals. */
export function summarizeAdvisorDeskWindow(
  rows: DeskReadingStat[],
  window: { from: Date | null; to: Date },
  clawedIds: Iterable<string> = [],
  extraPriorClientIds: Iterable<string> = [],
) {
  const clawed = new Set([...clawedIds].map((id) => String(id || "")).filter(Boolean));
  const extraPrior = new Set([...extraPriorClientIds].map((id) => String(id || "")).filter(Boolean));
  const completedRows = rows.filter((row) => {
    if (!isCompletedReadingStatus(row.status)) return false;
    const at = readingCompletedAt(row);
    return Boolean(at) && inStatsWindow(at, window.from, window.to);
  });
  const cancelled = rows.filter((row) => {
    const s = String(row.status || "").toLowerCase();
    if (s !== "cancelled" && s !== "canceled") return false;
    return inStatsWindow(row.endedAt || row.startedAt, window.from, window.to);
  }).length;
  const paidRows = completedRows.filter(
    (row) => Number(row.coinsSpent) > 0 && !clawed.has(row.readingId),
  );
  const paidMinutes = paidRows.reduce(
    (n, row) => n + paidMinutesFromCharge(row.coinsSpent, row.rateCoins),
    0,
  );
  const charged = paidRows.reduce((n, row) => n + Math.max(0, Math.floor(Number(row.coinsSpent) || 0)), 0);
  const earnings = paidRows.reduce((n, row) => n + panelSplit(row.coinsSpent).advisorEarnings, 0);
  const clients = new Set(paidRows.map((row) => row.customerId).filter(Boolean));
  let newClients = 0;
  let repeatClients = 0;
  for (const id of clients) {
    if (!window.from) {
      const lifetime = paidRows.filter((row) => row.customerId === id).length;
      if (lifetime >= 2) repeatClients += 1;
      else newClients += 1;
      continue;
    }
    const fromMs = window.from.getTime();
    const prior = rows.filter((row) => {
      if (row.customerId !== id || !isCompletedReadingStatus(row.status)) return false;
      if (Math.max(0, Number(row.coinsSpent) || 0) <= 0 || clawed.has(row.readingId)) return false;
      const at = readingCompletedAt(row);
      if (!at) return false;
      return new Date(at).getTime() < fromMs;
    }).length;
    const kind = todayClientKind(prior + (extraPrior.has(id) ? 1 : 0));
    if (kind === "repeat") repeatClients += 1;
    else newClients += 1;
  }
  return {
    completed: completedRows.length,
    cancelled,
    paidReadings: paidRows.length,
    paidMinutes: Math.round(paidMinutes * 100) / 100,
    charged,
    earnings,
    totalClients: clients.size,
    newClients,
    firstTimeClients: newClients,
    repeatClients,
  };
}

export function customerIsActive(lastAt: string | Date | null, now = Date.now(), windowMs = 5 * 60 * 1000) {
  if (!lastAt) return false;
  const t = new Date(lastAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= windowMs;
}

export function matchesInboxFilter(
  row: { unread: number; paying: boolean; active: boolean },
  filter: InboxFilter,
) {
  if (filter === "unread") return row.unread > 0;
  if (filter === "paying") return row.paying;
  if (filter === "online") return row.active;
  return true;
}

export function parseStatsDay(value: string | undefined) {
  const v = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function statsWindow(range: StatsRange, now = new Date(), dayIso?: string): { from: Date | null; to: Date } {
  const to = new Date(now);
  const specific = parseStatsDay(dayIso);
  if (specific) {
    const end = new Date(specific);
    end.setUTCDate(end.getUTCDate() + 1);
    return { from: specific, to: end };
  }
  if (range === "all") return { from: null, to };
  if (range === "day") {
    return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), to };
  }
  if (range === "week") {
    const day = now.getUTCDay() || 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (day - 1));
    return { from: start, to };
  }
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to };
}

export function windowIncludesNow(from: Date | null, to: Date, now = Date.now()) {
  if (from && now < from.getTime()) return false;
  return now <= to.getTime();
}

export const PRESENCE_STALE_MS = 15 * 60 * 1000;

export function presenceCountedEnd(
  row: { endedAt?: string | null; lastSeenAt?: string | null },
  now = new Date(),
  opts: { live?: boolean; staleMs?: number } = {},
) {
  const ended = String(row.endedAt || "").trim();
  if (ended) return new Date(ended);
  if (opts.live) return now;
  const seen = String(row.lastSeenAt || "").trim();
  const seenAt = seen ? new Date(seen).getTime() : NaN;
  const staleMs = opts.staleMs ?? PRESENCE_STALE_MS;
  if (Number.isFinite(seenAt) && now.getTime() - seenAt > staleMs) return new Date(seenAt);
  return now;
}

export function presenceSecondsInWindow(
  rows: Array<{ startedAt: string; endedAt?: string | null; lastSeenAt?: string | null }>,
  window: { from: Date | null; to: Date },
  opts: { now?: Date; live?: boolean; staleMs?: number } = {},
) {
  const now = opts.now ?? new Date();
  const from = window.from || new Date(0);
  return rows.reduce((n, row) => {
    const end = presenceCountedEnd(row, now, opts);
    return n + overlapSeconds(row.startedAt, end, from, window.to);
  }, 0);
}

export function classifyClient(readingCount: number): "first" | "repeat" {
  return readingCount >= 2 ? "repeat" : "first";
}

export function classifyClientBand(readingCount: number): "first" | "returning" | "frequent" {
  const n = Math.max(0, Math.floor(Number(readingCount) || 0));
  if (n >= FREQUENT_CLIENT_READINGS) return "frequent";
  if (n >= 2) return "returning";
  return "first";
}

export function isFrequentClient(readingCount: number) {
  return classifyClientBand(readingCount) === "frequent";
}

export type CompactAdvisorClient = {
  id: string;
  name: string;
  readings: number;
  lastAt?: string;
  photoUrl?: string;
  loyaltyTier?: string;
  favorite?: boolean;
  favoritedYou?: boolean;
  repeat?: boolean;
};

export function compactClientBuckets<T extends CompactAdvisorClient>(clients: T[], limit = 6) {
  const cap = Math.max(1, Math.floor(Number(limit) || 6));
  const seen = (list: T[]) => {
    const ids = new Set<string>();
    const out: T[] = [];
    for (const row of list) {
      const id = String(row.id || "").trim();
      if (!id || ids.has(id)) continue;
      ids.add(id);
      out.push(row);
      if (out.length >= cap) break;
    }
    return out;
  };
  return {
    returning: seen(clients.filter((c) => Boolean(c.repeat))),
    favorites: seen(clients.filter((c) => Boolean(c.favorite))),
    favoritedYou: seen(clients.filter((c) => Boolean(c.favoritedYou))),
  };
}

/** A client who sat in this window is new if they had no prior readings with this advisor. */
export function todayClientKind(priorReadingsBeforeWindow: number): "new" | "repeat" {
  return Math.max(0, Math.floor(Number(priorReadingsBeforeWindow) || 0)) > 0 ? "repeat" : "new";
}

export type WalletBillingKind = "included" | "paid" | "none";

export function walletBillingKind(input: { coins?: number; includedSeconds?: number }): WalletBillingKind {
  const included = Math.max(0, Number(input.includedSeconds) || 0);
  const coins = Math.max(0, Number(input.coins) || 0);
  if (included > 0) return "included";
  if (coins > 0) return "paid";
  return "none";
}

export function walletBillingLabel(kind: WalletBillingKind) {
  if (kind === "included") return "Included minutes";
  if (kind === "paid") return "Paid balance";
  return "No balance";
}

export function waitingSeconds(createdAt: string | Date | null | undefined, now = Date.now()) {
  if (!createdAt) return 0;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 1000));
}

export function formatWait(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function availabilityLabel(input: { online: boolean; busy: boolean; live?: boolean }) {
  if (input.live) return "In a reading";
  if (input.busy) return "Busy";
  if (input.online) return "In service";
  return "Offline";
}

/** Pending live-chat requests expire after this window. Matches SQL `interval '3 minutes'`. */
export const INCOMING_REQUEST_TTL_MS = 3 * 60_000;

export function isIncomingRequestFresh(createdAt: string | Date | undefined, now = Date.now()) {
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t >= 0 && now - t <= INCOMING_REQUEST_TTL_MS;
}

/** Oldest fresh pending request — one overlay at a time, no duplicates. */
export function pickActiveIncomingRequest<T extends { id?: string; createdAt?: string }>(
  requests: T[] | null | undefined,
  now = Date.now(),
): T | null {
  const fresh = dedupeIncomingRequests(requests, now);
  return fresh[0] || null;
}

export function incomingQueueOthers<T extends { id?: string; createdAt?: string }>(
  requests: T[] | null | undefined,
  activeId?: string,
  now = Date.now(),
): T[] {
  const active = String(activeId || "").trim();
  return dedupeIncomingRequests(requests, now).filter((row) => String(row.id || "") !== active);
}

export function dedupeIncomingRequests<T extends { id?: string; createdAt?: string }>(
  requests: T[] | null | undefined,
  now = Date.now(),
): T[] {
  const seen = new Set<string>();
  const fresh: T[] = [];
  for (const row of requests || []) {
    const id = String(row?.id || "").trim();
    if (!id || seen.has(id) || !isIncomingRequestFresh(row.createdAt, now)) continue;
    seen.add(id);
    fresh.push(row);
  }
  return fresh.sort((a, b) => {
    const at = new Date(a.createdAt || 0).getTime();
    const bt = new Date(b.createdAt || 0).getTime();
    const aOk = Number.isFinite(at) ? at : 0;
    const bOk = Number.isFinite(bt) ? bt : 0;
    if (aOk !== bOk) return aOk - bOk;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function formatAdvisorMinuteRate(rateCoins: number) {
  const n = Math.max(0, Math.floor(Number(rateCoins) || 0));
  return n ? `${n}c/min` : "—";
}

export function shortClientId(id: string | undefined) {
  const s = String(id || "").trim();
  if (!s) return "";
  if (s.length <= 18) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

/** House advisors may take overlapping chats. Independents hide the queue while live or busy. */
export function showIncomingQueue(input: { live?: boolean; busy?: boolean; house?: boolean }) {
  if (input.house) return true;
  return !input.live && !input.busy;
}

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export type DayHours = { on: boolean; start: string; end: string };
export type AdvisorHours = Record<WeekdayKey, DayHours>;

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function weekdayLabel(key: WeekdayKey) {
  return WEEKDAY_LABELS[key];
}

function validHm(value: unknown) {
  const v = String(value || "");
  return /^\d{2}:\d{2}$/.test(v) ? v : "09:00";
}

export function emptyAdvisorHours(): AdvisorHours {
  const row = (): DayHours => ({ on: false, start: "09:00", end: "17:00" });
  return {
    mon: row(),
    tue: row(),
    wed: row(),
    thu: row(),
    fri: row(),
    sat: row(),
    sun: row(),
  };
}

export function parseHoursJson(raw: unknown): AdvisorHours {
  const base = emptyAdvisorHours();
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return base;
    try {
      parsed = JSON.parse(t);
    } catch {
      return base;
    }
  }
  if (!parsed || typeof parsed !== "object") return base;
  const rec = parsed as Record<string, unknown>;
  for (const key of WEEKDAY_KEYS) {
    const item = rec[key];
    if (!item || typeof item !== "object") continue;
    const row = item as { on?: unknown; start?: unknown; end?: unknown };
    base[key] = {
      on: Boolean(row.on),
      start: validHm(row.start),
      end: validHm(row.end),
    };
  }
  return base;
}

export function serializeHoursJson(hours: AdvisorHours) {
  return JSON.stringify(parseHoursJson(hours));
}

export const REMINDER_PRESETS = [
  { id: "tomorrow", label: "Tomorrow", days: 1 },
  { id: "3days", label: "3 days", days: 3 },
  { id: "7days", label: "7 days", days: 7 },
  { id: "14days", label: "14 days", days: 14 },
  { id: "30days", label: "30 days", days: 30 },
  { id: "custom", label: "Custom", days: 0 },
] as const;

export const SNOOZE_PRESETS = [
  { id: "1hour", label: "1 hour" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "3days", label: "3 days" },
  { id: "custom", label: "Custom" },
] as const;

export type ReminderPresetId = (typeof REMINDER_PRESETS)[number]["id"];
export type SnoozePresetId = (typeof SNOOZE_PRESETS)[number]["id"];
export type ReminderBucket = "due" | "upcoming" | "completed";
export const REMINDER_NOTE_MAX = 280;
export const REMINDER_DUPLICATE_WINDOW_MS = 60_000;

function reminderPresetDays(preset: string) {
  const id = preset === "week" ? "7days" : String(preset || "");
  const found = REMINDER_PRESETS.find((p) => p.id === id && p.days > 0);
  return found?.days ?? 0;
}

export function reminderDueAt(preset: string, customIso?: string, now = Date.now()): Date | null {
  const id = String(preset || "");
  if (id === "custom") {
    const t = new Date(String(customIso || "")).getTime();
    if (!Number.isFinite(t)) return null;
    return new Date(t);
  }
  const days = reminderPresetDays(id);
  if (!days) return null;
  const due = new Date(now);
  due.setHours(9, 0, 0, 0);
  due.setDate(due.getDate() + days);
  return due;
}

export function snoozeDueAt(preset: string, customIso?: string, now = Date.now()): Date | null {
  const id = String(preset || "");
  if (id === "1hour") return new Date(now + 60 * 60 * 1000);
  if (id === "custom") return reminderDueAt("custom", customIso, now);
  if (id === "tomorrow") return reminderDueAt("tomorrow", undefined, now);
  if (id === "3days") return reminderDueAt("3days", undefined, now);
  return null;
}

export function reminderLocalParts(iso?: string | Date | null, now = new Date()) {
  const d = iso ? new Date(iso) : now;
  if (Number.isNaN(d.getTime())) return { date: "", time: "09:00" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function reminderFromLocalParts(date: string, time = "09:00"): Date | null {
  const day = String(date || "").trim();
  const clock = String(time || "").trim() || "09:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (!/^\d{2}:\d{2}$/.test(clock)) return null;
  const parsed = new Date(`${day}T${clock}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function reminderBucket(
  input: { dueAt?: string | null; doneAt?: string | null },
  now = Date.now(),
): ReminderBucket {
  if (String(input.doneAt || "").trim()) return "completed";
  const due = new Date(String(input.dueAt || "")).getTime();
  if (!Number.isFinite(due)) return "upcoming";
  return due <= now ? "due" : "upcoming";
}

export type AdvisorReminderRow = {
  id: string;
  customerId: string;
  name: string;
  dueAt: string;
  note: string;
  doneAt: string;
  due: boolean;
  photoUrl?: string;
  loyaltyTier?: string;
  notifiedAt?: string;
};

export function groupAdvisorReminders<T extends { dueAt?: string | null; doneAt?: string | null }>(
  items: T[],
  now = Date.now(),
) {
  const groups: Record<ReminderBucket, T[]> = { due: [], upcoming: [], completed: [] };
  for (const item of items) groups[reminderBucket(item, now)].push(item);
  const byDue = (a: T, b: T) => new Date(String(a.dueAt || 0)).getTime() - new Date(String(b.dueAt || 0)).getTime();
  groups.due.sort(byDue);
  groups.upcoming.sort(byDue);
  groups.completed.sort((a, b) => byDue(b, a));
  return groups;
}

export function pickDueReminder<T extends { id?: string; dueAt?: string; doneAt?: string | null }>(
  items: T[] | null | undefined,
  dismissedIds: Iterable<string> = [],
  now = Date.now(),
): T | null {
  const skip = new Set([...dismissedIds].map((id) => String(id || "")).filter(Boolean));
  const due = (items || []).filter((row) => {
    const id = String(row?.id || "").trim();
    if (!id || skip.has(id)) return false;
    return reminderBucket(row, now) === "due";
  });
  due.sort((a, b) => new Date(String(a.dueAt || 0)).getTime() - new Date(String(b.dueAt || 0)).getTime());
  return due[0] || null;
}

export function isDuplicateOpenReminder(
  existing: { customerId?: string; note?: string; dueAt?: string; doneAt?: string | null },
  candidate: { customerId?: string; note?: string; dueAt?: string | Date },
  windowMs = REMINDER_DUPLICATE_WINDOW_MS,
) {
  if (String(existing.doneAt || "").trim()) return false;
  if (String(existing.customerId || "") !== String(candidate.customerId || "")) return false;
  if (String(existing.note || "").trim() !== String(candidate.note || "").trim()) return false;
  const a = new Date(String(existing.dueAt || "")).getTime();
  const b = new Date(candidate.dueAt || "").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= windowMs;
}

export function shouldBrowserNotifyReminder(input: { notifiedAt?: string | null; doneAt?: string | null }) {
  if (String(input.doneAt || "").trim()) return false;
  return !String(input.notifiedAt || "").trim();
}

export const ADVISOR_REPORT_REASONS = [
  { id: "abuse", label: "Abusive or harassing" },
  { id: "spam", label: "Spam or scam" },
  { id: "payment", label: "Payment dispute" },
  { id: "safety", label: "Safety concern" },
  { id: "other", label: "Other" },
] as const;

export type AdvisorReportReason = (typeof ADVISOR_REPORT_REASONS)[number]["id"];
export type AdvisorReportKind = "report" | "escalate";

export function parseAdvisorReportReason(value: unknown): AdvisorReportReason {
  const id = String(value || "").trim();
  return ADVISOR_REPORT_REASONS.some((r) => r.id === id) ? (id as AdvisorReportReason) : "other";
}

export function parseAdvisorReportKind(value: unknown): AdvisorReportKind {
  return String(value || "") === "escalate" ? "escalate" : "report";
}

export function advisorReportReasonLabel(value: unknown) {
  const id = parseAdvisorReportReason(value);
  return ADVISOR_REPORT_REASONS.find((r) => r.id === id)?.label || "Other";
}

export function revenueStatus(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "live") return "In progress";
  if (s === "ended" || s === "completed") return "Completed";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  return status || "Recorded";
}

export const ADVISOR_GENDERS = ["female", "male", "nonbinary", "unspecified"] as const;
export type AdvisorGender = (typeof ADVISOR_GENDERS)[number];

export function normalizeGender(value: unknown): AdvisorGender {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (v === "female" || v === "woman" || v === "f") return "female";
  if (v === "male" || v === "man" || v === "m") return "male";
  if (v === "nonbinary" || v === "nb") return "nonbinary";
  return "unspecified";
}

export function genderLabel(value: unknown) {
  const g = normalizeGender(value);
  if (g === "female") return "Female";
  if (g === "male") return "Male";
  if (g === "nonbinary") return "Non-binary";
  return "Prefer not to say";
}

/** Hide unspecified / empty gender so advisors never guess. */
export function visibleClientGender(value: unknown) {
  const g = normalizeGender(value);
  if (g === "unspecified") return "";
  return genderLabel(g);
}

/** Strict YYYY-MM-DD calendar date. Empty or invalid → "". Never invents a birthday. */
export function parseBirthDate(value: unknown): string {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (dt.getTime() > todayUtc) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function formatBirthDate(value: unknown) {
  const ymd = parseBirthDate(value);
  if (!ymd) return "";
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatLongDate(value: unknown) {
  const d = new Date(String(value || ""));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatLastConversation(value: unknown, now = Date.now()) {
  const t = new Date(String(value || "")).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "Just now";
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  }
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  return formatLongDate(value);
}

export function averageReadingSeconds(totalSeconds: number, readings: number) {
  const n = Math.max(0, Math.floor(Number(readings) || 0));
  if (!n) return 0;
  return Math.max(0, Number(totalSeconds) || 0) / n;
}

export function formatReadingMinutes(seconds: number) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.round((s / 60) * 100) / 100;
  return `${m} min`;
}

export type GalleryItem = { id: string; kind: "photo" | "video"; src: string };

const MAX_GALLERY = 6;

function isAllowedMediaSrc(src: string, kind: "photo" | "video") {
  const v = String(src || "").trim();
  if (!v) return false;
  if (kind === "photo") {
    return v.startsWith("data:image/") || v.startsWith("/") || /^https?:\/\//i.test(v);
  }
  return v.startsWith("/") || /^https?:\/\//i.test(v);
}

export function parseGalleryJson(raw: unknown, max = MAX_GALLERY): GalleryItem[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      parsed = JSON.parse(t);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: GalleryItem[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { id?: unknown; kind?: unknown; src?: unknown; url?: unknown };
    const kind = rec.kind === "video" ? "video" : rec.kind === "photo" ? "photo" : "";
    const src = String(rec.src ?? rec.url ?? "").trim();
    if (kind !== "photo" && kind !== "video") continue;
    if (!isAllowedMediaSrc(src, kind)) continue;
    out.push({
      id: String(rec.id || `media_${out.length + 1}`).slice(0, 64),
      kind,
      src: src.slice(0, kind === "photo" ? 400_000 : 500),
    });
    if (out.length >= max) break;
  }
  return out;
}

export function serializeGallery(items: GalleryItem[]) {
  return JSON.stringify(parseGalleryJson(items));
}

export function parseSpecialtiesList(raw: unknown): string[] {
  return String(raw || "")
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function joinSpecialties(list: unknown) {
  const names = Array.isArray(list) ? list.map((s) => String(s).trim()).filter(Boolean) : parseSpecialtiesList(list);
  return [...new Set(names)].slice(0, 12).join(", ").slice(0, 120);
}

export function parseQuickReplies(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    const body = String(item || "")
      .trim()
      .slice(0, 280);
    if (!body) continue;
    if (out.some((x) => x.toLowerCase() === body.toLowerCase())) continue;
    out.push(body);
    if (out.length >= 12) break;
  }
  return out;
}

export function visibleAdvisorPhoto(url: unknown) {
  const v = String(url || "").trim();
  if (!v) return "";
  if (v.startsWith("data:image/") || v.startsWith("/") || /^https?:\/\//i.test(v)) return v;
  return "";
}

export const ADVISOR_FAQ = [
  {
    q: "How do I appear on the customer floor?",
    a: "Use In service in the header or Service status on My Profile. You stay off the floor until you turn it on.",
  },
  {
    q: "What does Ready for live text chat do?",
    a: "When it is off, new paid chats cannot start even if you are in service. Finish a live reading before going offline.",
  },
  {
    q: "How is revenue split?",
    a: "You keep 20% of billed coins. Ora keeps 80%. Ten coins equal one US dollar. Withdrawals are reviewed by the house.",
  },
  {
    q: "Where do reviews come from?",
    a: "Customers can rate a completed live text chat. New advisors show no rating until a real review lands.",
  },
  {
    q: "What happens if I block someone?",
    a: "Blocked customers cannot start a new live text chat with you. You can unblock them from Settings at any time.",
  },
  {
    q: "How many follow-up messages can I send?",
    a: "After a completed live text chat you can send one follow-up to that client. Follow-ups count toward your daily client-message limit of 30.",
  },
] as const;


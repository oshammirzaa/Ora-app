export type OrderFilter = "all" | "pending" | "progress" | "completed" | "cancelled";
export type InboxFilter = "all" | "online" | "paying" | "unread";
export type StatsRange = "day" | "week" | "month" | "all";
export type ClientKindFilter = "all" | "repeat" | "first";

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

export function matchesClientKind(repeat: boolean, filter: ClientKindFilter) {
  if (filter === "repeat") return repeat;
  if (filter === "first") return !repeat;
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

export function coinsToUsd(coins: number) {
  return Math.max(0, Number(coins) || 0) / 10;
}

export function formatUsdFromCoins(coins: number) {
  return `$${coinsToUsd(coins).toFixed(2)}`;
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

export function classifyClient(readingCount: number): "first" | "repeat" {
  return readingCount >= 2 ? "repeat" : "first";
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
] as const;


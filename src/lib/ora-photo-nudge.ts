export const PHOTO_NUDGE_DELAY_MS = 5 * 60_000;

export const PHOTO_NUDGE_COPY = {
  title: "Add a profile picture you love ✨",
  body: "Make your Ora profile feel like you and spread positive energy.",
} as const;

export const PHOTO_NUDGE_HREF = "/me#profile-photo";

const PLACEHOLDER_PATHS = new Set([
  "",
  "/favicon.svg",
  "/favicon.ico",
  "/images/ora-logo.png",
  "/images/ora-mark.svg",
  "/__grok/icon-180.png",
]);

/** A stored avatar that is empty, a brand mark, or a generated placeholder is not a real upload. */
export function isRealCustomerPhoto(image: unknown) {
  const value = String(image ?? "").trim();
  if (!value || /^(null|undefined|none|default|placeholder)$/i.test(value)) return false;
  if (value.startsWith("blob:")) return false;
  if (/(gravatar\.com|ui-avatars\.com|dicebear\.com|robohash\.org|identicon|default-avatar|placeholder)/i.test(value)) {
    return false;
  }
  let path = value.split("#")[0]?.split("?")[0] || "";
  let host = "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      path = url.pathname;
      host = url.hostname.toLowerCase();
    } catch {
      return false;
    }
  }
  if (PLACEHOLDER_PATHS.has(path)) return false;
  if (value.startsWith("data:image/svg")) return false;
  if (/^data:image\/(png|jpe?g|webp|gif);/i.test(value)) return true;
  if (host.endsWith("googleusercontent.com") && path.length > 1) return true;
  if ((value.startsWith("/") || /^https?:\/\//i.test(value)) && /\.(png|jpe?g|webp|gif|avif)$/i.test(path)) return true;
  return false;
}

export function hasCustomerPhoto(image: unknown) {
  return isRealCustomerPhoto(image);
}

/** Customers only. Advisors, owners, and admins never get this reminder. */
export function customerPhotoNudgeEligible(input: {
  role?: string | null;
  isAdmin?: boolean;
  isAdvisor?: boolean;
}) {
  if (input.isAdmin || input.isAdvisor) return false;
  const role = String(input.role || "client").trim().toLowerCase();
  return role === "client" || role === "customer" || role === "member" || role === "";
}

export function photoNudgeWaitMs(input: {
  startedAt?: string | Date | number | null;
  now?: number;
  delayMs?: number;
}) {
  const delay = Math.max(0, input.delayMs ?? PHOTO_NUDGE_DELAY_MS);
  const now = input.now ?? Date.now();
  const raw = input.startedAt;
  const started = raw instanceof Date ? raw.getTime() : typeof raw === "number" ? raw : raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(started)) return delay;
  return Math.max(0, started + delay - now);
}

export type PhotoNudgeSession = {
  startedAt: number;
  later: boolean;
};

/** One clock per app session. A missing or broken stamp starts at `now` and does not stack timers. */
export function normalizePhotoNudgeSession(
  raw: Partial<PhotoNudgeSession> | null | undefined,
  now: number,
): PhotoNudgeSession {
  const started = Number(raw?.startedAt);
  if (!Number.isFinite(started) || started <= 0 || started > now + 5_000) {
    return { startedAt: now, later: false };
  }
  return { startedAt: started, later: Boolean(raw?.later) };
}

export function photoNudgePresentation(input: {
  eligible: boolean;
  hasPhoto: boolean;
  quiet: boolean;
  later: boolean;
  startedAt: number | null;
  now: number;
  delayMs?: number;
}) {
  const waitMs = photoNudgeWaitMs({ startedAt: input.startedAt, now: input.now, delayMs: input.delayMs });
  const show =
    input.eligible && !input.hasPhoto && !input.quiet && !input.later && input.startedAt != null && waitMs === 0;
  return { show, waitMs };
}

export function shouldShowPhotoNudge(input: {
  hasPhoto?: boolean;
  dismissed?: boolean;
  eligible?: boolean;
  quiet?: boolean;
  startedAt?: string | Date | number | null;
  now?: number;
  delayMs?: number;
}) {
  return photoNudgePresentation({
    eligible: input.eligible !== false,
    hasPhoto: Boolean(input.hasPhoto),
    quiet: Boolean(input.quiet),
    later: Boolean(input.dismissed),
    startedAt: input.startedAt == null ? null : new Date(input.startedAt).getTime(),
    now: input.now ?? Date.now(),
    delayMs: input.delayMs,
  }).show;
}

export function photoNudgeQuietPath(path: string) {
  const p = String(path || "");
  return (
    p.startsWith("/reading/") ||
    p.startsWith("/wait/") ||
    p.startsWith("/advisor") ||
    p.startsWith("/admin") ||
    p.startsWith("/login") ||
    p.startsWith("/signup")
  );
}

export type PhotoNudgeState = {
  show: boolean;
  waitMs: number;
  hasPhoto: boolean;
  eligible: boolean;
  href: string;
};

import { visibleAdvisorPhoto } from "./ora-advisor-desk-stats.ts";

export const PHOTO_NUDGE_DELAY_MS = 5 * 60_000;

export const PHOTO_NUDGE_COPY = {
  title: "Add a profile picture you love ✨",
  body: "Make your Ora profile feel like you and spread positive energy.",
} as const;

export const PHOTO_NUDGE_HREF = "/me#profile-photo";

export function hasCustomerPhoto(image: unknown) {
  return Boolean(visibleAdvisorPhoto(image));
}

export function photoNudgeWaitMs(input: {
  startedAt?: string | Date | null;
  now?: number;
  delayMs?: number;
}) {
  const delay = Math.max(0, input.delayMs ?? PHOTO_NUDGE_DELAY_MS);
  const started = input.startedAt ? new Date(input.startedAt).getTime() : NaN;
  if (!Number.isFinite(started)) return delay;
  return Math.max(0, started + delay - (input.now ?? Date.now()));
}

export function shouldShowPhotoNudge(input: {
  hasPhoto?: boolean;
  dismissed?: boolean;
  startedAt?: string | Date | null;
  now?: number;
  delayMs?: number;
}) {
  if (input.hasPhoto || input.dismissed) return false;
  if (!input.startedAt) return false;
  return photoNudgeWaitMs(input) === 0;
}

export function photoNudgeQuietPath(path: string) {
  const p = String(path || "");
  return (
    p.startsWith("/reading/") ||
    p.startsWith("/wait/") ||
    p.startsWith("/advisor") ||
    p.startsWith("/admin") ||
    p.startsWith("/login") ||
    p.startsWith("/signup") ||
    p === "/me" ||
    p.startsWith("/me/")
  );
}

export type PhotoNudgeState = {
  show: boolean;
  waitMs: number;
  hasPhoto: boolean;
  href: string;
};

export const ADVISOR_PANEL_SHARE_PCT = 20;
export const PLATFORM_PANEL_SHARE_PCT = 80;

export function advisorAccessGate(input: {
  signedIn: boolean;
  advisorStatus?: string | null;
  profileStatus?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.signedIn) return { ok: false, reason: "unauthenticated" };
  if (input.profileStatus === "suspended") return { ok: false, reason: "suspended" };
  const status = String(input.advisorStatus || "").trim().toLowerCase();
  if (!status) return { ok: false, reason: "not_advisor" };
  if (status === "pending") return { ok: false, reason: "pending" };
  if (status === "declined" || status === "rejected") return { ok: false, reason: "declined" };
  if (status === "paused") return { ok: false, reason: "paused" };
  if (status === "suspended") return { ok: false, reason: "suspended" };
  if (status !== "live") return { ok: false, reason: "not_approved" };
  return { ok: true };
}

export function advisorDeniedMessage(reason: string) {
  if (reason === "unauthenticated") return "Sign in required.";
  if (reason === "pending") return "Your advisor application is still in review.";
  if (reason === "declined") return "Your advisor application was declined.";
  if (reason === "paused") return "This advisor desk is paused.";
  if (reason === "suspended") return "This account is suspended.";
  if (reason === "not_advisor") return "Advisor access only.";
  return "Only approved advisors can open this desk.";
}

export function panelSplit(coins: number) {
  const c = Math.max(0, Math.floor(Number(coins) || 0));
  const advisorEarnings = Math.floor((c * ADVISOR_PANEL_SHARE_PCT) / 100);
  return { advisorEarnings, platformRevenue: c - advisorEarnings };
}

export function readingMinutes(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.round((s / 60) * 100) / 100;
}

export function overlapSeconds(startedAt: Date | string, endedAt: Date | string | null, windowStart: Date, windowEnd: Date) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const from = Math.max(start, windowStart.getTime());
  const to = Math.min(end, windowEnd.getTime());
  return Math.max(0, Math.floor((to - from) / 1000));
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function applicationBucket(status: string): "pending" | "approved" | "rejected" | "other" {
  const s = String(status || "").trim().toLowerCase();
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "declined" || s === "rejected") return "rejected";
  return "other";
}

export function advisorLoginOutcome(kind: string): { ok: true } | { ok: false; message: string } {
  const k = String(kind || "").trim().toLowerCase();
  if (k === "live") return { ok: true };
  if (k === "pending") {
    return {
      ok: false,
      message: "Your advisor application is still in review. You cannot open the desk until the owner approves you.",
    };
  }
  if (k === "declined" || k === "rejected") {
    return {
      ok: false,
      message: "Your advisor application was rejected. Advisor login is not available.",
    };
  }
  if (k === "paused") return { ok: false, message: advisorDeniedMessage("paused") };
  if (k === "suspended") return { ok: false, message: advisorDeniedMessage("suspended") };
  return { ok: false, message: "Advisor access only. Submit an application first." };
}

export function safeApplicationPhoto(value: string): string {
  const v = String(value || "").trim();
  if (!v || v.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v.slice(0, 500);
  return "";
}

export function requiredApplicationError(input: {
  legalName: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  bio: string;
  specialties: string;
  years: number;
  rateCoins: number;
  availability: string;
  photoUrl: string;
}) {
  if (!input.legalName.trim()) return "Full name is required.";
  if (!input.name.trim()) return "Display name is required.";
  if (!input.email.trim() || !input.email.includes("@")) return "A valid email is required.";
  if (!input.phone.trim()) return "Phone is required.";
  if (!input.country.trim()) return "Country is required.";
  if (input.bio.trim().length < 20) return "Write a short bio (at least 20 characters).";
  if (!input.specialties.trim()) return "Specialties are required.";
  if (!Number.isFinite(input.years) || input.years < 0) return "Years of experience is required.";
  if (!Number.isFinite(input.rateCoins) || input.rateCoins < 8) return "Requested rate is required.";
  if (!input.availability.trim()) return "Availability is required.";
  return null;
}

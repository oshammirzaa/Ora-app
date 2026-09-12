/** Pure admin-gate helpers. Used by requireAdmin; safe to unit-test without a database. */

export type AdminRole = "owner" | "admin";

export const GROK_GATE_PROVIDER = "grok-gate";
export const GROK_VIEWER_EMAIL_DOMAIN = "viewer.grok.invalid";

export type AdminRecord = {
  role: string;
  permissions: string;
};

export function adminHasPermission(stored: string, needed?: string) {
  if (!needed) return true;
  const p = stored.trim();
  if (!p) return false;
  if (p === "*" || p === "all") return true;
  return p
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(needed);
}

export type AdminGateInput = {
  signedIn: boolean;
  profileStatus?: string;
  profileRole?: string;
  admin?: AdminRecord | null;
  permission?: string;
};

export type AdminGateReason = "unauthenticated" | "suspended" | "not_admin" | "forbidden";

export function adminGate(
  input: AdminGateInput,
): { ok: true } | { ok: false; reason: AdminGateReason } {
  if (!input.signedIn) return { ok: false, reason: "unauthenticated" };
  if (input.profileStatus === "suspended") return { ok: false, reason: "suspended" };
  if (!input.admin) return { ok: false, reason: "not_admin" };
  if (!adminHasPermission(input.admin.permissions, input.permission)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true };
}

export function adminDeniedMessage(reason: AdminGateReason) {
  if (reason === "suspended") return "This account is suspended.";
  if (reason === "unauthenticated") return "Sign in required.";
  return "Not admin";
}

export function normalizeOwnerEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

/** Explicit env assignment only. Empty/unset never matches. */
export function isDesignatedOwnerEmail(configured?: string | null, userEmail?: string | null) {
  const want = normalizeOwnerEmail(configured);
  const got = normalizeOwnerEmail(userEmail);
  return Boolean(want && got && want === got);
}

export function isPreviewOperatorEligible(
  workspacePreview: boolean,
  providerIds: string[],
  email?: string | null,
) {
  if (!workspacePreview) return false;
  if (providerIds.some((id) => String(id).toLowerCase() === GROK_GATE_PROVIDER)) return true;
  const addr = String(email || "").trim().toLowerCase();
  return addr.endsWith(`@${GROK_VIEWER_EMAIL_DOMAIN}`);
}

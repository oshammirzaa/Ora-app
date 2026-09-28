export const RESET_SENT_MESSAGE =
  "If an account exists for this email, we've sent password reset instructions.";

export const PASSWORD_MIN_LENGTH = 8;

const PRODUCTION_RESET: Record<string, string> = {
  "orapsychic.com": "https://orapsychic.com/reset-password",
  "www.orapsychic.com": "https://orapsychic.com/reset-password",
  "orapsychic.xyz": "https://orapsychic.xyz/reset-password",
  "www.orapsychic.xyz": "https://orapsychic.xyz/reset-password",
};

function hostOf(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Where a reset email should send the browser. Preview and expired deploy hosts never win. */
export function passwordResetRedirect(pageOrigin: string) {
  const host = hostOf(pageOrigin);
  if (PRODUCTION_RESET[host]) return PRODUCTION_RESET[host];
  try {
    const url = new URL(pageOrigin);
    if (url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1" || host === "[::1]")) {
      return `${url.origin}/reset-password`;
    }
  } catch {
    /* fall through */
  }
  return "https://orapsychic.xyz/reset-password";
}

/** Rewrite Better Auth's reset link so the token URL stays on a live Ora domain. */
export function stabilizeResetEmailUrl(raw: string) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (!PRODUCTION_RESET[host] && !local) {
    url.protocol = "https:";
    url.hostname = "orapsychic.xyz";
    url.port = "";
  }
  const callback = url.searchParams.get("callbackURL");
  if (callback) url.searchParams.set("callbackURL", passwordResetRedirect(callback));
  return url.toString();
}

export function publicCredentialMessage(raw: string) {
  const message = String(raw || "");
  if (/invalid email or password|invalid_email_or_password/i.test(message)) return "Invalid email or password.";
  if (/suspended/i.test(message)) return "This account is suspended.";
  return "Could not sign in. Try again.";
}

export function resetFailureMessage(raw: string) {
  const message = String(raw || "");
  if (/short|at least 8/i.test(message)) return "Password must be at least 8 characters.";
  if (/long/i.test(message)) return "That password is too long.";
  if (/match/i.test(message)) return "Passwords do not match.";
  return "This reset link is invalid or expired. Request a new one.";
}

/**
 * Same account system, two doors.
 * A live advisor always opens the existing desk, never the customer home.
 * An owner or admin who is not a live advisor opens the existing admin panel.
 * A customer opens /home. Status blocks stay status messages.
 */
export function loginDestination(
  intent: "customer" | "advisor",
  kind: string,
  role?: string,
): { href: string; notice: string } {
  const status = String(kind || "").trim().toLowerCase();
  const account = String(role || "").trim().toLowerCase();
  if (status === "suspended" || account === "suspended") return { href: "", notice: "This account is suspended." };
  if (status === "live") return { href: "/advisor", notice: "" };
  if (account === "owner" || account === "admin") return { href: "/admin", notice: "" };
  if (status === "pending") return { href: "/advisor/applied", notice: "" };
  if (status === "paused") return { href: "", notice: "This advisor desk is paused." };
  if (status === "declined" || status === "rejected") {
    if (intent === "advisor") {
      return { href: "", notice: "Your advisor application was rejected. Advisor login is not available." };
    }
    return { href: "/home", notice: "" };
  }
  return { href: "/home", notice: "" };
}

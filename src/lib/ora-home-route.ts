import { isMarketingHost } from "./ora-domains.ts";

export const CUSTOMER_HOME_PATH = "/home" as const;
export const ADVISOR_DASHBOARD_PATH = "/advisor" as const;

export type AccountHomePath = typeof CUSTOMER_HOME_PATH | typeof ADVISOR_DASHBOARD_PATH;
export type OraMarkTarget = "/" | AccountHomePath;

/** Profile role set when an advisor is approved. Customers stay client/customer. */
export function isAdvisorAccountRole(role: string | null | undefined) {
  return String(role || "").trim().toLowerCase() === "advisor";
}

/**
 * Ora logo and Home on orapsychic.com.
 * Advisors open the advisor dashboard. Customers and signed-out visitors keep /home.
 * orapsychic.xyz is unchanged: the app always keeps /home.
 */
export function accountHomePath(input: {
  role?: string | null;
  hostname?: string | null;
  marketingHost?: boolean;
}): AccountHomePath {
  const marketing =
    typeof input.marketingHost === "boolean" ? input.marketingHost : isMarketingHost(String(input.hostname || ""));
  if (marketing && isAdvisorAccountRole(input.role)) return ADVISOR_DASHBOARD_PATH;
  return CUSTOMER_HOME_PATH;
}

/** Rewrite a customer-home login target. Any other path, including /advisor, stays put. Same origin only. */
export function loginHrefForRole(
  href: string,
  input: { role?: string | null; hostname?: string | null; marketingHost?: boolean },
) {
  if (href !== CUSTOMER_HOME_PATH) return href;
  return accountHomePath(input);
}

/** Logo target. Explicit /advisor stays. Website advisors never land on / or customer /home. */
export function resolveOraMarkTarget(
  to: OraMarkTarget,
  input: { role?: string | null; marketingHost: boolean },
): OraMarkTarget {
  if (to === ADVISOR_DASHBOARD_PATH) return ADVISOR_DASHBOARD_PATH;
  if (!input.marketingHost || !isAdvisorAccountRole(input.role)) return to;
  return ADVISOR_DASHBOARD_PATH;
}

export function customerHomeGuardDecision(input: {
  marketingHost: boolean;
  role?: string | null;
}): { action: "allow" } | { action: "redirect"; to: typeof ADVISOR_DASHBOARD_PATH } {
  if (input.marketingHost && isAdvisorAccountRole(input.role)) {
    return { action: "redirect", to: ADVISOR_DASHBOARD_PATH };
  }
  return { action: "allow" };
}

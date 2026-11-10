import { isAdvisorAccountRole } from "./ora-home-route.ts";
import { MEMBERSHIP_PLANS, type MembershipPlan, type MembershipPlanId } from "./ora-membership-plan.ts";

export const MEMBERSHIP_OFFER_DISMISS_KEY = "ora-membership-offer-dismissed";

const HIDDEN_PREFIXES = ["/membership", "/advisor", "/admin", "/reading", "/wait", "/login", "/signup", "/auth", "/delete-account"];

export type MembershipOfferView = "purchase" | "member" | "hide";

function isStaffRole(role: string | null | undefined) {
  const value = String(role || "").trim().toLowerCase();
  return isAdvisorAccountRole(value) || value === "admin" || value === "owner" || value.startsWith("admin");
}

/**
 * Once per browser visit on orapsychic.com.
 * Guests and signed-in customers without a plan see the purchase offer.
 * An active member sees their plan instead of a second purchase prompt.
 */
export function membershipOfferDecision(input: {
  marketingHost: boolean;
  signedIn: boolean;
  role?: string | null;
  membershipActive: boolean;
  dismissed: boolean;
  pathname?: string;
}): MembershipOfferView {
  if (!input.marketingHost || input.dismissed) return "hide";
  const path = String(input.pathname || "/");
  if (HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return "hide";
  if (input.signedIn) {
    const role = String(input.role || "").trim();
    if (!role || isStaffRole(role)) return "hide";
  }
  if (input.membershipActive) return "member";
  return "purchase";
}

/** Plans the customer does not already own. An active member is not offered their current plan. */
export function membershipOfferPlans(ownedPlan?: string | null): MembershipPlan[] {
  const owned: MembershipPlanId | "" = ownedPlan === "mini" || ownedPlan === "membership" ? ownedPlan : "";
  return [MEMBERSHIP_PLANS.mini, MEMBERSHIP_PLANS.membership].filter((plan) => plan.plan !== owned);
}
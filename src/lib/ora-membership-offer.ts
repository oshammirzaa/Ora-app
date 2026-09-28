import { isAdvisorAccountRole } from "./ora-home-route.ts";
import { MEMBERSHIP_PLANS, type MembershipPlan, type MembershipPlanId } from "./ora-membership-plan.ts";

export const MEMBERSHIP_OFFER_DISMISS_KEY = "ora-membership-offer-dismissed";

const HIDDEN_PREFIXES = ["/membership", "/advisor", "/admin", "/reading", "/wait", "/login", "/signup", "/auth"];

export function membershipOfferDecision(input: {
  marketingHost: boolean;
  signedIn: boolean;
  role?: string | null;
  membershipActive: boolean;
  dismissed: boolean;
  pathname?: string;
}): "show" | "hide" {
  if (!input.marketingHost || !input.signedIn) return "hide";
  if (!String(input.role || "").trim() || isAdvisorAccountRole(input.role)) return "hide";
  if (input.membershipActive || input.dismissed) return "hide";
  const path = String(input.pathname || "/");
  if (HIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return "hide";
  return "show";
}

/** Plans the customer does not already own. An active member is not offered their current plan. */
export function membershipOfferPlans(ownedPlan?: string | null): MembershipPlan[] {
  const owned: MembershipPlanId | "" = ownedPlan === "mini" || ownedPlan === "membership" ? ownedPlan : "";
  return [MEMBERSHIP_PLANS.mini, MEMBERSHIP_PLANS.membership].filter((plan) => plan.plan !== owned);
}

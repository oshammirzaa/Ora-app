/** Stripe Checkout wallet options. Prices and coin packs stay in the catalog. */

export const GOOGLE_PAY_DOMAINS = ["orapsychic.com", "www.orapsychic.com", "orapsychic.xyz", "www.orapsychic.xyz"] as const;

export function applyCheckoutWallet(body: URLSearchParams) {
  body.set("payment_method_types[0]", "card");
  body.set("payment_method_options[card][request_three_d_secure]", "automatic");
}

export function walletLabel(wallet: string) {
  if (wallet === "google_pay") return "Google Pay";
  if (wallet === "apple_pay") return "Apple Pay";
  if (wallet === "card") return "Card";
  return "";
}

type ChargeWallet = { type?: string } | null | undefined;

export function walletFromCheckoutSession(session: {
  payment_intent?: unknown;
}): "google_pay" | "apple_pay" | "card" | "" {
  const intent = session.payment_intent;
  if (!intent || typeof intent !== "object") return "";
  const charge = (intent as { latest_charge?: unknown }).latest_charge;
  if (!charge || typeof charge !== "object") return "";
  const card = (
    charge as { payment_method_details?: { card?: { wallet?: ChargeWallet } } }
  ).payment_method_details?.card;
  if (!card) return "";
  const type = String(card.wallet?.type || "").toLowerCase();
  if (type === "google_pay" || type === "apple_pay") return type;
  return "card";
}

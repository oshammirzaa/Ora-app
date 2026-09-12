import { COINS_PER_DOLLAR } from "@/lib/ora";

export type CoinPack = {
  id: string;
  name: string;
  coins: number;
  amountCents: number;
  currency: string;
  active: boolean;
  sortOrder: number;
};

export type PaymentRow = {
  id: string;
  packId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  coins: number;
  status: string;
  paidAt: string;
  createdAt: string;
  returnTo: string;
};

export function formatMoney(cents: number, currency = "USD") {
  const n = Math.max(0, Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || "USD"}`;
  }
}

type PayOp =
  | "listPacks"
  | "paymentConfig"
  | "startCheckout"
  | "getPayment"
  | "confirmSandbox"
  | "failSandbox"
  | "cancelPayment"
  | "confirmStripe"
  | "listMyPayments";

async function payRequest<T>(op: PayOp, data?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (typeof window !== "undefined") {
    const { getBearerToken } = await import("./auth/client");
    const token = getBearerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch("/api/pay", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ op, data: data ?? {} }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(json.error || "Payment request failed.");
  return json;
}

export const listPacks = () => payRequest<CoinPack[]>("listPacks");

export const paymentConfig = () =>
  payRequest<{ currency: string; stripeEnabled: boolean; packs: CoinPack[] }>("paymentConfig");

export const startCheckout = ({
  data,
}: {
  data: { packId: string; returnTo?: string; origin?: string };
}) =>
  payRequest<{ paymentId: string; url: string; provider: "stripe" | "sandbox" }>("startCheckout", data);

export const getPayment = ({ data }: { data: { id: string } }) =>
  payRequest<{ payment: PaymentRow; pack: CoinPack | null } | null>("getPayment", data);

export const confirmSandboxPayment = ({ data }: { data: { id: string } }) =>
  payRequest<{ status: string; credited: boolean; coins: number; paymentId: string }>("confirmSandbox", data);

export const failSandboxPayment = ({ data }: { data: { id: string } }) =>
  payRequest<{ status: "failed" }>("failSandbox", data);

export const cancelPayment = ({ data }: { data: { id: string } }) =>
  payRequest<{ ok: true }>("cancelPayment", data);

export const confirmStripeReturn = ({ data }: { data: { sessionId: string } }) =>
  payRequest<{ status: string; paymentId: string }>("confirmStripe", data);

export const listMyPayments = () => payRequest<PaymentRow[]>("listMyPayments");

export { COINS_PER_DOLLAR };

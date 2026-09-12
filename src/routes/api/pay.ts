import { createFileRoute } from "@tanstack/react-router";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitizePath(raw: string) {
  const p = String(raw || "").trim();
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("://")) return "/account";
  return p.slice(0, 200);
}

function sanitizeOrigin(raw: string) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.origin;
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/api/pay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
        const { requireUserId, UnauthorizedError } = await import("@/lib/auth/verify.server");
        const pay = await import("@/lib/ora-pay.server");
        try {
          assertSameSiteRequest();
          const body = (await request.json().catch(() => ({}))) as {
            op?: string;
            data?: Record<string, unknown>;
          };
          const op = String(body.op || "");
          const data = body.data ?? {};
          const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || undefined;

          if (op === "listPacks") return json(await pay.loadPacks(true));
          if (op === "paymentConfig") return json(await pay.getPaymentConfig());

          const userId = await requireUserId(bearer);
          if (op === "startCheckout") {
            return json(
              await pay.startCheckoutForUser(userId, {
                packId: String(data.packId ?? "").slice(0, 64),
                returnTo: sanitizePath(String(data.returnTo ?? "/account")),
                origin: sanitizeOrigin(String(data.origin ?? "")),
              }),
            );
          }
          if (op === "getPayment") return json(await pay.getOwnedPayment(userId, String(data.id ?? "").slice(0, 64)));
          if (op === "confirmSandbox") return json(await pay.confirmSandboxForUser(userId, String(data.id ?? "").slice(0, 64)));
          if (op === "failSandbox") return json(await pay.failSandboxForUser(userId, String(data.id ?? "").slice(0, 64)));
          if (op === "cancelPayment") return json(await pay.cancelOwnedPayment(userId, String(data.id ?? "").slice(0, 64)));
          if (op === "confirmStripe") {
            return json(await pay.confirmStripeSessionForUser(userId, String(data.sessionId ?? "").slice(0, 200)));
          }
          if (op === "listMyPayments") return json(await pay.listOwnedPayments(userId));
          return json({ error: "Unknown payment operation." }, 400);
        } catch (err) {
          const status = err instanceof UnauthorizedError ? 401 : 400;
          const message = err instanceof Error ? err.message : "Payment request failed.";
          return json({ error: message }, status);
        }
      },
    },
  },
});

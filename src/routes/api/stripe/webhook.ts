import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pay = await import("@/lib/ora-pay.server");
        const secret = pay.stripeWebhookSecret();
        if (!secret) return new Response("not configured", { status: 503 });
        const raw = await request.text();
        const header = request.headers.get("stripe-signature") || "";
        const ok = await pay.verifyStripeSignature(raw, header, secret);
        if (!ok) return new Response("invalid signature", { status: 400 });
        let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(raw) as typeof event;
        } catch {
          return new Response("invalid payload", { status: 400 });
        }
        await pay.handleStripeEvent(event);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

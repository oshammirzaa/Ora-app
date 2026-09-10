import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";
import { handleStripeEvent, verifyStripeSignature } from "@/lib/ora-pay";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = env("STRIPE_WEBHOOK_SECRET");
        if (!secret) return new Response("not configured", { status: 503 });
        const raw = await request.text();
        const header = request.headers.get("stripe-signature") || "";
        const ok = await verifyStripeSignature(raw, header, secret);
        if (!ok) return new Response("invalid signature", { status: 400 });
        let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(raw) as typeof event;
        } catch {
          return new Response("invalid payload", { status: 400 });
        }
        await handleStripeEvent(event);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

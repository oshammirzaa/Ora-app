import { createFileRoute } from "@tanstack/react-router";
import { applyCookieBudget } from "@/lib/auth/cookie-budget";
import { auth } from "@/lib/auth/server";

async function handle(request: Request) {
  return applyCookieBudget(await auth.handler(request), request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});


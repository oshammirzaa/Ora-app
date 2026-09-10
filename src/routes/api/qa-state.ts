import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/qa-state")({
  server: {
    handlers: {
      GET: async () => new Response(null, { status: 404 }),
      POST: async () => new Response(null, { status: 404 }),
    },
  },
});

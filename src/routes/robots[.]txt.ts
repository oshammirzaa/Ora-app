import { createFileRoute } from "@tanstack/react-router";
import { publicRobotsResponse } from "@/lib/ora-marketing";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => publicRobotsResponse(request),
    },
  },
});

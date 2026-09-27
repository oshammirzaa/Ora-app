import { createFileRoute } from "@tanstack/react-router";
import { publicSitemapResponse } from "@/lib/ora-marketing";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => publicSitemapResponse(request),
    },
  },
});

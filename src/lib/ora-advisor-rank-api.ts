import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const advisorRankProgress = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadAdvisorRankView } = await import("./ora-earnings-rank-store");
    return loadAdvisorRankView(context.userId);
  });

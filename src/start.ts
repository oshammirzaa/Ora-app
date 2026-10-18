import { createMiddleware, createStart } from "@tanstack/react-start";
import { applyCookieBudget } from "@/lib/auth/cookie-budget";

const cookieBudget = createMiddleware({ type: "request" }).server(async ({ next, request }) => {
  const result = await next();
  if (result instanceof Response) return applyCookieBudget(result, request);
  return { ...result, response: applyCookieBudget(result.response, request) };
});

export const startInstance = createStart(() => ({
  requestMiddleware: [cookieBudget],
}));

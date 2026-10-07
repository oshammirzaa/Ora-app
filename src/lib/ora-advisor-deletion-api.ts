import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { withSqlTransaction } from "@/lib/db";
import { deleteAdvisorAccountWith } from "@/lib/ora-advisor-deletion";

/** Closes only the authenticated advisor. A client-supplied user id is ignored. */
export const deleteMyAdvisorAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { acknowledged?: boolean; confirmation?: string; userId?: string }) => ({
    acknowledged: input?.acknowledged === true,
    confirmation: String(input?.confirmation || "").trim(),
  }))
  .handler(async ({ data, context }) => {
    return withSqlTransaction((sql) => deleteAdvisorAccountWith(sql, context.userId, data));
  });

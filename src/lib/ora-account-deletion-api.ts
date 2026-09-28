import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { deleteCustomerAccountWith } from "@/lib/ora-account-deletion";

/** Deletes only the authenticated session user. A client-supplied user id is ignored. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { acknowledged?: boolean; confirmation?: string; userId?: string }) => ({
    acknowledged: input?.acknowledged === true,
    confirmation: String(input?.confirmation || "").trim(),
  }))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    return deleteCustomerAccountWith(sql, context.userId, data);
  });

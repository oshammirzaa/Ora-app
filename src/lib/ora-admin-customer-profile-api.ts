import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { loadCustomerActivity, loadCustomerProfile } from "@/lib/ora-admin-customer-profile";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/ora";

function userIdOf(input?: { userId?: string; t?: number }) {
  return {
    userId: String(input?.userId || "").trim().slice(0, 128),
    t: Math.floor(Number(input?.t) || Date.now()),
  };
}

export const adminCustomerProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(userIdOf)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "customers");
    if (!data.userId) throw new Error("Choose a customer.");
    const profile = await loadCustomerProfile(await getSql(), data.userId);
    if (!profile) throw new Error("That customer was not found.");
    return profile;
  });

export const adminCustomerActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(userIdOf)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "customers");
    if (!data.userId) throw new Error("Choose a customer.");
    return loadCustomerActivity(await getSql(), data.userId);
  });

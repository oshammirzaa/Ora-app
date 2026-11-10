import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/ora";
import { loadAdminTransactionDetail, loadAdminTransactions } from "@/lib/ora-admin-transactions";

export const adminTransactions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { t?: number }) => ({
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "sessions");
    const sql = await getSql();
    return loadAdminTransactions(sql);
  });

export const adminTransactionDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { kind?: string; id?: string }) => ({
    kind: String(input?.kind || "").slice(0, 16),
    id: String(input?.id || "").slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "sessions");
    if (!data.id || (data.kind !== "chat" && data.kind !== "message" && data.kind !== "request")) {
      throw new Error("Choose a transaction.");
    }
    const sql = await getSql();
    const detail = await loadAdminTransactionDetail(sql, data.kind, data.id);
    if (!detail) throw new Error("That transaction was not found.");
    return detail;
  });

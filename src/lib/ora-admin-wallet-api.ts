import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withSqlTransaction } from "@/lib/db";
import type { CoinDirection } from "@/lib/ora-admin-coins";
import { applyAdminCoinChange, isUniqueViolation } from "@/lib/ora-admin-wallet-ops";
import { requireAdmin, rid } from "@/lib/ora";

let walletColumnsReady = false;

async function ensureWalletAuditColumns() {
  if (walletColumnsReady) return;
  const sql = await getSql();
  await sql.query("alter table ora_adjustments add column if not exists actor_id text not null default ''");
  await sql.query("alter table ora_adjustments add column if not exists previous_coins integer");
  await sql.query("alter table ora_adjustments add column if not exists next_coins integer");
  await sql.query("alter table ora_adjustments add column if not exists direction text not null default ''");
  await sql.query("alter table ora_adjustments add column if not exists idempotency_key text not null default ''");
  await sql.query(
    "create unique index if not exists ora_adjustments_idem_idx on ora_adjustments (idempotency_key) where idempotency_key <> ''",
  );
  walletColumnsReady = true;
}

export const adminCoinHistory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { userId?: string; t?: number }) => ({
    userId: String(input?.userId || "").slice(0, 128),
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "customers");
    if (!data.userId) return [];
    await ensureWalletAuditColumns();
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      actor_id: string;
      direction: string;
      coins: number;
      previous_coins: number | null;
      next_coins: number | null;
      note: string;
      created_at: string;
    }>`
      select id, coalesce(actor_id, '') as actor_id, coalesce(direction, '') as direction, coins,
             previous_coins, next_coins, note, created_at::text as created_at
      from ora_adjustments
      where user_id = ${data.userId}
      order by created_at desc
      limit 30
    `;
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id || "",
      direction: row.direction || (Number(row.coins) < 0 ? "deduct" : "add"),
      coins: Math.abs(Number(row.coins) || 0),
      previous: row.previous_coins == null ? null : Number(row.previous_coins),
      next: row.next_coins == null ? null : Number(row.next_coins),
      reason: row.note || "",
      at: String(row.created_at || ""),
    }));
  });

export const adminManageCoins = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId?: string; direction?: string; amount?: number; reason?: string; requestId?: string }) => {
    const direction = input?.direction === "deduct" ? "deduct" : input?.direction === "add" ? "add" : "";
    return {
      userId: String(input?.userId || "").slice(0, 128),
      direction: direction as CoinDirection | "",
      amount: Math.floor(Number(input?.amount) || 0),
      reason: String(input?.reason || "").trim().slice(0, 200),
      requestId: String(input?.requestId || "").trim().slice(0, 80),
    };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "customers");
    if (!data.userId) throw new Error("Choose a customer.");
    if (data.direction !== "add" && data.direction !== "deduct") throw new Error("Choose add or deduct.");
    await ensureWalletAuditColumns();
    const attempt = {
      userId: data.userId,
      actorId: context.userId,
      direction: data.direction,
      amount: data.amount,
      reason: data.reason,
      requestId: data.requestId,
      adjustmentId: rid("adj"),
      ledgerId: rid("led"),
      auditId: rid("aud"),
    };
    try {
      return await withSqlTransaction((sql) => applyAdminCoinChange(sql, attempt));
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const sql = await getSql();
      const key = `coin:${data.userId}:${data.requestId}`;
      const [existing] = await sql<{ id: string; previous_coins: number | null; next_coins: number | null; coins: number }>`
        select id, previous_coins, next_coins, coins from ora_adjustments where idempotency_key = ${key} limit 1
      `;
      if (!existing) throw err;
      return {
        ok: true as const,
        duplicate: true,
        id: existing.id,
        previous: Number(existing.previous_coins ?? 0),
        next: Number(existing.next_coins ?? 0),
        coins: Math.abs(Number(existing.coins) || 0),
      };
    }
  });

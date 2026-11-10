/** Transaction body for owner coin adjustments. Call inside one database transaction. */

import { coinIdempotencyKey, previewCoinChange, type CoinDirection } from "./ora-admin-coins.ts";

export type WalletSql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export function isUniqueViolation(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code || "") : "";
  if (code === "23505") return true;
  const message = err instanceof Error ? err.message : "";
  return /duplicate key|unique constraint/i.test(message);
}

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function applyAdminCoinChange(
  sql: WalletSql,
  input: {
    userId: string;
    actorId: string;
    direction: CoinDirection;
    amount: number;
    reason: string;
    requestId: string;
    adjustmentId?: string;
    ledgerId?: string;
    auditId?: string;
  },
) {
  const reason = input.reason.trim();
  if (reason.length < 4) throw new Error("Add a reason for this adjustment.");
  const key = coinIdempotencyKey(input.userId, input.requestId);
  const [existing] = await sql<{ id: string; previous_coins: number | null; next_coins: number | null; coins: number }>`
    select id, previous_coins, next_coins, coins
    from ora_adjustments
    where idempotency_key = ${key}
    limit 1
  `;
  if (existing) {
    return {
      ok: true as const,
      duplicate: true,
      id: existing.id,
      previous: Number(existing.previous_coins ?? 0),
      next: Number(existing.next_coins ?? 0),
      coins: Math.abs(Number(existing.coins) || 0),
    };
  }
  const [wallet] = await sql<{ coins: number; promo_coins: number }>`
    select coins, coalesce(promo_coins, 0)::int as promo_coins
    from ora_wallets
    where user_id = ${input.userId}
    for update
  `;
  if (!wallet) throw new Error("No wallet for that account.");
  const plan = previewCoinChange(Number(wallet.coins), input.direction, input.amount);
  if (plan.delta > 0) {
    const updated = await sql<{ coins: number }>`
      update ora_wallets
      set coins = coins + ${plan.coins},
          promo_coins = promo_coins + ${plan.coins}
      where user_id = ${input.userId}
      returning coins
    `;
    if (!updated.length) throw new Error("Wallet could not be updated.");
  } else {
    const fromPromo = Math.min(Number(wallet.promo_coins) || 0, plan.coins);
    const updated = await sql<{ coins: number }>`
      update ora_wallets
      set coins = coins - ${plan.coins},
          promo_coins = greatest(0, promo_coins - ${fromPromo})
      where user_id = ${input.userId} and coins >= ${plan.coins}
      returning coins
    `;
    if (!updated.length) throw new Error("Cannot deduct more than the available balance.");
  }
  const id = input.adjustmentId || nid("adj");
  await sql.query(
    `insert into ora_adjustments (
      id, user_id, reading_id, coins, kind, note, actor_id, previous_coins, next_coins, direction, idempotency_key
    ) values ($1, $2, '', $3, 'adjustment', $4, $5, $6, $7, $8, $9)`,
    [id, input.userId, plan.delta, reason, input.actorId, plan.previous, plan.next, plan.direction, key],
  );
  await sql.query(
    `insert into ora_ledger (id, user_id, kind, amount_coins, seconds, note, ref_id)
     values ($1, $2, 'adjustment', $3, 0, $4, $5)`,
    [input.ledgerId || nid("led"), input.userId, plan.delta, reason, id],
  );
  await sql.query(
    `insert into ora_owner_log (id, actor_id, act, target_type, target_id, body)
     values ($1, $2, $3, 'wallet', $4, $5)`,
    [
      input.auditId || nid("aud"),
      input.actorId,
      plan.direction === "add" ? "coins_add" : "coins_deduct",
      input.userId,
      `${plan.previous} → ${plan.next} · ${reason}`,
    ],
  );
  return { ok: true as const, duplicate: false, id, previous: plan.previous, next: plan.next, coins: plan.coins };
}

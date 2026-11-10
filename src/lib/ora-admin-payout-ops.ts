/** Transaction bodies for admin payout reserve, confirm, and release. */

import {
  CENTS_PER_COIN,
  payableCoinCap,
  planPayoutConfirm,
  planPayoutRelease,
  planPayoutReserve,
} from "./ora-admin-payouts.ts";
import type { WalletSql } from "./ora-admin-wallet-ops.ts";

export function payoutRequestKey(advisorId: string, requestId: string, verb: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) throw new Error("Payout could not be started. Try again.");
  return `payout:${verb}:${advisorId}:${requestId}`;
}

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Recorded advisor share minus payouts already marked paid. Open reservations are not subtracted here. */
export async function advisorUnpaidCents(sql: WalletSql, advisorId: string) {
  const [row] = await sql<{ unpaid: number }>`
    with reading as (
      select coalesce(sum(greatest(r.advisor_earned, 0)), 0)::int as coins
      from ora_readings r
      where r.advisor_id = ${advisorId}
        and r.status in ('ended', 'completed')
        and not exists (
          select 1 from ora_earnings e where e.reading_id = r.id and e.status = 'clawed'
        )
    ),
    message as (
      select coalesce(sum(greatest(m.advisor_share_cents, 0)), 0)::int as cents
      from ora_paid_messages m
      where m.advisor_id = ${advisorId} and m.credited = true and m.coins > 0
    ),
    tip as (
      select coalesce(sum(greatest(t.advisor_share_coins, 0)), 0)::int as coins
      from ora_customer_tips t
      where t.advisor_id = ${advisorId} and t.charged = true and t.credited = true
    ),
    paid as (
      select coalesce(sum(cents), 0)::int as cents
      from (
        select distinct on (id)
          case
            when coalesce(amount_cents, 0) > 0 then amount_cents
            else greatest(coins, 0) * 10
          end as cents
        from ora_payouts
        where advisor_id = ${advisorId} and lower(coalesce(status, '')) = 'paid'
        order by id
      ) paid_rows
    )
    select
      (select coins from reading) * 10
      + (select cents from message)
      + (select coins from tip) * 10
      - (select cents from paid) as unpaid
  `;
  return Math.floor(Number(row?.unpaid) || 0);
}

async function openRequestedCoins(sql: WalletSql, advisorId: string) {
  const [row] = await sql<{ coins: number }>`
    select coalesce(sum(coins), 0)::int as coins
    from ora_payouts
    where advisor_id = ${advisorId} and lower(coalesce(status, '')) = 'requested'
  `;
  return Math.max(0, Math.floor(Number(row?.coins) || 0));
}

async function writeLedger(
  sql: WalletSql,
  row: {
    id?: string;
    payoutId: string;
    advisorId: string;
    actorId: string;
    verb: string;
    coins: number;
    previousAvailable: number;
    nextAvailable: number;
    referenceId: string;
    note: string;
    key: string;
  },
) {
  await sql.query(
    `insert into ora_payout_ledger (
      id, payout_id, advisor_id, actor_id, verb, coins, previous_available, next_available, reference_id, note, idempotency_key
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      row.id || nid("plg"),
      row.payoutId,
      row.advisorId,
      row.actorId,
      row.verb,
      row.coins,
      row.previousAvailable,
      row.nextAvailable,
      row.referenceId,
      row.note,
      row.key,
    ],
  );
}

export async function reserveAdvisorPayout(
  sql: WalletSql,
  input: {
    advisorId: string;
    actorId: string;
    coins: number;
    method: string;
    note: string;
    requestId: string;
    currency: string;
    payoutId?: string;
    ledgerId?: string;
  },
) {
  const method = input.method.trim();
  if (method.length < 2) throw new Error("Enter the payment method used for this transfer.");
  const key = payoutRequestKey(input.advisorId, input.requestId, "reserve");
  const [dup] = await sql<{ id: string; coins: number }>`
    select id, coins from ora_payouts where idempotency_key = ${key} limit 1
  `;
  if (dup) return { ok: true as const, duplicate: true, id: dup.id, coins: Number(dup.coins) || 0, available: 0 };
  const [advisor] = await sql<{ id: string; user_id: string; payout_coins: number }>`
    select id, user_id, coalesce(payout_coins, 0)::int as payout_coins
    from ora_advisors
    where id = ${input.advisorId}
    for update
  `;
  if (!advisor) throw new Error("Advisor not found.");
  const unpaid = await advisorUnpaidCents(sql, advisor.id);
  const open = await openRequestedCoins(sql, advisor.id);
  const cap = payableCoinCap({ payoutCoins: Number(advisor.payout_coins) || 0, unpaidCents: unpaid, openCoins: open });
  const requested = Math.floor(Number(input.coins) || 0);
  if (requested > Number(advisor.payout_coins)) throw new Error("That amount is larger than the available balance.");
  if (requested > cap) throw new Error("That amount is larger than unpaid earnings still available to pay.");
  const plan = planPayoutReserve(Number(advisor.payout_coins), requested);
  const locked = await sql<{ payout_coins: number }>`
    update ora_advisors
    set payout_coins = payout_coins - ${plan.reserved}
    where id = ${advisor.id} and payout_coins >= ${plan.reserved}
    returning payout_coins
  `;
  if (!locked.length) throw new Error("That amount is larger than the available balance.");
  const id = input.payoutId || nid("pay");
  const cents = plan.reserved * CENTS_PER_COIN;
  const usd = plan.reserved / (100 / CENTS_PER_COIN);
  await sql.query(
    `insert into ora_payouts (
      id, user_id, advisor_id, coins, usd, status, currency, amount_cents, note, method, idempotency_key, workflow
    ) values ($1,$2,$3,$4,$5,'requested',$6,$7,$8,$9,$10,'pending')`,
    [id, advisor.user_id, advisor.id, plan.reserved, usd, input.currency || "USD", cents, input.note.trim(), method, key],
  );
  await writeLedger(sql, {
    id: input.ledgerId,
    payoutId: id,
    advisorId: advisor.id,
    actorId: input.actorId,
    verb: "reserve",
    coins: plan.reserved,
    previousAvailable: plan.previousAvailable,
    nextAvailable: plan.nextAvailable,
    referenceId: "",
    note: input.note.trim() || "Reserved for an external transfer. Money has not been sent by Ora.",
    key: `${key}:ledger`,
  });
  return { ok: true as const, duplicate: false, id, coins: plan.reserved, available: plan.nextAvailable };
}

export async function confirmAdvisorPayout(
  sql: WalletSql,
  input: { id: string; actorId: string; referenceId: string; note: string; requestId: string; ledgerId?: string },
) {
  const referenceId = input.referenceId.trim();
  if (referenceId.length < 2) throw new Error("Enter the external transfer reference.");
  const [row] = await sql<{ id: string; advisor_id: string; coins: number; status: string }>`
    select id, advisor_id, coins, status from ora_payouts where id = ${input.id} for update
  `;
  if (!row) throw new Error("Payout not found.");
  const key = payoutRequestKey(row.advisor_id, input.requestId, "confirm");
  const [dup] = await sql<{ id: string }>`
    select id from ora_payout_ledger where idempotency_key = ${`${key}:ledger`} limit 1
  `;
  if (dup || row.status === "paid") return { ok: true as const, duplicate: true, id: row.id, available: 0 };
  if (row.status !== "requested") throw new Error("Only a reserved payout can be marked paid.");
  const [advisor] = await sql<{ payout_coins: number }>`
    select coalesce(payout_coins, 0)::int as payout_coins from ora_advisors where id = ${row.advisor_id} for update
  `;
  const plan = planPayoutConfirm(Number(advisor?.payout_coins) || 0);
  const note = input.note.trim();
  const paid = await sql<{ id: string }>`
    update ora_payouts
    set status = 'paid',
        workflow = 'paid',
        reference_id = ${referenceId},
        note = case when ${note} <> '' then ${note} else note end,
        decided_at = now(),
        approved_at = now(),
        paid_at = now()
    where id = ${row.id} and status = 'requested'
    returning id
  `;
  if (!paid.length) throw new Error("That payout was already decided.");
  await writeLedger(sql, {
    id: input.ledgerId,
    payoutId: row.id,
    advisorId: row.advisor_id,
    actorId: input.actorId,
    verb: "paid",
    coins: Number(row.coins) || 0,
    previousAvailable: plan.previousAvailable,
    nextAvailable: plan.nextAvailable,
    referenceId,
    note: note || "Admin confirmed an external transfer. Ora did not send this money.",
    key: `${key}:ledger`,
  });
  return { ok: true as const, duplicate: false, id: row.id, available: plan.nextAvailable };
}

export async function releaseAdvisorPayout(
  sql: WalletSql,
  input: { id: string; actorId: string; note: string; requestId: string; ledgerId?: string },
) {
  const [row] = await sql<{ id: string; advisor_id: string; coins: number; status: string }>`
    select id, advisor_id, coins, status from ora_payouts where id = ${input.id} for update
  `;
  if (!row) throw new Error("Payout not found.");
  const key = payoutRequestKey(row.advisor_id, input.requestId, "release");
  const [dup] = await sql<{ id: string }>`
    select id from ora_payout_ledger where idempotency_key = ${`${key}:ledger`} limit 1
  `;
  if (dup || row.status === "failed" || row.status === "rejected") {
    return { ok: true as const, duplicate: true, id: row.id, available: 0 };
  }
  if (row.status !== "requested") throw new Error("A paid payout cannot be released.");
  const coins = Math.max(0, Math.floor(Number(row.coins) || 0));
  const [before] = await sql<{ payout_coins: number }>`
    select coalesce(payout_coins, 0)::int as payout_coins from ora_advisors where id = ${row.advisor_id} for update
  `;
  const plan = planPayoutRelease(Number(before?.payout_coins) || 0, coins);
  const [advisor] = await sql<{ payout_coins: number }>`
    update ora_advisors
    set payout_coins = payout_coins + ${coins}
    where id = ${row.advisor_id}
    returning payout_coins
  `;
  const note = input.note.trim();
  const released = await sql<{ id: string }>`
    update ora_payouts
    set status = 'failed', workflow = 'failed', note = case when ${note} <> '' then ${note} else note end, decided_at = now()
    where id = ${row.id} and status = 'requested'
    returning id
  `;
  if (!released.length) throw new Error("That payout was already decided.");
  await writeLedger(sql, {
    id: input.ledgerId,
    payoutId: row.id,
    advisorId: row.advisor_id,
    actorId: input.actorId,
    verb: "release",
    coins,
    previousAvailable: plan.previousAvailable,
    nextAvailable: Number(advisor?.payout_coins) || plan.nextAvailable,
    referenceId: "",
    note: note || "Reserved payout cancelled. Available balance restored.",
    key: `${key}:ledger`,
  });
  return { ok: true as const, duplicate: false, id: row.id, available: Number(advisor?.payout_coins) || 0 };
}

export async function markAdvisorPayoutProcessing(
  sql: WalletSql,
  input: { id: string; actorId: string; requestId: string; ledgerId?: string },
) {
  const [row] = await sql<{ id: string; advisor_id: string; coins: number; status: string; workflow: string }>`
    select id, advisor_id, coins, status, coalesce(workflow, '') as workflow
    from ora_payouts where id = ${input.id} for update
  `;
  if (!row) throw new Error("Payout not found.");
  const key = payoutRequestKey(row.advisor_id, input.requestId, "processing");
  const [dup] = await sql<{ id: string }>`
    select id from ora_payout_ledger where idempotency_key = ${`${key}:ledger`} limit 1
  `;
  if (dup || String(row.workflow) === "processing") return { ok: true as const, duplicate: true, id: row.id };
  if (row.status !== "requested") throw new Error("Only a reserved payout can move to processing.");
  const [advisor] = await sql<{ payout_coins: number }>`
    select coalesce(payout_coins, 0)::int as payout_coins from ora_advisors where id = ${row.advisor_id} for update
  `;
  const available = Number(advisor?.payout_coins) || 0;
  const moved = await sql<{ id: string }>`
    update ora_payouts set workflow = 'processing' where id = ${row.id} and status = 'requested' returning id
  `;
  if (!moved.length) throw new Error("That payout was already decided.");
  await writeLedger(sql, {
    id: input.ledgerId,
    payoutId: row.id,
    advisorId: row.advisor_id,
    actorId: input.actorId,
    verb: "processing",
    coins: Number(row.coins) || 0,
    previousAvailable: available,
    nextAvailable: available,
    referenceId: "",
    note: "Marked processing. Available balance was not changed again.",
    key: `${key}:ledger`,
  });
  return { ok: true as const, duplicate: false, id: row.id };
}

export async function saveAdvisorPayoutMethod(
  sql: WalletSql,
  input: { advisorId: string; actorId: string; method: string; holder: string; accountLabel: string; notes: string },
) {
  const method = input.method.trim().slice(0, 40);
  const holder = input.holder.trim().slice(0, 80);
  const accountLabel = input.accountLabel.trim().slice(0, 80);
  const notes = input.notes.trim().slice(0, 200);
  if (method.length < 2) throw new Error("Enter the payment method.");
  if (!holder && !accountLabel) throw new Error("Enter the account holder or an account label.");
  const [advisor] = await sql<{ id: string }>`select id from ora_advisors where id = ${input.advisorId} limit 1`;
  if (!advisor) throw new Error("Advisor not found.");
  await sql.query(
    `insert into ora_advisor_payout_methods (advisor_id, method, holder, account_label, notes, verified_by, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (advisor_id) do update
       set method = excluded.method,
           holder = excluded.holder,
           account_label = excluded.account_label,
           notes = excluded.notes,
           verified_by = excluded.verified_by,
           updated_at = now()`,
    [input.advisorId, method, holder, accountLabel, notes, input.actorId],
  );
  return { ok: true as const, method, holder, accountLabel, notes };
}

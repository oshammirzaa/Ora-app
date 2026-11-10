import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withSqlTransaction } from "@/lib/db";
import {
  confirmAdvisorPayout,
  markAdvisorPayoutProcessing,
  releaseAdvisorPayout,
  reserveAdvisorPayout,
  saveAdvisorPayoutMethod,
} from "@/lib/ora-admin-payout-ops";
import { isUniqueViolation } from "@/lib/ora-admin-wallet-ops";
import { loadSettings, requireAdmin, rid } from "@/lib/ora";

let ledgerReady = false;

async function ensurePayoutLedger() {
  if (ledgerReady) return;
  const sql = await getSql();
  await sql.query("alter table ora_payouts add column if not exists method text not null default ''");
  await sql.query("alter table ora_payouts add column if not exists reference_id text not null default ''");
  await sql.query("alter table ora_payouts add column if not exists idempotency_key text not null default ''");
  await sql.query(
    "create unique index if not exists ora_payouts_idempotency_idx on ora_payouts (idempotency_key) where idempotency_key <> ''",
  );
  await sql.query(`
    create table if not exists ora_payout_ledger (
      id text primary key,
      payout_id text not null default '',
      advisor_id text not null,
      actor_id text not null,
      verb text not null,
      coins integer not null,
      previous_available integer not null,
      next_available integer not null,
      reference_id text not null default '',
      note text not null default '',
      idempotency_key text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(
    "create unique index if not exists ora_payout_ledger_idem_idx on ora_payout_ledger (idempotency_key) where idempotency_key <> ''",
  );
  await sql.query(`
    create table if not exists ora_advisor_payout_methods (
      advisor_id text primary key,
      method text not null default '',
      holder text not null default '',
      account_label text not null default '',
      notes text not null default '',
      verified_by text not null default '',
      updated_at timestamptz not null default now()
    )
  `);
  ledgerReady = true;
}

async function replay<T>(err: unknown, load: () => Promise<T | null>) {
  if (!isUniqueViolation(err)) throw err;
  const saved = await load();
  if (!saved) throw err;
  return saved;
}

export const adminAdvisorPayDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; t?: number }) => ({
    advisorId: String(input?.advisorId || "").slice(0, 80),
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    if (!data.advisorId) throw new Error("Choose an advisor.");
    await ensurePayoutLedger();
    const sql = await getSql();
    const [advisor] = await sql<{
      id: string;
      name: string;
      status: string;
      email: string;
      payout_coins: number;
    }>`
      select id, name, status, coalesce(email, '') as email, coalesce(payout_coins, 0)::int as payout_coins
      from ora_advisors where id = ${data.advisorId}
    `;
    if (!advisor) throw new Error("Advisor not found.");
    const payouts = await sql<{
      id: string;
      coins: number;
      amount_cents: number;
      status: string;
      workflow: string;
      method: string;
      reference_id: string;
      note: string;
      created_at: string;
      paid_at: string | null;
    }>`
      select id, coins, coalesce(amount_cents, 0)::int as amount_cents, status,
             coalesce(workflow, '') as workflow, coalesce(method, '') as method,
             coalesce(reference_id, '') as reference_id, coalesce(note, '') as note,
             created_at::text as created_at, paid_at::text as paid_at
      from ora_payouts
      where advisor_id = ${data.advisorId}
      order by created_at desc
      limit 40
    `;
    const ledger = await sql<{
      id: string;
      verb: string;
      coins: number;
      previous_available: number;
      next_available: number;
      reference_id: string;
      note: string;
      created_at: string;
      actor_id: string;
    }>`
      select id, verb, coins, previous_available, next_available, reference_id, note, created_at::text as created_at, actor_id
      from ora_payout_ledger
      where advisor_id = ${data.advisorId}
      order by created_at desc
      limit 20
    `.catch(() => []);
    const [method] = await sql<{
      method: string;
      holder: string;
      account_label: string;
      notes: string;
      verified_by: string;
      updated_at: string;
    }>`
      select method, holder, account_label, notes, verified_by, updated_at::text as updated_at
      from ora_advisor_payout_methods
      where advisor_id = ${data.advisorId}
      limit 1
    `.catch(() => []);
    return {
      advisor: {
        id: advisor.id,
        name: advisor.name,
        status: advisor.status,
        email: advisor.email,
        availableCoins: Number(advisor.payout_coins) || 0,
      },
      payouts: payouts.map((row) => ({
        id: row.id,
        coins: Number(row.coins) || 0,
        cents: Number(row.amount_cents) || 0,
        status: row.status,
        workflow: row.workflow,
        method: row.method,
        referenceId: row.reference_id,
        note: row.note,
        at: String(row.created_at || ""),
        paidAt: row.paid_at ? String(row.paid_at) : "",
      })),
      ledger: ledger.map((row) => ({
        id: row.id,
        verb: row.verb,
        coins: Number(row.coins) || 0,
        previousAvailable: Number(row.previous_available) || 0,
        nextAvailable: Number(row.next_available) || 0,
        referenceId: row.reference_id || "",
        note: row.note || "",
        at: String(row.created_at || ""),
        actorId: row.actor_id || "",
      })),
      method: method
        ? {
            method: method.method || "",
            holder: method.holder || "",
            accountLabel: method.account_label || "",
            notes: method.notes || "",
            verifiedBy: method.verified_by || "",
            updatedAt: String(method.updated_at || ""),
          }
        : null,
    };
  });

export const adminReserveAdvisorPayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; coins?: number; method?: string; note?: string; requestId?: string }) => ({
    advisorId: String(input?.advisorId || "").slice(0, 80),
    coins: Math.floor(Number(input?.coins) || 0),
    method: String(input?.method || "").trim().slice(0, 40),
    note: String(input?.note || "").trim().slice(0, 200),
    requestId: String(input?.requestId || "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    if (!data.advisorId) throw new Error("Choose an advisor.");
    await ensurePayoutLedger();
    const settings = await loadSettings();
    const attempt = {
      ...data,
      actorId: context.userId,
      currency: settings.currency,
      payoutId: rid("pay"),
      ledgerId: rid("plg"),
    };
    try {
      return await withSqlTransaction((sql) => reserveAdvisorPayout(sql, attempt));
    } catch (err) {
      return replay(err, async () => {
        const sql = await getSql();
        const key = `payout:reserve:${data.advisorId}:${data.requestId}`;
        const [dup] = await sql<{ id: string; coins: number }>`
          select id, coins from ora_payouts where idempotency_key = ${key} limit 1
        `;
        return dup ? { ok: true as const, duplicate: true, id: dup.id, coins: Number(dup.coins) || 0, available: 0 } : null;
      });
    }
  });

export const adminConfirmAdvisorPayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; referenceId?: string; note?: string; requestId?: string }) => ({
    id: String(input?.id || "").slice(0, 64),
    referenceId: String(input?.referenceId || "").trim().slice(0, 80),
    note: String(input?.note || "").trim().slice(0, 200),
    requestId: String(input?.requestId || "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    if (!data.id) throw new Error("Choose a payout.");
    await ensurePayoutLedger();
    try {
      return await withSqlTransaction((sql) =>
        confirmAdvisorPayout(sql, { ...data, actorId: context.userId, ledgerId: rid("plg") }),
      );
    } catch (err) {
      return replay(err, async () => ({ ok: true as const, duplicate: true, id: data.id, available: 0 }));
    }
  });

export const adminReleaseAdvisorPayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; note?: string; requestId?: string }) => ({
    id: String(input?.id || "").slice(0, 64),
    note: String(input?.note || "").trim().slice(0, 200),
    requestId: String(input?.requestId || "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    if (!data.id) throw new Error("Choose a payout.");
    await ensurePayoutLedger();
    try {
      return await withSqlTransaction((sql) =>
        releaseAdvisorPayout(sql, { ...data, actorId: context.userId, ledgerId: rid("plg") }),
      );
    } catch (err) {
      return replay(err, async () => ({ ok: true as const, duplicate: true, id: data.id, available: 0 }));
    }
  });

export const adminProcessAdvisorPayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; requestId?: string }) => ({
    id: String(input?.id || "").slice(0, 64),
    requestId: String(input?.requestId || "").trim().slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    if (!data.id) throw new Error("Choose a payout.");
    await ensurePayoutLedger();
    try {
      return await withSqlTransaction((sql) =>
        markAdvisorPayoutProcessing(sql, { ...data, actorId: context.userId, ledgerId: rid("plg") }),
      );
    } catch (err) {
      return replay(err, async () => ({ ok: true as const, duplicate: true, id: data.id }));
    }
  });

export const adminSaveAdvisorPayoutMethod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; method?: string; holder?: string; accountLabel?: string; notes?: string }) => ({
    advisorId: String(input?.advisorId || "").slice(0, 80),
    method: String(input?.method || "").trim().slice(0, 40),
    holder: String(input?.holder || "").trim().slice(0, 80),
    accountLabel: String(input?.accountLabel || "").trim().slice(0, 80),
    notes: String(input?.notes || "").trim().slice(0, 200),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "payouts");
    if (!data.advisorId) throw new Error("Choose an advisor.");
    await ensurePayoutLedger();
    return withSqlTransaction((sql) => saveAdvisorPayoutMethod(sql, { ...data, actorId: context.userId }));
  });

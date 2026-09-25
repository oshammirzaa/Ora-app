import { getSql } from "@/lib/db";
import { env } from "@/lib/env.server";
import {
  addLedger,
  assertActive,
  authName,
  COINS_PER_DOLLAR,
  ensureAccount,
  formatMoney,
  loadSettings,
  rid,
} from "@/lib/ora";
import { coinPackCatalog, verifiedPurchaseCoins } from "@/lib/ora-coin-packs";

function stripeSecret() {
  return env("STRIPE_SECRET_KEY");
}

export function stripeWebhookSecret() {
  return env("STRIPE_WEBHOOK_SECRET");
}

type CoinPack = {
  id: string;
  name: string;
  coins: number;
  amountCents: number;
  currency: string;
  active: boolean;
  sortOrder: number;
};

type PaymentRow = {
  id: string;
  packId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
  currency: string;
  coins: number;
  status: string;
  paidAt: string;
  createdAt: string;
  returnTo: string;
};

const CANONICAL_PACKS = coinPackCatalog(COINS_PER_DOLLAR);

function mapPack(r: {
  id: string;
  name: string;
  coins: number;
  amount_cents: number;
  currency: string;
  active: boolean;
  sort_order: number;
}): CoinPack {
  return {
    id: r.id,
    name: r.name,
    coins: Number(r.coins),
    amountCents: Number(r.amount_cents),
    currency: r.currency || "USD",
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
  };
}

function mapPayment(r: {
  id: string;
  pack_id: string;
  provider: string;
  provider_ref: string;
  amount_cents: number;
  currency: string;
  coins: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  return_to?: string;
}): PaymentRow {
  return {
    id: r.id,
    packId: r.pack_id,
    provider: r.provider,
    providerRef: r.provider_ref,
    amountCents: Number(r.amount_cents),
    currency: r.currency,
    coins: Number(r.coins),
    status: r.status,
    paidAt: r.paid_at ? String(r.paid_at) : "",
    createdAt: String(r.created_at),
    returnTo: r.return_to || "",
  };
}

async function ensureCanonicalPacks() {
  const sql = await getSql();
  for (const p of CANONICAL_PACKS) {
    await sql`
      insert into ora_coin_packs (id, name, coins, amount_cents, currency, active, sort_order)
      values (${p.id}, ${p.name}, ${p.coins}, ${p.amountCents}, 'USD', true, ${p.sortOrder})
      on conflict (id) do update
        set name = excluded.name,
            coins = excluded.coins,
            amount_cents = excluded.amount_cents,
            active = true,
            sort_order = excluded.sort_order
    `;
  }
  const keep = [...CANONICAL_PACKS.map((pack) => pack.id), "membership", "membership-mini"];
  const list = keep.map((id) => `'${id.replace(/'/g, "")}'`).join(", ");
  await sql.query(`update ora_coin_packs set active = false where id not in (${list})`);
}

export async function loadPacks(activeOnly = true): Promise<CoinPack[]> {
  try {
    await ensureCanonicalPacks();
    const sql = await getSql();
    const rows = activeOnly
      ? await sql<{
          id: string;
          name: string;
          coins: number;
          amount_cents: number;
          currency: string;
          active: boolean;
          sort_order: number;
        }>`
          select id, name, coins, amount_cents, currency, active, sort_order
          from ora_coin_packs where active = true order by sort_order asc, coins asc
        `
      : await sql<{
          id: string;
          name: string;
          coins: number;
          amount_cents: number;
          currency: string;
          active: boolean;
          sort_order: number;
        }>`
          select id, name, coins, amount_cents, currency, active, sort_order
          from ora_coin_packs order by sort_order asc, coins asc
        `;
    if (rows.length) return rows.map(mapPack);
  } catch {
    /* fallback */
  }
  return CANONICAL_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    coins: p.coins,
    amountCents: p.amountCents,
    currency: "USD",
    active: true,
    sortOrder: p.sortOrder,
  }));
}

async function stripeFetch(path: string, method: "GET" | "POST", body?: URLSearchParams) {
  const key = stripeSecret();
  if (!key) throw new Error("Card checkout is not configured.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as {
    error?: { message?: string };
    id?: string;
    url?: string;
    payment_status?: string;
    payment_intent?: string;
  };
  if (!res.ok) throw new Error(json.error?.message || "Payment provider error.");
  return json;
}

export async function fulfillPayment(paymentId: string): Promise<{ credited: boolean; status: string; coins: number }> {
  const sql = await getSql();
  const [row] = await sql<{
    id: string;
    user_id: string;
    coins: number;
    amount_cents: number;
    currency: string;
    status: string;
    pack_id: string;
  }>`
    select id, user_id, coins, amount_cents, currency, status, pack_id from ora_payments where id = ${paymentId}
  `;
  if (!row) return { credited: false, status: "missing", coins: 0 };
  if (row.status === "refunded" || row.status === "failed" || row.status === "cancelled") {
    return { credited: false, status: row.status, coins: Number(row.coins) || 0 };
  }

  const { planByPackId, activateMembershipFromPayment } = await import("@/lib/ora-membership");
  const membership = planByPackId(row.pack_id);
  const catalogCoins = verifiedPurchaseCoins(row.pack_id, Number(row.amount_cents), COINS_PER_DOLLAR);
  let coins = catalogCoins ?? 0;
  if (catalogCoins == null) {
    if (!membership || membership.amountCents !== Number(row.amount_cents)) {
      return { credited: false, status: "unverified", coins: 0 };
    }
    coins = membership.coins;
  }

  const [dup] = await sql<{ id: string }>`
    select id from ora_ledger where kind = 'purchase' and ref_id = ${row.id} limit 1
  `;
  if (dup) {
    await sql`
      update ora_payments
      set status = 'succeeded', paid_at = coalesce(paid_at, now()), updated_at = now(), coins = ${coins}
      where id = ${row.id} and status in ('created', 'pending', 'succeeded')
    `;
    if (membership) await activateMembershipFromPayment(row.user_id, row.id, row.pack_id);
    return { credited: false, status: "succeeded", coins };
  }

  if (coins > 0) {
    try {
      await addLedger(
        row.user_id,
        "purchase",
        coins,
        0,
        `Purchase · ${coins}c · ${formatMoney(Number(row.amount_cents), row.currency)} · ${row.id}`,
        row.id,
      );
      await sql`
        update ora_wallets set coins = coins + ${coins} where user_id = ${row.user_id}
      `;
    } catch {
      const [again] = await sql<{ id: string }>`
        select id from ora_ledger where kind = 'purchase' and ref_id = ${row.id} limit 1
      `;
      if (!again) throw new Error("Could not credit wallet.");
      await sql`
        update ora_payments
        set status = 'succeeded', paid_at = coalesce(paid_at, now()), updated_at = now()
        where id = ${row.id} and status in ('created', 'pending', 'succeeded')
      `;
      return { credited: false, status: "succeeded", coins };
    }
  }

  if (row.pack_id === "membership" || row.pack_id === "membership-mini") {
    const { activateMembershipFromPayment } = await import("@/lib/ora-membership");
    await activateMembershipFromPayment(row.user_id, row.id, row.pack_id);
  }

  await sql`
    update ora_payments
    set status = 'succeeded', coins = ${coins}, paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = ${row.id} and status in ('created', 'pending', 'succeeded')
  `;
  return { credited: true, status: "succeeded", coins };
}

export async function markPayment(id: string, status: "failed" | "cancelled" | "pending") {
  const sql = await getSql();
  await sql`
    update ora_payments set status = ${status}, updated_at = now()
    where id = ${id} and status in ('created', 'pending')
  `;
}

export async function refundPaymentRecord(paymentId: string, actorId: string) {
  const sql = await getSql();
  const [row] = await sql<{
    id: string;
    user_id: string;
    coins: number;
    status: string;
    provider: string;
    provider_ref: string;
  }>`
    select id, user_id, coins, status, provider, provider_ref from ora_payments where id = ${paymentId}
  `;
  if (!row) throw new Error("Payment not found.");
  if (row.status === "refunded") return { ok: true as const, already: true };
  if (row.status !== "succeeded") throw new Error("Only successful payments can be refunded.");

  const coins = Number(row.coins);
  const [w] = await sql<{ coins: number; promo_coins: number }>`
    select coins, promo_coins from ora_wallets where user_id = ${row.user_id}
  `;
  if (!w) throw new Error("No wallet.");
  if (Number(w.coins) < coins) throw new Error("Wallet no longer holds the purchased coins.");

  const moved = await sql<{ id: string }>`
    update ora_payments set status = 'refunded', updated_at = now()
    where id = ${row.id} and status = 'succeeded'
    returning id
  `;
  if (!moved.length) return { ok: true as const, already: true };

  const promo = Number(w.promo_coins);
  const purchased = Math.max(0, Number(w.coins) - promo);
  const fromPurchased = Math.min(purchased, coins);
  const fromPromo = coins - fromPurchased;
  await sql`
    update ora_wallets
    set coins = coins - ${coins},
        promo_coins = greatest(0, promo_coins - ${fromPromo})
    where user_id = ${row.user_id} and coins >= ${coins}
  `;
  await addLedger(row.user_id, "refund", -coins, 0, `Refund · ${coins}c`, row.id);

  const stripeKey = stripeSecret();
  if (row.provider === "stripe" && stripeKey && row.provider_ref) {
    try {
      const session = await stripeFetch(`checkout/sessions/${encodeURIComponent(row.provider_ref)}`, "GET");
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : "";
      if (intent) {
        const body = new URLSearchParams();
        body.set("payment_intent", intent);
        await stripeFetch("refunds", "POST", body);
      }
    } catch (e) {
      console.error("[ora] stripe refund", e);
    }
  }
  return { ok: true as const, already: false, actorId };
}

export async function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  if (!rawBody || !header || !secret) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const idx = piece.indexOf("=");
    if (idx < 0) continue;
    parts[piece.slice(0, idx).trim()] = piece.slice(idx + 1).trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function handleStripeEvent(event: {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}) {
  const eventId = String(event.id || "");
  const type = String(event.type || "");
  if (!eventId || !type) return { ok: false as const };
  const sql = await getSql();
  const [seen] = await sql<{ id: string }>`select id from ora_webhook_events where id = ${eventId} limit 1`;
  if (seen) return { ok: true as const, duplicate: true };

  const obj = event.data?.object ?? {};
  const paymentId = String((obj.metadata as { payment_id?: string } | undefined)?.payment_id || obj.client_reference_id || "");
  const sessionId = String(obj.id || "");
  let payId = paymentId;
  if (!payId && sessionId) {
    const [found] = await sql<{ id: string }>`
      select id from ora_payments where provider_ref = ${sessionId} limit 1
    `;
    payId = found?.id || "";
  }

  if (type === "checkout.session.completed" && payId) {
    const paid = String(obj.payment_status || "") === "paid" || String(obj.payment_status || "") === "no_payment_required";
    if (paid || obj.status === "complete") {
      const charged = Number(obj.amount_total);
      const [pay] = await sql<{ amount_cents: number; status: string }>`
        select amount_cents, status from ora_payments where id = ${payId} limit 1
      `;
      if (pay && Number.isFinite(charged) && charged > 0 && Number(pay.amount_cents) !== charged) {
        await markPayment(payId, "failed");
      } else {
        await fulfillPayment(payId);
      }
    }
  } else if (type === "checkout.session.expired" && payId) {
    await markPayment(payId, "cancelled");
  } else if (type === "payment_intent.payment_failed" && payId) {
    await markPayment(payId, "failed");
  } else if ((type === "charge.refunded" || type === "charge.dispute.created") && payId) {
    try {
      await refundPaymentRecord(payId, "stripe");
    } catch (e) {
      console.error("[ora] webhook refund", e);
    }
  }

  await sql`
    insert into ora_webhook_events (id, provider, type, payment_id)
    values (${eventId}, 'stripe', ${type}, ${payId})
    on conflict (id) do nothing
  `;
  return { ok: true as const, duplicate: false };
}

export async function getPaymentConfig() {
  const settings = await loadSettings();
  return {
    currency: settings.currency,
    stripeEnabled: Boolean(stripeSecret()),
    packs: await loadPacks(true),
  };
}

export async function startCheckoutForUser(
  userId: string,
  data: { packId: string; returnTo: string; origin: string },
) {
  await ensureAccount(userId, await authName(userId));
  await assertActive(userId);
  const { planByPackId, packFromPlan, assertNoLiveMembership } = await import("@/lib/ora-membership");
  const membershipPlan = planByPackId(data.packId);
  if (membershipPlan) await assertNoLiveMembership(userId);
  const packs = await loadPacks(true);
  const pack = membershipPlan ? packFromPlan(membershipPlan) : packs.find((p) => p.id === data.packId);
  if (!pack) throw new Error("That package is not available.");
  const settings = await loadSettings();
  const currency = (pack.currency || settings.currency || "USD").toLowerCase();
  const sql = await getSql();
  const [open] = await sql<{
    id: string;
    pack_id: string;
    provider: string;
    provider_ref: string;
    amount_cents: number;
    currency: string;
    coins: number;
    status: string;
    paid_at: string | null;
    created_at: string;
    return_to: string;
  }>`
    select id, pack_id, provider, provider_ref, amount_cents, currency, coins, status, paid_at, created_at, return_to
    from ora_payments
    where user_id = ${userId} and pack_id = ${pack.id}
      and status in ('created', 'pending')
      and created_at > now() - interval '30 minutes'
    order by created_at desc
    limit 1
  `;
  const provider = stripeSecret() ? "stripe" : "sandbox";
  const paymentId = open?.id || rid("pay");
  if (!open) {
    const idem = `chk_${userId}_${pack.id}_${paymentId}`;
    await sql`
      insert into ora_payments (
        id, user_id, pack_id, provider, amount_cents, currency, coins, status, idempotency_key, return_to
      ) values (
        ${paymentId}, ${userId}, ${pack.id}, ${provider}, ${pack.amountCents}, ${pack.currency || settings.currency},
        ${pack.coins}, 'created', ${idem}, ${data.returnTo}
      )
    `;
  } else {
    await sql`update ora_payments set return_to = ${data.returnTo}, updated_at = now() where id = ${open.id}`;
  }

  if (provider === "stripe") {
    const origin = data.origin;
    if (!origin) throw new Error("Missing checkout origin.");
    const member = Boolean(membershipPlan);
    const dest = member ? "/membership" : "/account";
    const success = `${origin}${dest}?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = `${origin}${dest}?pay=${encodeURIComponent(paymentId)}`;
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", success);
    body.set("cancel_url", cancel);
    body.set("client_reference_id", paymentId);
    body.set("metadata[payment_id]", paymentId);
    body.set("metadata[user_id]", userId);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", currency);
    body.set("line_items[0][price_data][unit_amount]", String(pack.amountCents));
    body.set("line_items[0][price_data][product_data][name]", member ? pack.name : `${pack.coins} Ora coins`);
    body.set("line_items[0][price_data][product_data][description]", pack.name);
    const session = await stripeFetch("checkout/sessions", "POST", body);
    const ref = String(session.id || "");
    if (ref) {
      await sql`
        update ora_payments set provider_ref = ${ref}, status = 'pending', updated_at = now()
        where id = ${paymentId}
      `;
    }
    if (!session.url) throw new Error("Checkout did not return a URL.");
    return { paymentId, url: session.url, provider: "stripe" as const };
  }

  await sql`
    update ora_payments set status = 'pending', updated_at = now()
    where id = ${paymentId} and status = 'created'
  `;
  return { paymentId, url: `${membershipPlan ? "/membership" : "/account"}?pay=${encodeURIComponent(paymentId)}`, provider: "sandbox" as const };
}

export async function getOwnedPayment(userId: string, id: string) {
  const sql = await getSql();
  const [row] = await sql<{
    id: string;
    pack_id: string;
    provider: string;
    provider_ref: string;
    amount_cents: number;
    currency: string;
    coins: number;
    status: string;
    paid_at: string | null;
    created_at: string;
    return_to: string;
  }>`
    select id, pack_id, provider, provider_ref, amount_cents, currency, coins, status, paid_at, created_at, return_to
    from ora_payments where id = ${id} and user_id = ${userId}
  `;
  if (!row) return null;
  const { planByPackId, packFromPlan } = await import("@/lib/ora-membership");
  const membershipPlan = planByPackId(row.pack_id);
  if (membershipPlan) return { payment: mapPayment(row), pack: packFromPlan(membershipPlan) };
  const packs = await loadPacks(false);
  const pack = packs.find((p) => p.id === row.pack_id) ?? null;
  return { payment: mapPayment(row), pack };
}

export async function confirmSandboxForUser(userId: string, id: string) {
  await assertActive(userId);
  const sql = await getSql();
  const [row] = await sql<{ id: string; status: string; provider: string; coins: number }>`
    select id, status, provider, coins from ora_payments
    where id = ${id} and user_id = ${userId}
  `;
  if (!row) throw new Error("Payment not found.");
  if (row.provider !== "sandbox") throw new Error("This payment is with the card processor.");
  if (row.status === "succeeded") {
    return { status: "succeeded" as const, credited: false, coins: Number(row.coins), paymentId: row.id };
  }
  if (row.status !== "created" && row.status !== "pending") throw new Error("This payment cannot be completed.");
  const claimed = await sql<{ id: string }>`
    update ora_payments set status = 'pending', updated_at = now()
    where id = ${row.id} and status in ('created', 'pending')
    returning id
  `;
  if (!claimed.length) {
    const [again] = await sql<{ status: string; coins: number }>`
      select status, coins from ora_payments where id = ${row.id}
    `;
    if (again?.status === "succeeded") {
      return { status: "succeeded" as const, credited: false, coins: Number(again.coins), paymentId: row.id };
    }
    throw new Error("This payment already moved.");
  }
  const result = await fulfillPayment(row.id);
  return {
    status: result.status,
    credited: result.credited,
    coins: result.coins,
    paymentId: row.id,
  };
}

export async function failSandboxForUser(userId: string, id: string) {
  await assertActive(userId);
  const sql = await getSql();
  const [row] = await sql<{ id: string; status: string; provider: string }>`
    select id, status, provider from ora_payments
    where id = ${id} and user_id = ${userId}
  `;
  if (!row) throw new Error("Payment not found.");
  if (row.provider !== "sandbox") throw new Error("This payment is with the card processor.");
  if (row.status === "succeeded") throw new Error("This payment already completed.");
  if (row.status === "failed") return { status: "failed" as const };
  await markPayment(row.id, "failed");
  return { status: "failed" as const };
}

export async function cancelOwnedPayment(userId: string, id: string) {
  const sql = await getSql();
  await sql`
    update ora_payments set status = 'cancelled', updated_at = now()
    where id = ${id} and user_id = ${userId} and status in ('created', 'pending')
  `;
  return { ok: true };
}

export async function confirmStripeSessionForUser(userId: string, sessionId: string) {
  if (!sessionId.startsWith("cs_")) throw new Error("Invalid checkout session.");
  const session = await stripeFetch(`checkout/sessions/${encodeURIComponent(sessionId)}`, "GET");
  const meta = (session as { metadata?: { payment_id?: string; user_id?: string }; client_reference_id?: string; payment_status?: string }).metadata;
  const paymentId = String(meta?.payment_id || (session as { client_reference_id?: string }).client_reference_id || "");
  if (!paymentId) throw new Error("Session is missing a payment.");
  const sql = await getSql();
  const [row] = await sql<{ id: string; user_id: string }>`
    select id, user_id from ora_payments where id = ${paymentId}
  `;
  if (!row || row.user_id !== userId) throw new Error("Payment does not match this account.");
  await sql`
    update ora_payments set provider_ref = ${sessionId}, updated_at = now()
    where id = ${row.id} and (provider_ref = '' or provider_ref = ${sessionId})
  `;
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!paid) return { status: "pending" as const, paymentId: row.id };
  const result = await fulfillPayment(row.id);
  return { status: result.status as "succeeded" | string, paymentId: row.id };
}

export async function listOwnedPayments(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    pack_id: string;
    provider: string;
    provider_ref: string;
    amount_cents: number;
    currency: string;
    coins: number;
    status: string;
    paid_at: string | null;
    created_at: string;
    return_to: string;
  }>`
    select id, pack_id, provider, provider_ref, amount_cents, currency, coins, status, paid_at, created_at, return_to
    from ora_payments where user_id = ${userId}
    order by created_at desc
    limit 40
  `;
  return rows.map(mapPayment);
}

export async function loadUserPayments(userId: string) {
  return listOwnedPayments(userId);
}

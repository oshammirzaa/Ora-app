import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { addLedger, assertActive, ensureAccount, loadSettings, rid } from "@/lib/ora";
import { ensureChatMediaColumns } from "@/lib/ora-chat-media";
import { tipGift, tipMessageBody, tipSplit, emptyTipEarnings, summarizeTips, type TipEarningRow } from "@/lib/ora-tips";

let schemaReady = false;

export async function ensureTipSchema() {
  if (schemaReady) return;
  const sql = await getSql();
  await ensureChatMediaColumns();
  const statements = [
    `create table if not exists ora_customer_tips (
  id text primary key,
  request_id text not null,
  customer_id text not null,
  advisor_id text not null,
  gift text not null,
  coins integer not null,
  advisor_share_coins integer not null,
  ora_share_coins integer not null,
  charged boolean not null default false,
  credited boolean not null default false,
  surface text not null,
  thread_id text,
  reading_id text,
  message_id text,
  created_at timestamptz not null default now()
)`,
    "create unique index if not exists ora_customer_tips_request_idx on ora_customer_tips (request_id)",
    "create index if not exists ora_customer_tips_advisor_idx on ora_customer_tips (advisor_id, created_at desc)",
    "alter table ora_messages add column if not exists tip_gift text",
    "alter table ora_advisor_inbox_messages add column if not exists tip_gift text",
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] tip schema", err);
    }
  }
  schemaReady = true;
}

function clip(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

type TipRow = {
  id: string;
  request_id: string;
  customer_id: string;
  advisor_id: string;
  gift: string;
  coins: number;
  advisor_share_coins: number;
  ora_share_coins: number;
  charged: boolean;
  credited: boolean;
  surface: string;
  thread_id: string | null;
  reading_id: string | null;
  message_id: string | null;
};

async function walletCoins(userId: string) {
  const sql = await getSql();
  const [row] = await sql<{ coins: number }>`
    select coalesce(coins, 0)::int as coins from ora_wallets where user_id = ${userId}
  `;
  return Number(row?.coins) || 0;
}

async function loadTip(requestId: string) {
  const sql = await getSql();
  const [row] = await sql<TipRow>`
    select id, request_id, customer_id, advisor_id, gift, coins,
           advisor_share_coins, ora_share_coins, charged, credited, surface,
           thread_id, reading_id, message_id
    from ora_customer_tips
    where request_id = ${requestId}
    limit 1
  `;
  return row || null;
}

async function openInbox(advisorId: string, customerId: string) {
  const sql = await getSql();
  const [existing] = await sql<{ id: string }>`
    select id from ora_advisor_inbox where advisor_id = ${advisorId} and customer_id = ${customerId}
  `;
  if (existing?.id) return existing.id;
  const id = rid("th");
  try {
    await sql`
      insert into ora_advisor_inbox (id, advisor_id, customer_id, last_body, last_role, last_at)
      values (${id}, ${advisorId}, ${customerId}, '', 'customer', now())
    `;
    return id;
  } catch {
    const [again] = await sql<{ id: string }>`
      select id from ora_advisor_inbox where advisor_id = ${advisorId} and customer_id = ${customerId}
    `;
    if (again?.id) return again.id;
    throw new Error("Could not open conversation.");
  }
}

async function placeTipMessage(row: TipRow) {
  if (row.message_id) return row.message_id;
  const sql = await getSql();
  const gift = tipGift(row.gift);
  const body = tipMessageBody(row.gift);
  const messageId = rid("tipm");
  if (row.surface === "reading" && row.reading_id) {
    await sql`
      insert into ora_messages (id, reading_id, role, body, tip_gift)
      values (${messageId}, ${row.reading_id}, 'client', ${body}, ${gift?.id || row.gift})
    `;
  } else if (row.thread_id) {
    const requestKey = `tip:${row.request_id}`;
    try {
      await sql`
        insert into ora_advisor_inbox_messages (
          id, thread_id, advisor_id, customer_id, role, body, kind, request_id, tip_gift
        ) values (
          ${messageId}, ${row.thread_id}, ${row.advisor_id}, ${row.customer_id}, 'customer', ${body},
          'tip', ${requestKey}, ${gift?.id || row.gift}
        )
      `;
    } catch {
      const [existing] = await sql<{ id: string }>`
        select id from ora_advisor_inbox_messages where request_id = ${requestKey} limit 1
      `;
      if (!existing?.id) throw new Error("Could not show this tip.");
      await sql`update ora_customer_tips set message_id = ${existing.id} where id = ${row.id}`;
      return existing.id;
    }
    await sql`
      update ora_advisor_inbox
      set last_body = ${body}, last_role = 'customer', last_at = now(), unread_advisor = unread_advisor + 1
      where id = ${row.thread_id}
    `;
  } else {
    throw new Error("Could not show this tip.");
  }
  await sql`update ora_customer_tips set message_id = ${messageId} where id = ${row.id} and message_id is null`;
  return messageId;
}

export async function loadTipEarnings(advisorId = "") {
  try {
    await ensureTipSchema();
    const sql = await getSql();
    const scope = String(advisorId || "").trim();
    const rows = scope
      ? await sql<{
          id: string;
          customer_id: string;
          customer_name: string;
          advisor_id: string;
          advisor_name: string;
          gift: string;
          coins: number;
          advisor_share_coins: number;
          ora_share_coins: number;
          created_at: string;
        }>`
          select t.id, t.customer_id, coalesce(nullif(c.display_name, ''), 'Client') as customer_name,
                 t.advisor_id, coalesce(nullif(a.name, ''), 'Advisor') as advisor_name,
                 t.gift, t.coins::int as coins, t.advisor_share_coins::int as advisor_share_coins,
                 t.ora_share_coins::int as ora_share_coins, t.created_at::text as created_at
          from ora_customer_tips t
          left join ora_profiles c on c.user_id = t.customer_id
          left join ora_advisors a on a.id = t.advisor_id
          where t.charged = true and t.advisor_id = ${scope}
          order by t.created_at desc
          limit 200
        `
      : await sql<{
          id: string;
          customer_id: string;
          customer_name: string;
          advisor_id: string;
          advisor_name: string;
          gift: string;
          coins: number;
          advisor_share_coins: number;
          ora_share_coins: number;
          created_at: string;
        }>`
          select t.id, t.customer_id, coalesce(nullif(c.display_name, ''), 'Client') as customer_name,
                 t.advisor_id, coalesce(nullif(a.name, ''), 'Advisor') as advisor_name,
                 t.gift, t.coins::int as coins, t.advisor_share_coins::int as advisor_share_coins,
                 t.ora_share_coins::int as ora_share_coins, t.created_at::text as created_at
          from ora_customer_tips t
          left join ora_profiles c on c.user_id = t.customer_id
          left join ora_advisors a on a.id = t.advisor_id
          where t.charged = true
          order by t.created_at desc
          limit 200
        `;
    return summarizeTips(
      rows.map(
        (row): TipEarningRow => ({
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name || "Client",
          advisorId: row.advisor_id,
          advisorName: row.advisor_name || "Advisor",
          gift: row.gift,
          giftName: tipGift(row.gift)?.name || row.gift,
          coins: Number(row.coins) || 0,
          advisorShare: Number(row.advisor_share_coins) || 0,
          oraShare: Number(row.ora_share_coins) || 0,
          at: row.created_at,
        }),
      ),
    );
  } catch {
    return emptyTipEarnings();
  }
}

async function creditTip(row: TipRow) {
  if (row.credited) return;
  const sql = await getSql();
  const claimed = await sql<{ advisor_share_coins: number }>`
    update ora_customer_tips
    set credited = true
    where id = ${row.id} and charged = true and credited = false
    returning advisor_share_coins
  `;
  if (!claimed.length) return;
  const share = Math.max(0, Math.floor(Number(claimed[0]?.advisor_share_coins) || 0));
  const [prior] = await sql<{ id: string }>`
    select id from ora_ledger where user_id = ${row.customer_id} and kind = 'tip' and ref_id = ${row.id} limit 1
  `.catch(() => []);
  if (!prior) {
    await addLedger(row.customer_id, "tip", -row.coins, 0, tipMessageBody(row.gift), row.id);
  }
  if (share <= 0) return;
  const settings = await loadSettings();
  if (settings.payoutHoldHours <= 0) {
    await sql`update ora_advisors set payout_coins = payout_coins + ${share} where id = ${row.advisor_id}`;
  } else {
    await sql`update ora_advisors set pending_coins = pending_coins + ${share} where id = ${row.advisor_id}`;
  }
}

async function chargeTip(row: TipRow) {
  if (row.charged) return row;
  const sql = await getSql();
  const paid = await sql<{ coins: number }>`
    update ora_wallets
    set coins = coins - ${row.coins}
    where user_id = ${row.customer_id} and coins >= ${row.coins}
    returning coins
  `;
  if (!paid.length) throw new Error("Not enough coins for this tip.");
  const claimed = await sql<{ id: string }>`
    update ora_customer_tips set charged = true where id = ${row.id} and charged = false returning id
  `;
  if (!claimed.length) {
    await sql`update ora_wallets set coins = coins + ${row.coins} where user_id = ${row.customer_id}`;
    const fresh = await loadTip(row.request_id);
    if (!fresh) throw new Error("Could not send this tip.");
    return fresh;
  }
  return { ...row, charged: true };
}

export const sendCustomerTip = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; readingId?: string; gift?: string; requestId?: string }) => ({
    advisorId: clip(input.advisorId, 80),
    readingId: clip(input.readingId, 80),
    gift: clip(input.gift, 40).toLowerCase(),
    requestId: clip(input.requestId, 80),
  }))
  .handler(async ({ context, data }) => {
    const gift = tipGift(data.gift);
    if (!gift) throw new Error("Choose a tip.");
    if (!data.requestId) throw new Error("Missing tip request.");
    const split = tipSplit(gift.coins);
    if (split.advisorShare + split.oraShare !== gift.coins) throw new Error("Tip split is invalid.");
    await ensureAccount(context.userId, "");
    await assertActive(context.userId);
    await ensureTipSchema();
    const sql = await getSql();
    const { pairIsBlocked } = await import("@/lib/ora-safety-api");

    let advisorId = "";
    let surface: "inbox" | "reading" = "inbox";
    let threadId: string | null = null;
    let readingId: string | null = null;

    if (data.readingId) {
      const [reading] = await sql<{ id: string; advisor_id: string; status: string }>`
        select id, advisor_id, status from ora_readings
        where id = ${data.readingId} and client_id = ${context.userId}
      `;
      if (!reading || reading.status !== "live") throw new Error("This reading has ended.");
      advisorId = reading.advisor_id;
      surface = "reading";
      readingId = reading.id;
    } else if (data.advisorId) {
      const [advisor] = await sql<{ id: string }>`
        select id from ora_advisors where (id = ${data.advisorId} or slug = ${data.advisorId}) and status = 'live'
      `;
      if (!advisor) throw new Error("That advisor is not on the floor.");
      advisorId = advisor.id;
      surface = "inbox";
      threadId = await openInbox(advisor.id, context.userId);
    } else {
      throw new Error("Choose an advisor.");
    }

    if (await pairIsBlocked(advisorId, context.userId)) throw new Error("This conversation is unavailable.");

    const inserted = await sql<{ id: string }>`
      insert into ora_customer_tips (
        id, request_id, customer_id, advisor_id, gift, coins,
        advisor_share_coins, ora_share_coins, surface, thread_id, reading_id
      ) values (
        ${rid("tip")}, ${data.requestId}, ${context.userId}, ${advisorId}, ${gift.id}, ${gift.coins},
        ${split.advisorShare}, ${split.oraShare}, ${surface}, ${threadId}, ${readingId}
      )
      on conflict (request_id) do nothing
      returning id
    `;

    let row = await loadTip(data.requestId);
    if (!row || row.customer_id !== context.userId) throw new Error("Could not send this tip.");
    if (!inserted.length && row.advisor_id !== advisorId) throw new Error("Could not send this tip.");

    const duplicate = !inserted.length && row.charged && row.credited && Boolean(row.message_id);
    if (!duplicate) {
      row = await chargeTip(row);
      await creditTip(row);
      row = (await loadTip(data.requestId)) || row;
      if (!row.message_id) {
        const messageId = await placeTipMessage(row);
        row = { ...row, message_id: messageId };
      }
    }

    const fresh = await loadTip(data.requestId);
    const sent = tipGift(fresh?.gift || gift.id) || gift;
    return {
      ok: true as const,
      duplicate,
      gift: sent.id,
      name: sent.name,
      coins: sent.coins,
      advisorShare: Number(fresh?.advisor_share_coins) || split.advisorShare,
      oraShare: Number(fresh?.ora_share_coins) || split.oraShare,
      messageId: fresh?.message_id || row.message_id || "",
      wallet: await walletCoins(context.userId),
    };
  });

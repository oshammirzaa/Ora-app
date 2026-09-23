import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { addLedger, assertActive, ensureAccount, loadSettings, rid } from "@/lib/ora";
import { ensureAdvisorDeskTables } from "@/lib/ora-advisor-desk";
import {
  LIFETIME_FREE_CUSTOMER_MESSAGES,
  PAID_CUSTOMER_MESSAGE_COINS,
  canChargePaidMessage,
  customerMessageNotice,
  customerMessageQuote,
  needsFirstPaidConfirm,
  paidMessageSplit,
  remainingFreeCustomerMessages,
} from "@/lib/ora-paid-messages";
import { displayChatImage, messagePreview, sanitizeChatImage } from "@/lib/ora-message-media";
import { ensureChatMediaColumns } from "@/lib/ora-chat-media";
import { parseChatMessageBody } from "@/lib/ora-chat-words";

let schemaReady = false;

export async function ensurePaidMessageSchema() {
  if (schemaReady) return;
  const sql = await getSql();
  await ensureAdvisorDeskTables();
  const statements = [
    `create table if not exists ora_customer_message_allowance (
  customer_id text not null,
  advisor_id text not null,
  free_used integer not null default 0,
  paid_sent integer not null default 0,
  paid_notice_seen boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (customer_id, advisor_id)
)`,
    `create table if not exists ora_paid_messages (
  id text primary key,
  message_id text not null unique,
  request_id text not null unique,
  customer_id text not null,
  advisor_id text not null,
  thread_id text not null,
  coins integer not null,
  amount_cents integer not null,
  advisor_share_coins integer not null,
  ora_share_coins integer not null,
  advisor_share_cents integer not null,
  ora_share_cents integer not null,
  created_at timestamptz not null default now()
)`,
    "create index if not exists ora_paid_messages_advisor_idx on ora_paid_messages (advisor_id, created_at desc)",
    "create index if not exists ora_paid_messages_customer_idx on ora_paid_messages (customer_id, created_at desc)",
    "alter table ora_paid_messages add column if not exists credited boolean not null default true",
    "alter table ora_advisors add column if not exists message_earn_cents integer not null default 0",
    "alter table ora_advisor_inbox_messages add column if not exists request_id text",
    `create unique index if not exists ora_inbox_msg_request_idx
  on ora_advisor_inbox_messages (request_id) where request_id is not null`,
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] paid message schema", err);
    }
  }
  schemaReady = true;
}

function clip(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

async function loadAdvisor(id: string) {
  const sql = await getSql();
  const [row] = await sql<{
    id: string;
    name: string;
    slug: string;
    photo_url: string | null;
    status: string;
  }>`
    select id, name, slug, photo_url, status
    from ora_advisors
    where (id = ${id} or slug = ${id}) and status = 'live'
  `;
  return row || null;
}

async function loadOrCreateThread(advisorId: string, customerId: string) {
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

async function loadAllowance(customerId: string, advisorId: string) {
  const sql = await getSql();
  await sql`
    insert into ora_customer_message_allowance (customer_id, advisor_id, free_used, paid_sent, paid_notice_seen)
    values (${customerId}, ${advisorId}, 0, 0, false)
    on conflict (customer_id, advisor_id) do nothing
  `;
  const [row] = await sql<{
    free_used: number;
    paid_sent: number;
    paid_notice_seen: boolean;
  }>`
    select free_used, paid_sent, paid_notice_seen
    from ora_customer_message_allowance
    where customer_id = ${customerId} and advisor_id = ${advisorId}
  `;
  return {
    freeUsed: Number(row?.free_used) || 0,
    paidSent: Number(row?.paid_sent) || 0,
    paidNoticeSeen: Boolean(row?.paid_notice_seen),
  };
}

async function walletCoins(userId: string) {
  const sql = await getSql();
  const [row] = await sql<{ coins: number }>`
    select coalesce(coins, 0)::int as coins from ora_wallets where user_id = ${userId}
  `;
  return Number(row?.coins) || 0;
}

async function isBlocked(advisorId: string, customerId: string) {
  const { pairIsBlocked } = await import("@/lib/ora-safety-api");
  return pairIsBlocked(advisorId, customerId);
}

function allowanceView(input: { freeUsed: number; paidNoticeSeen: boolean; wallet: number }) {
  const quote = customerMessageQuote(input.freeUsed);
  const remainingFree = remainingFreeCustomerMessages(input.freeUsed);
  const notice = customerMessageNotice(remainingFree);
  return {
    remainingFree,
    free: quote.free,
    coins: quote.coins,
    paidNoticeSeen: input.paidNoticeSeen,
    needsConfirm: needsFirstPaidConfirm({ remainingFree, paidNoticeSeen: input.paidNoticeSeen }),
    notice,
    wallet: input.wallet,
    canPay: canChargePaidMessage(input.wallet),
  };
}

async function existingByRequest(requestId: string, customerId: string, advisorId: string) {
  if (!requestId) return null;
  const sql = await getSql();
  const [row] = await sql<{
    id: string;
    body: string;
    created_at: string;
    role: string;
  }>`
    select id, body, created_at::text as created_at, role
    from ora_advisor_inbox_messages
    where request_id = ${requestId} and customer_id = ${customerId} and advisor_id = ${advisorId}
    limit 1
  `.catch(() => []);
  return row || null;
}

async function creditAdvisorPaidMessage(advisorId: string, cents: number) {
  const settings = await loadSettings();
  const sql = await getSql();
  const added = Math.max(0, Math.floor(cents) || 0);
  if (added <= 0) return;
  if (settings.payoutHoldHours <= 0) {
    await sql`
      update ora_advisors
      set payout_coins = payout_coins + ((coalesce(message_earn_cents, 0) + ${added}) / 10),
          message_earn_cents = (coalesce(message_earn_cents, 0) + ${added}) % 10
      where id = ${advisorId}
    `;
  } else {
    await sql`
      update ora_advisors
      set pending_coins = pending_coins + ((coalesce(message_earn_cents, 0) + ${added}) / 10),
          message_earn_cents = (coalesce(message_earn_cents, 0) + ${added}) % 10
      where id = ${advisorId}
    `;
  }
}

async function recordPaidMessage(input: {
  messageId: string;
  requestId: string;
  customerId: string;
  advisorId: string;
  threadId: string;
}) {
  const sql = await getSql();
  const coins = PAID_CUSTOMER_MESSAGE_COINS;
  const split = paidMessageSplit(coins);
  if (split.amountCents <= 0 || split.advisorShareCents + split.oraShareCents !== split.amountCents) return;
  const amountCents = split.amountCents;
  const advisorCents = split.advisorShareCents;
  const oraCents = split.oraShareCents;
  const id = rid("pmsg");
  let rowId = "";
  try {
    const rows = await sql<{ id: string }>`
      insert into ora_paid_messages (
        id, message_id, request_id, customer_id, advisor_id, thread_id, coins, amount_cents,
        advisor_share_coins, ora_share_coins, advisor_share_cents, ora_share_cents, credited
      ) values (
        ${id}, ${input.messageId}, ${input.requestId}, ${input.customerId}, ${input.advisorId}, ${input.threadId},
        ${coins}, ${amountCents}, ${0}, ${0}, ${advisorCents}, ${oraCents}, false
      )
      on conflict (request_id) do nothing
      returning id
    `;
    rowId = rows[0]?.id || "";
  } catch (err) {
    console.error("[ora] paid message record", err);
  }
  if (!rowId) {
    const [existing] = await sql<{ id: string }>`
      select id from ora_paid_messages
      where (request_id = ${input.requestId} or message_id = ${input.messageId})
        and credited = false
        and coins > 0
      limit 1
    `.catch(() => []);
    rowId = existing?.id || "";
  }
  if (!rowId) return;
  const claimed = await sql<{ advisor_share_cents: number }>`
    update ora_paid_messages
    set credited = true
    where id = ${rowId} and credited = false and coins > 0
    returning advisor_share_cents
  `.catch(() => []);
  if (!claimed.length) return;
  const shareCents = Math.floor(Number(claimed[0]?.advisor_share_cents) || 0);
  const [prior] = await sql<{ id: string }>`
    select id from ora_ledger
    where user_id = ${input.customerId} and kind = 'paid_message' and ref_id = ${input.messageId}
    limit 1
  `.catch(() => []);
  if (!prior) {
    await addLedger(
      input.customerId,
      "paid_message",
      -coins,
      0,
      `Paid message · ${coins}c`,
      input.messageId,
    ).catch((err) => console.error("[ora] paid message ledger", err));
  }
  if (shareCents > 0) await creditAdvisorPaidMessage(input.advisorId, shareCents);
}

async function insertCustomerMessage(input: {
  id: string;
  threadId: string;
  advisorId: string;
  customerId: string;
  body: string;
  requestId: string;
  image?: string;
}) {
  const sql = await getSql();
  const preview = messagePreview(input.body, input.image);
  await sql`
    insert into ora_advisor_inbox_messages (id, thread_id, advisor_id, customer_id, role, body, kind, request_id, image_url)
    values (
      ${input.id}, ${input.threadId}, ${input.advisorId}, ${input.customerId}, 'customer', ${input.body},
      'message', ${input.requestId || null}, ${input.image || null}
    )
  `;
  await sql`
    update ora_advisor_inbox
    set last_body = ${preview}, last_role = 'customer', last_at = now(), unread_advisor = unread_advisor + 1
    where id = ${input.threadId}
  `;
}

export const getCustomerMessageThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string }) => ({ advisorId: clip(input.advisorId, 80) }))
  .handler(async ({ context, data }) => {
    if (!data.advisorId) throw new Error("Choose an advisor.");
    await ensureAccount(context.userId, "");
    await ensurePaidMessageSchema();
    await ensureChatMediaColumns();
    const advisor = await loadAdvisor(data.advisorId);
    if (!advisor) throw new Error("That advisor is not on the floor.");
    const sql = await getSql();
    const threadId = await loadOrCreateThread(advisor.id, context.userId);
    await sql`
      update ora_advisor_inbox set unread_customer = 0
      where id = ${threadId} and customer_id = ${context.userId}
    `;
    const messages = await sql<{ id: string; role: string; body: string; created_at: string; image_url: string | null }>`
      select id, role, body, created_at::text as created_at, image_url
      from ora_advisor_inbox_messages
      where thread_id = ${threadId}
      order by created_at asc
      limit 200
    `.catch(() => []);
    const allowance = await loadAllowance(context.userId, advisor.id);
    const wallet = await walletCoins(context.userId);
    const blocked = await isBlocked(advisor.id, context.userId);
    const [mine] = await sql<{ n: number }>`
      select 1 as n from ora_customer_blocks
      where customer_id = ${context.userId} and advisor_id = ${advisor.id}
      limit 1
    `.catch(() => []);
    return {
      threadId,
      advisorId: advisor.id,
      advisorName: advisor.name,
      advisorSlug: advisor.slug,
      advisorPhoto: advisor.photo_url || "",
      blocked,
      blockedByMe: Boolean(mine),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role === "advisor" ? "advisor" : "customer",
        body: m.body,
        image: displayChatImage(m.image_url),
        at: m.created_at,
      })),
      ...allowanceView({ ...allowance, wallet }),
    };
  });

export const sendCustomerInboxMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId: string; body: string; requestId?: string; confirmPaid?: boolean; image?: string }) => ({
    advisorId: clip(input.advisorId, 80),
    body: parseChatMessageBody(input.body),
    requestId: clip(input.requestId, 80),
    confirmPaid: Boolean(input.confirmPaid),
    image: sanitizeChatImage(input.image),
  }))
  .handler(async ({ context, data }) => {
    if (!data.advisorId) throw new Error("Choose an advisor.");
    if (!data.body && !data.image) throw new Error("Write a message.");
    await ensureAccount(context.userId, "");
    await assertActive(context.userId);
    await ensurePaidMessageSchema();
    await ensureChatMediaColumns();
    const advisor = await loadAdvisor(data.advisorId);
    if (!advisor) throw new Error("That advisor is not on the floor.");
    if (await isBlocked(advisor.id, context.userId)) throw new Error("This conversation is unavailable.");
    const sql = await getSql();
    const requestId = data.requestId || rid("req");
    const existing = await existingByRequest(requestId, context.userId, advisor.id);
    const allowance = await loadAllowance(context.userId, advisor.id);
    const wallet = await walletCoins(context.userId);
    if (existing) {
      return {
        ok: true as const,
        duplicate: true,
        id: existing.id,
        body: existing.body,
        charged: 0,
        ...allowanceView({ ...allowance, wallet }),
      };
    }
    const quote = customerMessageQuote(allowance.freeUsed);
    if (!quote.free && !allowance.paidNoticeSeen && !data.confirmPaid) {
      return {
        ok: false as const,
        reason: "confirm" as const,
        ...allowanceView({ ...allowance, wallet }),
      };
    }
    if (!quote.free && data.confirmPaid && !allowance.paidNoticeSeen) {
      await sql`
        update ora_customer_message_allowance
        set paid_notice_seen = true, updated_at = now()
        where customer_id = ${context.userId} and advisor_id = ${advisor.id}
      `;
      allowance.paidNoticeSeen = true;
    }
    const threadId = await loadOrCreateThread(advisor.id, context.userId);
    const messageId = rid("im");
    let charged = 0;
    if (quote.free) {
      const claimed = await sql<{ free_used: number }>`
        update ora_customer_message_allowance
        set free_used = free_used + 1, updated_at = now()
        where customer_id = ${context.userId} and advisor_id = ${advisor.id} and free_used < ${LIFETIME_FREE_CUSTOMER_MESSAGES}
        returning free_used
      `;
      if (claimed.length) {
        try {
          await insertCustomerMessage({
            id: messageId,
            threadId,
            advisorId: advisor.id,
            customerId: context.userId,
            body: data.body,
            requestId,
            image: data.image,
          });
        } catch (err) {
          await sql`
            update ora_customer_message_allowance
            set free_used = greatest(free_used - 1, 0), updated_at = now()
            where customer_id = ${context.userId} and advisor_id = ${advisor.id}
          `;
          const raced = await existingByRequest(requestId, context.userId, advisor.id);
          if (raced) {
            const next = await loadAllowance(context.userId, advisor.id);
            return {
              ok: true as const,
              duplicate: true,
              id: raced.id,
              body: raced.body,
              charged: 0,
              ...allowanceView({ ...next, wallet: await walletCoins(context.userId) }),
            };
          }
          throw err;
        }
        const next = await loadAllowance(context.userId, advisor.id);
        return {
          ok: true as const,
          duplicate: false,
          id: messageId,
          body: data.body,
          charged: 0,
          ...allowanceView({ ...next, wallet }),
        };
      }
    }
    if (!allowance.paidNoticeSeen && !data.confirmPaid) {
      return {
        ok: false as const,
        reason: "confirm" as const,
        ...allowanceView({ ...(await loadAllowance(context.userId, advisor.id)), wallet }),
      };
    }
    const deducted = await sql<{ coins: number }>`
      update ora_wallets
      set coins = coins - ${PAID_CUSTOMER_MESSAGE_COINS}
      where user_id = ${context.userId} and coins >= ${PAID_CUSTOMER_MESSAGE_COINS}
      returning coins
    `;
    if (!deducted.length) {
      return {
        ok: false as const,
        reason: "insufficient" as const,
        ...allowanceView({ ...(await loadAllowance(context.userId, advisor.id)), wallet: await walletCoins(context.userId) }),
      };
    }
    charged = PAID_CUSTOMER_MESSAGE_COINS;
    try {
      await insertCustomerMessage({
        id: messageId,
        threadId,
        advisorId: advisor.id,
        customerId: context.userId,
        body: data.body,
        requestId,
        image: data.image,
      });
    } catch (err) {
      await sql`
        update ora_wallets set coins = coins + ${PAID_CUSTOMER_MESSAGE_COINS} where user_id = ${context.userId}
      `;
      const raced = await existingByRequest(requestId, context.userId, advisor.id);
      if (raced) {
        const next = await loadAllowance(context.userId, advisor.id);
        return {
          ok: true as const,
          duplicate: true,
          id: raced.id,
          body: raced.body,
          charged: 0,
          ...allowanceView({ ...next, wallet: await walletCoins(context.userId) }),
        };
      }
      throw err;
    }
    await sql`
      update ora_customer_message_allowance
      set paid_sent = paid_sent + 1, paid_notice_seen = true, updated_at = now()
      where customer_id = ${context.userId} and advisor_id = ${advisor.id}
    `;
    await recordPaidMessage({
      messageId,
      requestId,
      customerId: context.userId,
      advisorId: advisor.id,
      threadId,
    });
    const next = await loadAllowance(context.userId, advisor.id);
    return {
      ok: true as const,
      duplicate: false,
      id: messageId,
      body: data.body,
      charged,
      ...allowanceView({ ...next, wallet: Number(deducted[0]?.coins) || 0 }),
    };
  });

export const listCustomerInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensurePaidMessageSchema();
    await ensureChatMediaColumns();
    const sql = await getSql();
    const rows = await sql<{
      advisor_id: string;
      name: string;
      slug: string;
      photo_url: string | null;
      last_body: string;
      last_at: string;
      unread_customer: number;
    }>`
      select i.advisor_id, a.name, a.slug, a.photo_url, i.last_body, i.last_at::text as last_at,
             i.unread_customer
      from ora_advisor_inbox i
      join ora_advisors a on a.id = i.advisor_id
      where i.customer_id = ${context.userId}
      order by i.last_at desc
      limit 80
    `.catch(() => []);
    const threads = rows.map((row) => ({
      advisorId: row.advisor_id,
      name: row.name,
      slug: row.slug,
      photo: row.photo_url || "",
      preview: row.last_body || "",
      at: row.last_at,
      unread: Number(row.unread_customer) || 0,
    }));
    return {
      unread: threads.reduce((sum, thread) => sum + thread.unread, 0),
      threads,
    };
  });

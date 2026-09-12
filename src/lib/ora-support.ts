import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { assertActive, auditLog, ensureAccount, formatClock, frozenRate, requireAdmin, rid } from "@/lib/ora";
import {
  isSupportStatus,
  makeTicketNo,
  parseReason,
  parseStatus,
  reasonLabel,
  statusLabel,
  SUPPORT_REASONS,
  SUPPORT_STATUSES,
  type SupportReason,
  type SupportStatus,
} from "@/lib/ora-support-meta";

export {
  makeTicketNo,
  parseReason,
  parseStatus,
  reasonLabel,
  statusLabel,
  SUPPORT_REASONS,
  SUPPORT_STATUSES,
  type SupportReason,
  type SupportStatus,
};

export const SUPPORT_TABLE_SQL = `
create table if not exists ora_tickets (
  id text primary key,
  ticket_no text not null unique,
  client_id text not null,
  reason text not null,
  status text not null default 'open',
  advisor_id text not null default '',
  reading_id text not null default '',
  last_message_at timestamptz not null default now(),
  customer_unread boolean not null default false,
  admin_unread boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`;

export const SUPPORT_MSG_SQL = `
create table if not exists ora_ticket_messages (
  id text primary key,
  ticket_id text not null,
  author_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
)`;

export const SUPPORT_NOTE_SQL = `
create table if not exists ora_ticket_notes (
  id text primary key,
  ticket_id text not null,
  author_id text not null,
  body text not null,
  created_at timestamptz not null default now()
)`;

export async function ensureSupportTables() {
  const sql = await getSql();
  await sql.query(SUPPORT_TABLE_SQL);
  await sql.query(SUPPORT_MSG_SQL);
  await sql.query(SUPPORT_NOTE_SQL);
  try {
    await sql.query(`create index if not exists ora_tickets_client_idx on ora_tickets (client_id, created_at desc)`);
    await sql.query(`create index if not exists ora_tickets_status_idx on ora_tickets (status, admin_unread, last_message_at desc)`);
    await sql.query(
      `create index if not exists ora_ticket_messages_ticket_idx on ora_ticket_messages (ticket_id, created_at)`,
    );
    await sql.query(`create index if not exists ora_ticket_notes_ticket_idx on ora_ticket_notes (ticket_id, created_at)`);
  } catch {
    // indexes are optional
  }
}

type TicketRow = {
  id: string;
  ticket_no: string;
  client_id: string;
  reason: string;
  status: string;
  advisor_id: string;
  reading_id: string;
  last_message_at: string;
  customer_unread: boolean;
  admin_unread: boolean;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_email?: string;
  advisor_name?: string;
};

function mapTicket(r: TicketRow) {
  return {
    id: r.id,
    ticketNo: r.ticket_no,
    clientId: r.client_id,
    clientName: r.client_name || "",
    clientEmail: r.client_email || "",
    reason: parseReason(r.reason),
    reasonLabel: reasonLabel(r.reason),
    status: parseStatus(r.status),
    statusLabel: statusLabel(r.status),
    advisorId: r.advisor_id || "",
    advisorName: r.advisor_name || "",
    readingId: r.reading_id || "",
    lastMessageAt: String(r.last_message_at),
    customerUnread: Boolean(r.customer_unread),
    adminUnread: Boolean(r.admin_unread),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

async function uniqueTicketNo(sql: Awaited<ReturnType<typeof getSql>>) {
  for (let i = 0; i < 8; i += 1) {
    const no = makeTicketNo();
    const [hit] = await sql<{ id: string }>`select id from ora_tickets where ticket_no = ${no} limit 1`;
    if (!hit) return no;
  }
  return makeTicketNo(`${Date.now().toString(36)}`);
}

async function loadTicket(sql: Awaited<ReturnType<typeof getSql>>, id: string) {
  const [row] = await sql<TicketRow>`
    select t.id, t.ticket_no, t.client_id, t.reason, t.status, t.advisor_id, t.reading_id,
           t.last_message_at, t.customer_unread, t.admin_unread, t.created_at, t.updated_at,
           coalesce(p.display_name, 'Customer') as client_name, coalesce(p.email, '') as client_email,
           coalesce(a.name, '') as advisor_name
    from ora_tickets t
    left join ora_profiles p on p.user_id = t.client_id
    left join ora_advisors a on a.id = t.advisor_id
    where t.id = ${id}
  `;
  return row ?? null;
}

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureAccount(context.userId, "Member");
    await ensureSupportTables();
    const sql = await getSql();
    const rows = await sql<TicketRow>`
      select t.id, t.ticket_no, t.client_id, t.reason, t.status, t.advisor_id, t.reading_id,
             t.last_message_at, t.customer_unread, t.admin_unread, t.created_at, t.updated_at,
             coalesce(a.name, '') as advisor_name
      from ora_tickets t
      left join ora_advisors a on a.id = t.advisor_id
      where t.client_id = ${context.userId}
      order by t.last_message_at desc
      limit 50
    `;
    const [unread] = await sql<{ n: number }>`
      select count(*)::int as n from ora_tickets
      where client_id = ${context.userId} and customer_unread = true
    `;
    return { unread: Number(unread?.n ?? 0), tickets: rows.map(mapTicket) };
  });

export const listSupportOptions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureAccount(context.userId, "Member");
    const sql = await getSql();
    const sessions = await sql<{
      id: string;
      advisor_id: string;
      name: string;
      started_at: string;
      seconds: number;
      status: string;
    }>`
      select r.id, r.advisor_id, a.name, r.started_at, r.seconds, r.status
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      where r.client_id = ${context.userId}
      order by r.started_at desc
      limit 20
    `;
    return {
      reasons: SUPPORT_REASONS.map((r) => ({ id: r.id, label: r.label })),
      sessions: sessions.map((s) => ({
        id: s.id,
        advisorId: s.advisor_id,
        advisorName: s.name,
        startedAt: String(s.started_at),
        seconds: Number(s.seconds) || 0,
        status: s.status,
      })),
    };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { reason: string; body: string; advisorId?: string; readingId?: string }) => ({
    reason: parseReason(input.reason),
    body: String(input.body ?? "").trim().slice(0, 4000),
    advisorId: String(input.advisorId ?? "").trim().slice(0, 64),
    readingId: String(input.readingId ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ context, data }) => {
    await assertActive(context.userId);
    await ensureAccount(context.userId, "Member");
    if (data.body.length < 8) throw new Error("Please describe the issue in a little more detail.");
    await ensureSupportTables();
    const sql = await getSql();
    let advisorId = data.advisorId;
    let readingId = data.readingId;
    if (readingId) {
      const [session] = await sql<{ id: string; advisor_id: string }>`
        select id, advisor_id from ora_readings where id = ${readingId} and client_id = ${context.userId}
      `;
      if (!session) throw new Error("That session was not found on this account.");
      readingId = session.id;
      advisorId = session.advisor_id;
    } else if (advisorId) {
      const [adv] = await sql<{ id: string }>`select id from ora_advisors where id = ${advisorId}`;
      if (!adv) throw new Error("That advisor was not found.");
    } else {
      advisorId = "";
    }
    const id = rid("tkt");
    const ticketNo = await uniqueTicketNo(sql);
    const msgId = rid("tmsg");
    await sql`
      insert into ora_tickets (
        id, ticket_no, client_id, reason, status, advisor_id, reading_id,
        last_message_at, customer_unread, admin_unread
      ) values (
        ${id}, ${ticketNo}, ${context.userId}, ${data.reason}, 'open', ${advisorId}, ${readingId},
        now(), false, true
      )
    `;
    await sql`
      insert into ora_ticket_messages (id, ticket_id, author_id, role, body)
      values (${msgId}, ${id}, ${context.userId}, 'customer', ${data.body})
    `;
    return { id, ticketNo };
  });

export const getMyTicket = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await ensureSupportTables();
    const sql = await getSql();
    const row = await loadTicket(sql, data.id);
    if (!row || row.client_id !== context.userId) throw new Error("Ticket not found.");
    await sql`
      update ora_tickets set customer_unread = false, updated_at = now()
      where id = ${row.id} and client_id = ${context.userId}
    `;
    const messages = await sql<{
      id: string;
      role: string;
      body: string;
      created_at: string;
    }>`
      select id, role, body, created_at from ora_ticket_messages
      where ticket_id = ${row.id} and role in ('customer', 'admin')
      order by created_at asc
    `;
    return {
      ticket: mapTicket({ ...row, customer_unread: false }),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role === "admin" ? ("admin" as const) : ("customer" as const),
        body: m.body,
        createdAt: String(m.created_at),
      })),
    };
  });

export const replyMyTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({
    id: String(input.id).slice(0, 64),
    body: String(input.body ?? "").trim().slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    await assertActive(context.userId);
    if (data.body.length < 1) throw new Error("Write a reply first.");
    await ensureSupportTables();
    const sql = await getSql();
    const [row] = await sql<{ id: string; status: string }>`
      select id, status from ora_tickets where id = ${data.id} and client_id = ${context.userId}
    `;
    if (!row) throw new Error("Ticket not found.");
    if (row.status === "closed") throw new Error("This ticket is closed.");
    const msgId = rid("tmsg");
    await sql`
      insert into ora_ticket_messages (id, ticket_id, author_id, role, body)
      values (${msgId}, ${row.id}, ${context.userId}, 'customer', ${data.body})
    `;
    const nextStatus = row.status === "resolved" ? "open" : row.status;
    await sql`
      update ora_tickets
      set admin_unread = true, customer_unread = false, last_message_at = now(), updated_at = now(),
          status = ${nextStatus}
      where id = ${row.id}
    `;
    return { ok: true as const };
  });

export const adminTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { status?: string; q?: string; t?: number }) => ({
    status: String(input?.status ?? "all").slice(0, 20),
    q: String(input?.q ?? "").trim().slice(0, 80),
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    await ensureSupportTables();
    const sql = await getSql();
    const status = data.status === "unread" || isSupportStatus(data.status) ? data.status : "all";
    const q = data.q;
    const rows = await sql<TicketRow>`
      select t.id, t.ticket_no, t.client_id, t.reason, t.status, t.advisor_id, t.reading_id,
             t.last_message_at, t.customer_unread, t.admin_unread, t.created_at, t.updated_at,
             coalesce(p.display_name, 'Customer') as client_name, coalesce(p.email, '') as client_email,
             coalesce(a.name, '') as advisor_name
      from ora_tickets t
      left join ora_profiles p on p.user_id = t.client_id
      left join ora_advisors a on a.id = t.advisor_id
      where (${status} = 'all' or (${status} = 'unread' and t.admin_unread = true) or t.status = ${status})
        and (
          ${q} = ''
          or t.ticket_no ilike ${"%" + q + "%"}
          or coalesce(p.display_name, '') ilike ${"%" + q + "%"}
          or coalesce(p.email, '') ilike ${"%" + q + "%"}
        )
      order by t.admin_unread desc, t.last_message_at desc
      limit 80
    `;
    const [counts] = await sql<{ open: number; unread: number }>`
      select
        count(*) filter (where status in ('open', 'in_progress'))::int as open,
        count(*) filter (where admin_unread = true)::int as unread
      from ora_tickets
    `;
    return {
      open: Number(counts?.open ?? 0),
      unread: Number(counts?.unread ?? 0),
      tickets: rows.map(mapTicket),
    };
  });

export const adminTicket = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string; t?: number }) => ({
    id: String(input.id).slice(0, 64),
    t: Math.floor(Number(input.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    await ensureSupportTables();
    const sql = await getSql();
    const row = await loadTicket(sql, data.id);
    if (!row) throw new Error("Ticket not found.");
    await sql`update ora_tickets set admin_unread = false, updated_at = now() where id = ${row.id}`;
    const messages = await sql<{
      id: string;
      author_id: string;
      role: string;
      body: string;
      created_at: string;
      author_name: string;
    }>`
      select m.id, m.author_id, m.role, m.body, m.created_at,
             coalesce(p.display_name, case when m.role = 'admin' then 'Support' else 'Customer' end) as author_name
      from ora_ticket_messages m
      left join ora_profiles p on p.user_id = m.author_id
      where m.ticket_id = ${row.id}
      order by m.created_at asc
    `;
    const notes = await sql<{
      id: string;
      body: string;
      created_at: string;
      author_name: string;
    }>`
      select n.id, n.body, n.created_at, coalesce(p.display_name, 'Owner') as author_name
      from ora_ticket_notes n
      left join ora_profiles p on p.user_id = n.author_id
      where n.ticket_id = ${row.id}
      order by n.created_at asc
    `;
    const [customer] = await sql<{
      user_id: string;
      display_name: string;
      email: string;
      status: string;
      role: string;
      coins: number;
      bonus_seconds: number;
      weekly_seconds: number;
    }>`
      select p.user_id, p.display_name, p.email, p.status, p.role,
             coalesce(w.coins, 0)::int as coins,
             coalesce(w.bonus_seconds, 0)::int as bonus_seconds,
             coalesce(w.weekly_seconds, 0)::int as weekly_seconds
      from ora_profiles p
      left join ora_wallets w on w.user_id = p.user_id
      where p.user_id = ${row.client_id}
    `;
    let session: {
      id: string;
      advisorName: string;
      seconds: number;
      coinsSpent: number;
      rateCoins: number;
      status: string;
      startedAt: string;
    } | null = null;
    if (row.reading_id) {
      const [s] = await sql<{
        id: string;
        name: string;
        seconds: number;
        coins_spent: number;
        rate_coins: number;
        status: string;
        started_at: string;
      }>`
        select r.id, a.name, r.seconds, r.coins_spent, r.rate_coins, r.status, r.started_at
        from ora_readings r
        join ora_advisors a on a.id = r.advisor_id
        where r.id = ${row.reading_id}
      `;
      if (s) {
        session = {
          id: s.id,
          advisorName: s.name,
          seconds: Number(s.seconds) || 0,
          coinsSpent: Number(s.coins_spent) || 0,
          rateCoins: frozenRate(s.rate_coins),
          status: s.status,
          startedAt: String(s.started_at),
        };
      }
    }
    const history = await sql<TicketRow>`
      select t.id, t.ticket_no, t.client_id, t.reason, t.status, t.advisor_id, t.reading_id,
             t.last_message_at, t.customer_unread, t.admin_unread, t.created_at, t.updated_at,
             coalesce(a.name, '') as advisor_name
      from ora_tickets t
      left join ora_advisors a on a.id = t.advisor_id
      where t.client_id = ${row.client_id} and t.id <> ${row.id}
      order by t.created_at desc
      limit 12
    `;
    const advisors = await sql<{ id: string; name: string }>`
      select id, name from ora_advisors order by name
    `;
    const sessions = await sql<{
      id: string;
      advisor_id: string;
      name: string;
      started_at: string;
      status: string;
    }>`
      select r.id, r.advisor_id, a.name, r.started_at, r.status
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      where r.client_id = ${row.client_id}
      order by r.started_at desc
      limit 20
    `;
    return {
      ticket: mapTicket({ ...row, admin_unread: false }),
      customer: customer
        ? {
            userId: customer.user_id,
            name: customer.display_name,
            email: customer.email,
            status: customer.status,
            role: customer.role,
            coins: Number(customer.coins) || 0,
            bonus: formatClock(Number(customer.bonus_seconds) || 0),
            weekly: formatClock(Number(customer.weekly_seconds) || 0),
          }
        : null,
      session,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role === "admin" ? ("admin" as const) : ("customer" as const),
        author: m.author_name,
        body: m.body,
        createdAt: String(m.created_at),
      })),
      notes: notes.map((n) => ({
        id: n.id,
        author: n.author_name,
        body: n.body,
        createdAt: String(n.created_at),
      })),
      history: history.map(mapTicket),
      advisors: advisors.map((a) => ({ id: a.id, name: a.name })),
      sessions: sessions.map((s) => ({
        id: s.id,
        advisorId: s.advisor_id,
        advisorName: s.name,
        startedAt: String(s.started_at),
        status: s.status,
      })),
    };
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({
    id: String(input.id).slice(0, 64),
    body: String(input.body ?? "").trim().slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    if (!data.body) throw new Error("Write a reply first.");
    await ensureSupportTables();
    const sql = await getSql();
    const [row] = await sql<{ id: string; status: string }>`select id, status from ora_tickets where id = ${data.id}`;
    if (!row) throw new Error("Ticket not found.");
    const msgId = rid("tmsg");
    await sql`
      insert into ora_ticket_messages (id, ticket_id, author_id, role, body)
      values (${msgId}, ${row.id}, ${context.userId}, 'admin', ${data.body})
    `;
    const next = row.status === "closed" ? "closed" : row.status === "open" ? "in_progress" : row.status;
    await sql`
      update ora_tickets
      set customer_unread = true, admin_unread = false, last_message_at = now(), updated_at = now(),
          status = ${next}
      where id = ${row.id}
    `;
    await auditLog(context.userId, "support_reply", "ticket", row.id, data.body.slice(0, 120));
    return { ok: true as const };
  });

export const adminSetTicketStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: string }) => ({
    id: String(input.id).slice(0, 64),
    status: parseStatus(input.status),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    await ensureSupportTables();
    const sql = await getSql();
    const updated = await sql<{ id: string }>`
      update ora_tickets set status = ${data.status}, updated_at = now()
      where id = ${data.id}
      returning id
    `;
    if (!updated.length) throw new Error("Ticket not found.");
    await auditLog(context.userId, "support_status", "ticket", data.id, data.status);
    return { ok: true as const, status: data.status };
  });

export const adminAddTicketNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({
    id: String(input.id).slice(0, 64),
    body: String(input.body ?? "").trim().slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    if (!data.body) throw new Error("Write a note first.");
    await ensureSupportTables();
    const sql = await getSql();
    const [row] = await sql<{ id: string }>`select id from ora_tickets where id = ${data.id}`;
    if (!row) throw new Error("Ticket not found.");
    const id = rid("tnote");
    await sql`
      insert into ora_ticket_notes (id, ticket_id, author_id, body)
      values (${id}, ${row.id}, ${context.userId}, ${data.body})
    `;
    return { ok: true as const };
  });

export const adminLinkTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; advisorId?: string; readingId?: string }) => ({
    id: String(input.id).slice(0, 64),
    advisorId: String(input.advisorId ?? "").trim().slice(0, 64),
    readingId: String(input.readingId ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    await ensureSupportTables();
    const sql = await getSql();
    const [row] = await sql<{ id: string; client_id: string }>`
      select id, client_id from ora_tickets where id = ${data.id}
    `;
    if (!row) throw new Error("Ticket not found.");
    let advisorId = data.advisorId;
    let readingId = data.readingId;
    if (readingId) {
      const [session] = await sql<{ id: string; advisor_id: string }>`
        select id, advisor_id from ora_readings where id = ${readingId} and client_id = ${row.client_id}
      `;
      if (!session) throw new Error("That session does not belong to this customer.");
      readingId = session.id;
      advisorId = session.advisor_id;
    }
    await sql`
      update ora_tickets
      set advisor_id = ${advisorId}, reading_id = ${readingId}, updated_at = now()
      where id = ${row.id}
    `;
    return { ok: true as const };
  });

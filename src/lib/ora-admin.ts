import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  addLedger,
  auditLog,
  closeReadingById,
  COINS_PER_DOLLAR,
  frozenRate,
  requireRate,
  grantAdmin,
  invalidateCategories,
  invalidateSettings,
  loadCategories,
  loadSettings,
  mapAdvisor,
  maybeRefreshMonthlyRanks,
  ensureMonthlyRankTable,
  requireAdmin,
  revokeAdmin,
  rid,
  type Advisor,
  type Category,
  type SiteSettings,
} from "@/lib/ora";
import { monthStartUtc } from "@/lib/ora-rank";
import { ensureSupportTables } from "@/lib/ora-support";

async function actor(userId: string, permission?: string) {
  await requireAdmin(userId, permission);
  return userId;
}

function stamp(input?: { t?: number }) {
  return { t: Math.floor(Number(input?.t) || Date.now()) };
}

export const adminSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { bindDesignatedOwnerFromEnv } = await import("./ora-owner.server");
    await bindDesignatedOwnerFromEnv(context.userId);
    await actor(context.userId);
    const sql = await getSql();
    const [p] = await sql<{ display_name: string; email: string }>`
      select display_name, email from ora_profiles where user_id = ${context.userId}
    `;
    return {
      ok: true as const,
      userId: context.userId,
      name: p?.display_name || "Owner",
      email: p?.email || "",
    };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "overview");
    const sql = await getSql();
    await ensureSupportTables();
    const [s] = await sql<{
      customers: number;
      advisors: number;
      online: number;
      live_chats: number;
      sales: number;
      revenue: number;
      pending_payouts: number;
      pending_apps: number;
      payment_cents: number;
      payment_coins: number;
      today_sales: number;
      open_tickets: number;
      unread_tickets: number;
      new_customers: number;
    }>`
      select
        (select count(*)::int from ora_v_customers) as customers,
        (select count(*)::int from ora_v_advisors) as advisors,
        (select count(*)::int from ora_v_advisors where online = true and approval_status = 'live') as online,
        (select count(*)::int from ora_v_sessions where status = 'live') as live_chats,
        (select coalesce(sum(cost), 0)::int from ora_v_sessions) as sales,
        (select coalesce(sum(platform_fee), 0)::int from ora_readings) as revenue,
        (select coalesce(sum(amount), 0)::int from ora_v_payouts where status = 'requested') as pending_payouts,
        (select count(*)::int from ora_applications where status = 'pending') as pending_apps,
        (select coalesce(sum(amount_cents), 0)::int from ora_v_transactions where kind = 'coin_purchase' and status = 'succeeded') as payment_cents,
        (select coalesce(sum(amount_coins), 0)::int from ora_v_transactions where kind = 'coin_purchase' and status = 'succeeded') as payment_coins,
        (select coalesce(sum(cost), 0)::int from ora_v_sessions where start_time >= date_trunc('day', now())) as today_sales,
        (select count(*)::int from ora_tickets where status in ('open', 'in_progress')) as open_tickets,
        (select count(*)::int from ora_tickets where admin_unread = true) as unread_tickets,
        (select count(*)::int from ora_v_customers where signup_date >= date_trunc('day', now())) as new_customers
    `;
    const live = await sql<{
      id: string;
      seconds: number;
      coins_spent: number;
      client: string;
      advisor: string;
      started_at: string;
    }>`
      select r.id, r.seconds, r.coins_spent, coalesce(p.display_name, 'Client') as client,
             a.name as advisor, r.started_at
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_profiles p on p.user_id = r.client_id
      where r.status = 'live'
      order by r.started_at desc
      limit 8
    `;
    const settings = await loadSettings();
    return {
      settings,
      stats: {
        customers: Number(s?.customers ?? 0),
        advisors: Number(s?.advisors ?? 0),
        online: Number(s?.online ?? 0),
        liveChats: Number(s?.live_chats ?? 0),
        sales: Number(s?.sales ?? 0),
        revenue: Number(s?.revenue ?? 0),
        pendingPayouts: Number(s?.pending_payouts ?? 0),
        pendingApps: Number(s?.pending_apps ?? 0),
        paymentCents: Number(s?.payment_cents ?? 0),
        paymentCoins: Number(s?.payment_coins ?? 0),
        todaySales: Number(s?.today_sales ?? 0),
        openTickets: Number(s?.open_tickets ?? 0),
        unreadTickets: Number(s?.unread_tickets ?? 0),
        newCustomersToday: Number(s?.new_customers ?? 0),
      },
      live: live.map((r) => ({
        id: r.id,
        seconds: Number(r.seconds),
        coinsSpent: Number(r.coins_spent),
        client: r.client,
        advisor: r.advisor,
        startedAt: String(r.started_at),
      })),
    };
  });

export const adminAdvisors = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "advisors");
    await ensureMonthlyRankTable();
    await maybeRefreshMonthlyRanks();
    const { listAdvisorApplications } = await import("./ora-advisor");
    const applications = await listAdvisorApplications();
    const sql = await getSql();
    const month = monthStartUtc();
    const advisors = await sql`
      select a.id, a.user_id, a.name, a.slug, a.bio, a.experience, a.specialties, a.rate_coins, a.photo_url, a.video_url,
             a.status, a.trusted, a.is_new, a.rating, a.reviews, a.legal_name, a.languages, a.years, a.online, a.busy, a.payout_coins,
             r.rank as monthly_rank
      from ora_advisors a
      left join ora_monthly_rank r on r.advisor_id = a.id and r.month = ${month}::date
      order by r.rank asc nulls last, a.name
    `.catch(() =>
      sql`
        select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url,
               status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
        from ora_advisors order by name
      `,
    );
    const ranking = await sql<{
      advisor_id: string;
      name: string;
      month: string;
      eligible_free_clients: number;
      converted_paid_clients: number;
      conversion_rate: string | number;
      paid_session_revenue: number;
      eligible: boolean;
      rank: number | null;
    }>`
      select r.advisor_id, a.name, r.month::text as month, r.eligible_free_clients, r.converted_paid_clients,
             r.conversion_rate, r.paid_session_revenue, r.eligible, r.rank
      from ora_monthly_rank r
      join ora_advisors a on a.id = r.advisor_id
      where r.month = ${month}::date
      order by r.rank asc nulls last, a.name
    `.catch(() => []);
    const history = await sql<{
      advisor_id: string;
      name: string;
      month: string;
      eligible_free_clients: number;
      converted_paid_clients: number;
      conversion_rate: string | number;
      paid_session_revenue: number;
      rank: number | null;
    }>`
      select r.advisor_id, a.name, r.month::text as month, r.eligible_free_clients, r.converted_paid_clients,
             r.conversion_rate, r.paid_session_revenue, r.rank
      from ora_monthly_rank r
      join ora_advisors a on a.id = r.advisor_id
      where r.month < ${month}::date and r.rank is not null
      order by r.month desc, r.rank asc
      limit 40
    `.catch(() => []);
    const mapPerf = (row: {
      advisor_id: string;
      name: string;
      month: string;
      eligible_free_clients: number;
      converted_paid_clients: number;
      conversion_rate: string | number;
      paid_session_revenue: number;
      rank: number | null;
      eligible?: boolean;
    }) => ({
      advisorId: row.advisor_id,
      name: row.name,
      month: String(row.month).slice(0, 10),
      eligibleFreeClients: Number(row.eligible_free_clients) || 0,
      convertedPaidClients: Number(row.converted_paid_clients) || 0,
      conversionRate: Number(row.conversion_rate) || 0,
      paidSessionRevenue: Number(row.paid_session_revenue) || 0,
      rank: row.rank != null && Number(row.rank) > 0 ? Number(row.rank) : null,
      eligible: Boolean(row.eligible),
    });
    const perf = await sql<{ advisor_id: string; sessions: number; earned: number }>`
      select advisor_id, count(*)::int as sessions, coalesce(sum(advisor_earned), 0)::int as earned
      from ora_readings
      group by advisor_id
    `.catch(() => []);
    const perfById = new Map(perf.map((p) => [p.advisor_id, p]));
    const panelStats = await import("./ora-advisor")
      .then((mod) => mod.advisorAdminStats(advisors.map((row) => String((row as { id: string }).id))))
      .catch(() => new Map());
    return {
      applications: applications.map((a) => ({ ...a, created_at: String(a.created_at) })),
      advisors: advisors.map((row) => {
        const mapped = mapAdvisor(row);
        const p = perfById.get(mapped.id);
        const panel = panelStats.get(mapped.id);
        return {
          ...mapped,
          sessionCount: Number(p?.sessions ?? 0),
          earnedCoins: Number(p?.earned ?? 0),
          onlineMonthSeconds: Number(panel?.onlineMonth ?? 0),
          panelReadingMinutes: Number(panel?.readingMinutes ?? 0),
          panelAdvisorEarnings: Number(panel?.advisorEarnings ?? 0),
          panelPlatformRevenue: Number(panel?.platformRevenue ?? 0),
        };
      }),
      ranking: ranking.map(mapPerf),
      history: history.map(mapPerf),
      month,
    };
  });

export const adminUpdateAdvisor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    id: string;
    name: string;
    bio: string;
    specialties: string;
    rateCoins: number;
    status: string;
    trusted: boolean;
    years: number;
    languages: string;
  }) => ({
    id: String(input.id).slice(0, 64),
    name: String(input.name).trim().slice(0, 80),
    bio: String(input.bio).trim().slice(0, 1200),
    specialties: String(input.specialties).trim().slice(0, 120),
    rateCoins: requireRate(input.rateCoins),
    status: ["live", "paused", "suspended"].includes(String(input.status)) ? String(input.status) : "paused",
    trusted: Boolean(input.trusted),
    years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
    languages: String(input.languages).trim().slice(0, 80) || "English",
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "advisors");
    if (!data.name) throw new Error("Name is required.");
    const sql = await getSql();
    if (data.status !== "live") {
      await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, status = ${data.status}, trusted = ${data.trusted},
            years = ${data.years}, languages = ${data.languages}, online = false, busy = false
        where id = ${data.id}
      `;
      try {
        const { closeAdvisorPresence } = await import("./ora-advisor");
        await closeAdvisorPresence(data.id);
      } catch (e) {
        console.error("[ora] close presence on pause", e);
      }
    } else {
      await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, status = ${data.status}, trusted = ${data.trusted},
            years = ${data.years}, languages = ${data.languages}
        where id = ${data.id}
      `;
    }
    await auditLog(context.userId, "edit_advisor", "advisor", data.id, `${data.name} · ${data.status} · ${data.rateCoins}c`);
    return { ok: true };
  });

export const adminCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { q?: string; t?: number }) => ({
    q: String(input?.q ?? "").trim().slice(0, 80),
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "customers");
    const sql = await getSql();
    const q = data.q.toLowerCase();
    const rows = await sql<{
      user_id: string;
      display_name: string;
      email: string;
      role: string;
      status: string;
      coins: number;
      bonus_seconds: number;
      weekly_seconds: number;
      subscribed: boolean;
      created_at: string;
    }>`
      select p.user_id, p.display_name, p.email, p.role, p.status,
             coalesce(w.coins, 0) as coins, coalesce(w.bonus_seconds, 0) as bonus_seconds,
             coalesce(w.weekly_seconds, 0) as weekly_seconds, coalesce(w.subscribed, false) as subscribed,
             p.created_at
      from ora_profiles p
      left join ora_wallets w on w.user_id = p.user_id
      order by p.created_at desc
      limit 80
    `;
    const filtered = q
      ? rows.filter(
          (r) =>
            r.display_name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.user_id.toLowerCase().includes(q),
        )
      : rows;
    return filtered.map((r) => ({
      userId: r.user_id,
      name: r.display_name,
      email: r.email,
      role: r.role,
      status: r.status || "active",
      coins: Number(r.coins),
      bonusSeconds: Number(r.bonus_seconds),
      weeklySeconds: Number(r.weekly_seconds),
      subscribed: Boolean(r.subscribed),
      createdAt: String(r.created_at),
    }));
  });

export const adminSetCustomer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; status?: string; role?: string }) => ({
    userId: String(input.userId).slice(0, 128),
    status: input.status === "suspended" ? "suspended" : input.status === "active" ? "active" : "",
    role: input.role === "admin" ? "admin" : input.role === "client" ? "client" : "",
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "customers");
    if (data.userId === context.userId && (data.status === "suspended" || data.role === "client")) {
      throw new Error("You cannot suspend or demote your own owner account.");
    }
    const sql = await getSql();
    if (data.status) {
      await sql`update ora_profiles set status = ${data.status} where user_id = ${data.userId}`;
      if (data.status === "suspended") {
        await sql`update ora_advisors set online = false, busy = false, status = 'suspended' where user_id = ${data.userId} and status = 'live'`;
      }
      await auditLog(context.userId, data.status === "suspended" ? "suspend_user" : "reactivate_user", "profile", data.userId, data.status);
    }
    if (data.role) {
      if (data.role === "client") {
        const [n] = await sql<{ n: number }>`select count(*)::int as n from ora_admins`;
        const [target] = await sql<{ role: string }>`select role from ora_admins where user_id = ${data.userId}`;
        if (target && Number(n?.n ?? 0) <= 1) throw new Error("Keep at least one owner.");
        await revokeAdmin(data.userId);
      } else if (data.role === "admin") {
        await grantAdmin(data.userId, context.userId, "admin");
      }
      await auditLog(context.userId, "set_role", "profile", data.userId, data.role);
    }
    return { ok: true };
  });

export const adminCustomerActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; t?: number }) => ({
    userId: String(input.userId).slice(0, 128),
    t: Math.floor(Number(input.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "customers");
    const sql = await getSql();
    const ledger = await sql<{
      id: string;
      kind: string;
      amount_coins: number;
      seconds: number;
      note: string;
      created_at: string;
    }>`
      select id, kind, amount_coins, seconds, note, created_at
      from ora_ledger where user_id = ${data.userId} order by created_at desc limit 40
    `;
    return ledger.map((r) => ({
      id: r.id,
      kind: r.kind,
      coins: Number(r.amount_coins),
      seconds: Number(r.seconds),
      note: r.note,
      createdAt: String(r.created_at),
    }));
  });

export const adminCustomerDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; t?: number }) => ({
    userId: String(input.userId).slice(0, 128),
    t: Math.floor(Number(input.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "customers");
    await ensureSupportTables();
    const sql = await getSql();
    const ledger = await sql<{
      id: string;
      kind: string;
      amount_coins: number;
      seconds: number;
      note: string;
      created_at: string;
    }>`
      select id, kind, amount_coins, seconds, note, created_at
      from ora_ledger where user_id = ${data.userId} order by created_at desc limit 40
    `;
    const sessions = await sql<{
      id: string;
      status: string;
      seconds: number;
      coins_spent: number;
      bonus_used: number;
      weekly_used: number;
      started_at: string;
      advisor: string;
    }>`
      select r.id, r.status, r.seconds, r.coins_spent, coalesce(r.bonus_used, 0) as bonus_used,
             coalesce(r.weekly_used, 0) as weekly_used, r.started_at, a.name as advisor
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      where r.client_id = ${data.userId}
      order by r.started_at desc
      limit 30
    `;
    const tickets = await sql<{
      id: string;
      ticket_no: string;
      status: string;
      reason: string;
      created_at: string;
    }>`
      select id, ticket_no, status, reason, created_at
      from ora_tickets where client_id = ${data.userId}
      order by created_at desc
      limit 20
    `.catch(() => []);
    return {
      ledger: ledger.map((r) => ({
        id: r.id,
        kind: r.kind,
        coins: Number(r.amount_coins),
        seconds: Number(r.seconds),
        note: r.note,
        createdAt: String(r.created_at),
      })),
      sessions: sessions.map((r) => ({
        id: r.id,
        status: r.status,
        seconds: Number(r.seconds),
        coinsSpent: Number(r.coins_spent),
        bonusUsed: Number(r.bonus_used),
        weeklyUsed: Number(r.weekly_used),
        startedAt: String(r.started_at),
        advisor: r.advisor,
      })),
      tickets: tickets.map((r) => ({
        id: r.id,
        ticketNo: r.ticket_no,
        status: r.status,
        reason: r.reason,
        createdAt: String(r.created_at),
      })),
    };
  });

export const adminSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "sessions");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      status: string;
      seconds: number;
      coins_spent: number;
      advisor_earned: number;
      platform_fee: number;
      rate_coins: number;
      bonus_used: number;
      weekly_used: number;
      started_at: string;
      ended_at: string | null;
      client: string;
      advisor: string;
    }>`
      select r.id, r.status, r.seconds, r.coins_spent, r.advisor_earned, r.platform_fee, r.rate_coins,
             coalesce(r.bonus_used, 0) as bonus_used, coalesce(r.weekly_used, 0) as weekly_used,
             r.started_at, r.ended_at, coalesce(p.display_name, 'Client') as client, a.name as advisor
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_profiles p on p.user_id = r.client_id
      order by r.started_at desc
      limit 60
    `;
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      seconds: Number(r.seconds),
      coinsSpent: Number(r.coins_spent),
      advisorEarned: Number(r.advisor_earned),
      platformFee: Number(r.platform_fee),
      rateCoins: frozenRate(r.rate_coins),
      bonusUsed: Number(r.bonus_used),
      weeklyUsed: Number(r.weekly_used),
      startedAt: String(r.started_at),
      endedAt: r.ended_at ? String(r.ended_at) : "",
      client: r.client,
      advisor: r.advisor,
    }));
  });

export const adminEndSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "sessions");
    await closeReadingById(data.id);
    await auditLog(context.userId, "end_session", "reading", data.id, "Forced end");
    return { ok: true };
  });

export const adminFinance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "finance");
    const sql = await getSql();
    const [s] = await sql<{
      payments: number;
      payment_cents: number;
      spent: number;
      earned: number;
      commission: number;
      refunds: number;
    }>`
      select
        (select coalesce(sum(coins), 0)::int from ora_payments where status = 'succeeded') as payments,
        (select coalesce(sum(amount_cents), 0)::int from ora_payments where status = 'succeeded') as payment_cents,
        (select coalesce(sum(coins_spent), 0)::int from ora_readings) as spent,
        (select coalesce(sum(advisor_earned), 0)::int from ora_readings) as earned,
        (select coalesce(sum(platform_fee), 0)::int from ora_readings) as commission,
        (select coalesce(sum(coins), 0)::int from ora_adjustments where kind = 'refund') as refunds
    `;
    const payments = await sql<{
      id: string;
      user_id: string;
      pack_id: string;
      provider: string;
      amount_cents: number;
      currency: string;
      coins: number;
      status: string;
      paid_at: string | null;
      created_at: string;
      display_name: string;
      email: string;
    }>`
      select p.id, p.user_id, p.pack_id, p.provider, p.amount_cents, p.currency, p.coins, p.status,
             p.paid_at, p.created_at, coalesce(pr.display_name, '') as display_name,
             coalesce(pr.email, '') as email
      from ora_payments p
      left join ora_profiles pr on pr.user_id = p.user_id
      order by p.created_at desc
      limit 50
    `;
    const ledger = await sql<{
      id: string;
      user_id: string;
      kind: string;
      amount_coins: number;
      note: string;
      created_at: string;
      display_name: string;
    }>`
      select l.id, l.user_id, l.kind, l.amount_coins, l.note, l.created_at, coalesce(p.display_name, '') as display_name
      from ora_ledger l
      left join ora_profiles p on p.user_id = l.user_id
      order by l.created_at desc
      limit 50
    `;
    const adjustments = await sql<{
      id: string;
      user_id: string;
      coins: number;
      kind: string;
      note: string;
      created_at: string;
    }>`
      select id, user_id, coins, kind, note, created_at from ora_adjustments order by created_at desc limit 30
    `;
    const settings = await loadSettings();
    return {
      currency: settings.currency,
      stats: {
        payments: Number(s?.payments ?? 0),
        paymentCents: Number(s?.payment_cents ?? 0),
        spent: Number(s?.spent ?? 0),
        earned: Number(s?.earned ?? 0),
        commission: Number(s?.commission ?? 0),
        refunds: Number(s?.refunds ?? 0),
      },
      payments: payments.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.display_name,
        email: r.email,
        packId: r.pack_id,
        provider: r.provider,
        amountCents: Number(r.amount_cents),
        currency: r.currency,
        coins: Number(r.coins),
        status: r.status,
        paidAt: r.paid_at ? String(r.paid_at) : "",
        createdAt: String(r.created_at),
      })),
      ledger: ledger.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.display_name,
        kind: r.kind,
        coins: Number(r.amount_coins),
        note: r.note,
        createdAt: String(r.created_at),
      })),
      adjustments: adjustments.map((r) => ({
        id: r.id,
        userId: r.user_id,
        coins: Number(r.coins),
        kind: r.kind,
        note: r.note,
        createdAt: String(r.created_at),
      })),
    };
  });

export const adminRefundPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "finance");
    const sql = await getSql();
    const [row] = await sql<{
      id: string;
      user_id: string;
      coins: number;
      status: string;
    }>`
      select id, user_id, coins, status from ora_payments where id = ${data.id}
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
    const fromPromo = Math.min(promo, Math.max(0, coins - Math.max(0, Number(w.coins) - promo)));
    const updated = await sql<{ user_id: string }>`
      update ora_wallets
      set coins = coins - ${coins},
          promo_coins = greatest(0, promo_coins - ${fromPromo})
      where user_id = ${row.user_id} and coins >= ${coins}
      returning user_id
    `;
    if (!updated.length) throw new Error("Wallet no longer holds the purchased coins.");
    await addLedger(row.user_id, "refund", -coins, 0, `Refund · ${coins}c`, row.id);
    const adj = rid("adj");
    await sql`
      insert into ora_adjustments (id, user_id, reading_id, coins, kind, note)
      values (${adj}, ${row.user_id}, ${row.id}, ${-coins}, 'refund', 'Payment refund')
    `;
    await auditLog(context.userId, "refund_payment", "payment", row.id, `${coins}c`);
    return { ok: true as const, already: false };
  });

export const adminAdjust = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; coins: number; kind: string; note: string; readingId?: string }) => ({
    userId: String(input.userId).slice(0, 128),
    coins: Math.min(5000, Math.max(-5000, Math.floor(Number(input.coins) || 0))),
    kind: ["refund", "adjustment", "gift"].includes(String(input.kind)) ? String(input.kind) : "adjustment",
    note: String(input.note ?? "").trim().slice(0, 200),
    readingId: String(input.readingId ?? "").slice(0, 64),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "finance");
    if (data.coins === 0) throw new Error("Enter a non-zero coin amount.");
    if (data.note.length < 4) throw new Error("Add a reason for this adjustment.");
    const sql = await getSql();
    const [w] = await sql<{ coins: number; promo_coins: number }>`
      select coins, promo_coins from ora_wallets where user_id = ${data.userId}
    `;
    if (!w) throw new Error("No wallet for that account.");
    const next = Number(w.coins) + data.coins;
    if (next < 0) throw new Error("Wallet cannot go below zero.");
    if (data.coins > 0) {
      const promoAdd = data.kind === "refund" ? 0 : data.coins;
      await sql`
        update ora_wallets
        set coins = coins + ${data.coins},
            promo_coins = promo_coins + ${promoAdd}
        where user_id = ${data.userId}
      `;
    } else {
      const debit = Math.abs(data.coins);
      const promo = Number(w.promo_coins);
      const fromPromo = Math.min(promo, debit);
      const updated = await sql<{ user_id: string }>`
        update ora_wallets
        set coins = coins - ${debit},
            promo_coins = greatest(0, promo_coins - ${fromPromo})
        where user_id = ${data.userId} and coins >= ${debit}
        returning user_id
      `;
      if (!updated.length) throw new Error("Wallet cannot go below zero.");
    }
    await addLedger(
      data.userId,
      data.kind,
      data.coins,
      0,
      data.note || `Owner ${data.kind} · ${data.coins}c`,
      data.readingId,
    );
    const id = rid("adj");
    await sql`
      insert into ora_adjustments (id, user_id, reading_id, coins, kind, note)
      values (${id}, ${data.userId}, ${data.readingId}, ${data.coins}, ${data.kind}, ${data.note})
    `;
    if (data.kind === "refund" && data.readingId && data.coins > 0) {
      const [r] = await sql<{ advisor_id: string; advisor_earned: number }>`
        select advisor_id, advisor_earned from ora_readings where id = ${data.readingId}
      `;
      if (r && Number(r.advisor_earned) > 0) {
        const claw = Math.min(Number(r.advisor_earned), data.coins);
        await sql`
          update ora_earnings set status = 'clawed'
          where reading_id = ${data.readingId} and status in ('pending', 'available')
        `;
        await sql`
          update ora_advisors
          set payout_coins = greatest(0, payout_coins - ${claw}),
              pending_coins = greatest(0, pending_coins - ${claw})
          where id = ${r.advisor_id}
        `;
      }
    }
    await auditLog(context.userId, data.kind, "wallet", data.userId, `${data.coins}c · ${data.note}`);
    return { ok: true };
  });

export const adminAdjustMinutes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; seconds: number; note: string }) => ({
    userId: String(input.userId).slice(0, 128),
    seconds: Math.min(3600, Math.max(-3600, Math.floor(Number(input.seconds) || 0))),
    note: String(input.note ?? "").trim().slice(0, 200),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "customers");
    if (data.seconds === 0) throw new Error("Enter a non-zero included-minute amount.");
    if (data.note.length < 4) throw new Error("Add a reason for this adjustment.");
    const sql = await getSql();
    const [w] = await sql<{ bonus_seconds: number }>`
      select bonus_seconds from ora_wallets where user_id = ${data.userId}
    `;
    if (!w) throw new Error("No wallet for that account.");
    const next = Number(w.bonus_seconds) + data.seconds;
    if (next < 0) throw new Error("Included minutes cannot go below zero.");
    await sql`
      update ora_wallets set bonus_seconds = bonus_seconds + ${data.seconds}
      where user_id = ${data.userId}
    `;
    await addLedger(
      data.userId,
      "adjustment",
      0,
      data.seconds,
      data.note,
    );
    await auditLog(
      context.userId,
      "adjust_minutes",
      "wallet",
      data.userId,
      `${data.seconds}s · ${data.note}`,
    );
    return { ok: true };
  });

export const adminTrusted = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { month?: string; t?: number }) => ({
    month: String(input?.month ?? "").slice(0, 10),
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "advisors");
    await ensureMonthlyRankTable();
    await maybeRefreshMonthlyRanks();
    const current = monthStartUtc();
    const month = /^\d{4}-\d{2}-01$/.test(data.month) ? data.month : current;
    const sql = await getSql();
    const ranking = await sql<{
      advisor_id: string;
      name: string;
      month: string;
      eligible_free_clients: number;
      converted_paid_clients: number;
      conversion_rate: string | number;
      paid_session_revenue: number;
      eligible: boolean;
      rank: number | null;
    }>`
      select r.advisor_id, a.name, r.month::text as month, r.eligible_free_clients, r.converted_paid_clients,
             r.conversion_rate, r.paid_session_revenue, r.eligible, r.rank
      from ora_monthly_rank r
      join ora_advisors a on a.id = r.advisor_id
      where r.month = ${month}::date and r.rank is not null and r.rank between 1 and 10
      order by r.rank asc
    `.catch(() => []);
    const months = await sql<{ month: string }>`
      select distinct r.month::text as month
      from ora_monthly_rank r
      where r.rank is not null
      order by r.month desc
      limit 24
    `.catch(() => []);
    return {
      month,
      current,
      months: months.map((m) => String(m.month).slice(0, 10)),
      ranking: ranking.map((row) => ({
        advisorId: row.advisor_id,
        name: row.name,
        month: String(row.month).slice(0, 10),
        eligibleFreeClients: Number(row.eligible_free_clients) || 0,
        convertedPaidClients: Number(row.converted_paid_clients) || 0,
        conversionRate: Number(row.conversion_rate) || 0,
        paidSessionRevenue: Number(row.paid_session_revenue) || 0,
        rank: row.rank != null && Number(row.rank) > 0 ? Number(row.rank) : null,
        eligible: Boolean(row.eligible),
      })),
    };
  });

export const adminPayouts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "payouts");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      advisor_id: string;
      coins: number;
      usd: string;
      status: string;
      created_at: string;
      note: string;
      name: string;
    }>`
      select p.id, p.advisor_id, p.coins, p.usd, p.status, p.created_at, p.note, a.name
      from ora_payouts p
      join ora_advisors a on a.id = p.advisor_id
      order by p.created_at desc
      limit 50
    `;
    return rows.map((r) => ({
      id: r.id,
      advisorId: r.advisor_id,
      name: r.name,
      coins: Number(r.coins),
      usd: Number(r.usd),
      status: r.status,
      note: r.note,
      createdAt: String(r.created_at),
    }));
  });

export const adminDecidePayout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; accept: boolean; note?: string }) => ({
    id: String(input.id).slice(0, 64),
    accept: Boolean(input.accept),
    note: String(input.note ?? "").trim().slice(0, 200),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "payouts");
    const sql = await getSql();
    const [row] = await sql<{ id: string; advisor_id: string; coins: number; status: string }>`
      select id, advisor_id, coins, status from ora_payouts where id = ${data.id}
    `;
    if (!row || row.status !== "requested") throw new Error("That payout is already decided.");
    if (data.accept) {
      const paid = await sql<{ id: string }>`
        update ora_payouts
        set status = 'paid', decided_at = now(), approved_at = now(), paid_at = now(), note = ${data.note}
        where id = ${row.id} and status = 'requested'
        returning id
      `;
      if (!paid.length) throw new Error("That payout is already decided.");
    } else {
      const rejected = await sql<{ id: string }>`
        update ora_payouts set status = 'rejected', decided_at = now(), note = ${data.note}
        where id = ${row.id} and status = 'requested'
        returning id
      `;
      if (!rejected.length) throw new Error("That payout is already decided.");
      await sql`update ora_advisors set payout_coins = payout_coins + ${Number(row.coins)} where id = ${row.advisor_id}`;
    }
    await auditLog(context.userId, data.accept ? "payout_paid" : "payout_rejected", "payout", row.id, `${row.coins}c`);
    return { ok: true };
  });

export const adminSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "settings");
    return loadSettings();
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<SiteSettings>) => ({
    name: String(input.name ?? "Ora").trim().slice(0, 40) || "Ora",
    logoUrl: String(input.logoUrl ?? "").slice(0, 500),
    supportEmail: String(input.supportEmail ?? "").trim().slice(0, 120),
    currency: String(input.currency ?? "USD").trim().slice(0, 8) || "USD",
    platformShare: Math.min(50, Math.max(0, Math.floor(Number(input.platformShare) || 30))),
    welcomeSeconds: Math.min(1800, Math.max(0, Math.floor(Number(input.welcomeSeconds) || 0))),
    weeklySeconds: Math.min(1800, Math.max(0, Math.floor(Number(input.weeklySeconds) || 0))),
    welcomeCoins: Math.min(500, Math.max(0, Math.floor(Number(input.welcomeCoins) || 0))),
    minPayoutCoins: Math.min(5000, Math.max(1, Math.floor(Number(input.minPayoutCoins) || 50))),
    payoutHoldHours: Math.min(168, Math.max(0, Math.floor(Number(input.payoutHoldHours) || 0))),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "settings");
    const sql = await getSql();
    await sql`
      update ora_settings
      set name = ${data.name}, logo_url = ${data.logoUrl}, support_email = ${data.supportEmail},
          currency = ${data.currency}, platform_share = ${data.platformShare},
          welcome_seconds = ${data.welcomeSeconds}, weekly_seconds = ${data.weeklySeconds},
          welcome_coins = ${data.welcomeCoins}, min_payout_coins = ${data.minPayoutCoins},
          payout_hold_hours = ${data.payoutHoldHours}
      where id = 'ora'
    `;
    invalidateSettings();
    await auditLog(
      context.userId,
      "save_settings",
      "settings",
      "ora",
      `${data.name} · house ${data.platformShare}% · hold ${data.payoutHoldHours}h`,
    );
    return loadSettings();
  });

export const adminAllCategories = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "categories");
    return loadCategories(false);
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; name: string; active?: boolean }) => ({
    id: String(input.id ?? "").slice(0, 64),
    name: String(input.name).trim().slice(0, 40),
    active: input.active !== false,
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "categories");
    if (data.name.length < 2) throw new Error("Category name is too short.");
    const sql = await getSql();
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
    if (data.id) {
      await sql`update ora_categories set name = ${data.name}, slug = ${slug}, active = ${data.active} where id = ${data.id}`;
      await auditLog(context.userId, "edit_category", "category", data.id, data.name);
    } else {
      const [max] = await sql<{ n: number }>`select coalesce(max(sort_order), 0)::int as n from ora_categories`;
      const id = rid("cat");
      await sql`
        insert into ora_categories (id, name, slug, sort_order, active)
        values (${id}, ${data.name}, ${`${slug}-${id.slice(-4)}`}, ${(max?.n ?? 0) + 1}, ${data.active})
      `;
      await auditLog(context.userId, "add_category", "category", id, data.name);
    }
    invalidateCategories();
    return loadCategories(false);
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input.id).slice(0, 64) }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "categories");
    const sql = await getSql();
    await sql`delete from ora_categories where id = ${data.id}`;
    await auditLog(context.userId, "delete_category", "category", data.id, "");
    invalidateCategories();
    return loadCategories(false);
  });

export const adminReorderCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; dir: "up" | "down" }) => ({
    id: String(input.id).slice(0, 64),
    dir: input.dir === "down" ? ("down" as const) : ("up" as const),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "categories");
    const cats = await loadCategories(false);
    const i = cats.findIndex((c) => c.id === data.id);
    if (i < 0) return cats;
    const j = data.dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= cats.length) return cats;
    const sql = await getSql();
    const a = cats[i];
    const b = cats[j];
    await sql`update ora_categories set sort_order = ${b.sortOrder} where id = ${a.id}`;
    await sql`update ora_categories set sort_order = ${a.sortOrder} where id = ${b.id}`;
    await auditLog(context.userId, "reorder_category", "category", data.id, data.dir);
    invalidateCategories();
    return loadCategories(false);
  });

export const adminPromos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "promos");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      kind: string;
      amount: number;
      active: boolean;
      note: string;
      created_at: string;
    }>`
      select id, name, kind, amount, active, note, created_at from ora_promos order by created_at desc
    `;
    return {
      settings: await loadSettings(),
      promos: rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        amount: Number(r.amount),
        active: Boolean(r.active),
        note: r.note,
        createdAt: String(r.created_at),
      })),
    };
  });

export const adminSavePromo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; name: string; kind: string; amount: number; active?: boolean; note?: string }) => ({
    id: String(input.id ?? "").slice(0, 64),
    name: String(input.name).trim().slice(0, 80),
    kind: input.kind === "coins" ? "coins" : "minutes",
    amount: Math.min(1800, Math.max(1, Math.floor(Number(input.amount) || 0))),
    active: input.active !== false,
    note: String(input.note ?? "").trim().slice(0, 200),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "promos");
    if (!data.name) throw new Error("Name the offer.");
    const sql = await getSql();
    if (data.id) {
      await sql`
        update ora_promos set name = ${data.name}, kind = ${data.kind}, amount = ${data.amount},
          active = ${data.active}, note = ${data.note}
        where id = ${data.id}
      `;
    } else {
      const id = rid("pro");
      await sql`
        insert into ora_promos (id, name, kind, amount, active, note)
        values (${id}, ${data.name}, ${data.kind}, ${data.amount}, ${data.active}, ${data.note})
      `;
    }
    await auditLog(context.userId, "save_promo", "promo", data.id || "new", data.name);
    return { ok: true };
  });

export const adminGrantPromo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; promoId: string }) => ({
    userId: String(input.userId).slice(0, 128),
    promoId: String(input.promoId).slice(0, 64),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "promos");
    const sql = await getSql();
    const [promo] = await sql<{ name: string; kind: string; amount: number; active: boolean }>`
      select name, kind, amount, active from ora_promos where id = ${data.promoId}
    `;
    if (!promo || !promo.active) throw new Error("Offer is not active.");
    if (promo.kind === "coins") {
      const n = Number(promo.amount);
      await sql`
        update ora_wallets
        set coins = coins + ${n}, promo_coins = promo_coins + ${n}
        where user_id = ${data.userId}
      `;
      await addLedger(data.userId, "promo", n, 0, `Promo · ${promo.name}`);
    } else {
      const secs = Number(promo.amount) * 60;
      await sql`update ora_wallets set bonus_seconds = bonus_seconds + ${secs} where user_id = ${data.userId}`;
      await addLedger(data.userId, "promo", 0, secs, `Promo · ${promo.name}`);
    }
    await auditLog(context.userId, "grant_promo", "wallet", data.userId, promo.name);
    return { ok: true };
  });

export const adminReviews = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(stamp)
  .handler(async ({ context }) => {
    await actor(context.userId, "reviews");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      rating: number;
      body: string;
      hidden: boolean;
      created_at: string;
      advisor: string;
      advisor_id: string;
      client: string;
    }>`
      select r.id, r.rating, r.body, r.hidden, r.created_at, a.name as advisor, r.advisor_id,
             coalesce(p.display_name, 'Client') as client
      from ora_reviews r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_profiles p on p.user_id = r.client_id
      order by r.created_at desc
      limit 60
    `;
    return {
      reviews: rows.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        body: r.body,
        hidden: Boolean(r.hidden),
        createdAt: String(r.created_at),
        advisor: r.advisor,
        advisorId: r.advisor_id,
        client: r.client,
      })),
      stats: {
        total: rows.length,
        visible: rows.filter((r) => !r.hidden).length,
        hidden: rows.filter((r) => r.hidden).length,
        average: (() => {
          const vis = rows.filter((r) => !r.hidden);
          if (!vis.length) return 0;
          return vis.reduce((n, r) => n + Number(r.rating), 0) / vis.length;
        })(),
      },
    };
  });

export const adminModerateReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; hidden: boolean }) => ({
    id: String(input.id).slice(0, 64),
    hidden: Boolean(input.hidden),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "reviews");
    const sql = await getSql();
    const [row] = await sql<{ advisor_id: string }>`select advisor_id from ora_reviews where id = ${data.id}`;
    if (!row) throw new Error("Review not found.");
    await sql`update ora_reviews set hidden = ${data.hidden} where id = ${data.id}`;
    const [agg] = await sql<{ avg: string; n: number }>`
      select coalesce(avg(rating), 5)::numeric(2,1) as avg, count(*)::int as n
      from ora_reviews where advisor_id = ${row.advisor_id} and hidden = false
    `;
    await sql`
      update ora_advisors set rating = ${Number(agg?.avg ?? 5)}, reviews = ${Number(agg?.n ?? 0)}
      where id = ${row.advisor_id}
    `;
    await auditLog(context.userId, data.hidden ? "hide_review" : "show_review", "review", data.id, "");
    return { ok: true };
  });

export const adminReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { days?: number; t?: number }) => ({
    days: Math.min(90, Math.max(7, Math.floor(Number(input?.days) || 14))),
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context, data }) => {
    await actor(context.userId, "reports");
    const sql = await getSql();
    const rows = await sql<{
      day: string;
      sessions: number;
      spent: number;
      earned: number;
      fee: number;
    }>`
      select to_char(date_trunc('day', started_at), 'YYYY-MM-DD') as day,
             count(*)::int as sessions,
             coalesce(sum(coins_spent), 0)::int as spent,
             coalesce(sum(advisor_earned), 0)::int as earned,
             coalesce(sum(platform_fee), 0)::int as fee
      from ora_readings
      where started_at >= now() - interval '90 days'
      group by 1
      order by 1
    `;
    const from = new Date();
    from.setDate(from.getDate() - data.days);
    const fromStr = from.toISOString().slice(0, 10);
    return {
      days: data.days,
      coinsPerDollar: COINS_PER_DOLLAR,
      rows: rows
        .filter((r) => r.day >= fromStr)
        .map((r) => ({
          day: r.day,
          sessions: Number(r.sessions),
          spent: Number(r.spent),
          earned: Number(r.earned),
          fee: Number(r.fee),
        })),
    };
  });

export const adminAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { t?: number }) => ({
    t: Math.floor(Number(input?.t) || Date.now()),
  }))
  .handler(async ({ context }) => {
    await actor(context.userId, "audit");
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      actor_id: string;
      actor_name: string;
      act: string;
      target_type: string;
      target_id: string;
      body: string;
      created_at: string;
    }>(
      `select l.id, l.actor_id, coalesce(nullif(p.display_name, ''), l.actor_id) as actor_name,
              l.act, l.target_type, l.target_id, l.body, l.created_at
       from ora_owner_log l
       left join ora_profiles p on p.user_id = l.actor_id
       order by l.created_at desc
       limit 80`,
    );
    return {
      total: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actor: r.actor_name,
        action: r.act,
        targetType: r.target_type,
        targetId: r.target_id,
        detail: r.body,
        createdAt: String(r.created_at),
      })),
    };
  });

export type { Advisor, Category, SiteSettings };
export { formatClock, COINS_PER_DOLLAR, formatMoney } from "@/lib/ora";
import { r as createServerFn } from "./ssr.mjs";
import { i as getSql, t as authMiddleware } from "./middleware-DaHnGAQf.mjs";
import { D as invalidateSettings, E as invalidateCategories, L as requireAdmin, M as loadSettings, N as mapAdvisor, R as revokeAdmin, a as auditLog, c as closeReadingById, j as loadCategories, n as addLedger, w as grantAdmin, z as rid } from "./ora-qKRq3G77.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ora-admin-vMFyCAt1.js
async function actor(userId, permission) {
	await requireAdmin(userId, permission);
	return userId;
}
function stamp(input) {
	return { t: Math.floor(Number(input?.t) || Date.now()) };
}
var adminSession_createServerFn_handler = createServerRpc({
	id: "89d826a7feb503e62e6147cf25a5211fcee41df86b463c05986d7b31b3807ce9",
	name: "adminSession",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminSession.__executeServer(opts));
var adminSession = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminSession_createServerFn_handler, async ({ context }) => {
	await actor(context.userId);
	const [p] = await (await getSql())`
      select display_name, email from ora_profiles where user_id = ${context.userId}
    `;
	return {
		ok: true,
		userId: context.userId,
		name: p?.display_name || "Owner",
		email: p?.email || ""
	};
});
var adminOverview_createServerFn_handler = createServerRpc({
	id: "875618004ca83473a8c079a6564a884fee3943548119ca1e3ddc5f80ad7e3e3f",
	name: "adminOverview",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminOverview.__executeServer(opts));
var adminOverview = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminOverview_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "overview");
	const sql = await getSql();
	const [s] = await sql`
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
        (select coalesce(sum(cost), 0)::int from ora_v_sessions where start_time >= date_trunc('day', now())) as today_sales
    `;
	const live = await sql`
      select r.id, r.seconds, r.coins_spent, coalesce(p.display_name, 'Client') as client,
             a.name as advisor, r.started_at
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_profiles p on p.user_id = r.client_id
      where r.status = 'live'
      order by r.started_at desc
      limit 8
    `;
	return {
		settings: await loadSettings(),
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
			todaySales: Number(s?.today_sales ?? 0)
		},
		live: live.map((r) => ({
			id: r.id,
			seconds: Number(r.seconds),
			coinsSpent: Number(r.coins_spent),
			client: r.client,
			advisor: r.advisor,
			startedAt: String(r.started_at)
		}))
	};
});
var adminAdvisors_createServerFn_handler = createServerRpc({
	id: "9289a40cb0e0b3b7f9b2aca62ce03df9bafec57acc25db704b2e6c79976bca05",
	name: "adminAdvisors",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminAdvisors.__executeServer(opts));
var adminAdvisors = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminAdvisors_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "advisors");
	const sql = await getSql();
	const applications = await sql`
      select id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, status, created_at, legal_name, languages, years
      from ora_applications order by created_at desc limit 50
    `;
	const advisors = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors order by name
    `;
	return {
		applications: applications.map((a) => ({
			...a,
			created_at: String(a.created_at)
		})),
		advisors: advisors.map(mapAdvisor)
	};
});
var adminUpdateAdvisor_createServerFn_handler = createServerRpc({
	id: "0142e604076d5ae1a6bb465af1d6d05d629ac3c722d53fd9d0820b70bc572aa1",
	name: "adminUpdateAdvisor",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminUpdateAdvisor.__executeServer(opts));
var adminUpdateAdvisor = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	name: String(input.name).trim().slice(0, 80),
	bio: String(input.bio).trim().slice(0, 1200),
	specialties: String(input.specialties).trim().slice(0, 120),
	rateCoins: Math.min(80, Math.max(8, Math.floor(Number(input.rateCoins) || 20))),
	status: [
		"live",
		"paused",
		"suspended"
	].includes(String(input.status)) ? String(input.status) : "paused",
	trusted: Boolean(input.trusted),
	years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
	languages: String(input.languages).trim().slice(0, 80) || "English"
})).handler(adminUpdateAdvisor_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "advisors");
	if (!data.name) throw new Error("Name is required.");
	const sql = await getSql();
	if (data.status !== "live") await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, status = ${data.status}, trusted = ${data.trusted},
            years = ${data.years}, languages = ${data.languages}, online = false, busy = false
        where id = ${data.id}
      `;
	else await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, status = ${data.status}, trusted = ${data.trusted},
            years = ${data.years}, languages = ${data.languages}
        where id = ${data.id}
      `;
	await auditLog(context.userId, "edit_advisor", "advisor", data.id, `${data.name} · ${data.status} · ${data.rateCoins}c`);
	return { ok: true };
});
var adminCustomers_createServerFn_handler = createServerRpc({
	id: "e8cd84f81633f3b7894136303933d61ce6609a07038d4c930a9ac20399f9740f",
	name: "adminCustomers",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminCustomers.__executeServer(opts));
var adminCustomers = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({
	q: String(input?.q ?? "").trim().slice(0, 80),
	t: Math.floor(Number(input?.t) || Date.now())
})).handler(adminCustomers_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "customers");
	const sql = await getSql();
	const q = data.q.toLowerCase();
	const rows = await sql`
      select p.user_id, p.display_name, p.email, p.role, p.status,
             coalesce(w.coins, 0) as coins, coalesce(w.bonus_seconds, 0) as bonus_seconds,
             coalesce(w.weekly_seconds, 0) as weekly_seconds, coalesce(w.subscribed, false) as subscribed
      from ora_profiles p
      left join ora_wallets w on w.user_id = p.user_id
      order by p.display_name
      limit 80
    `;
	return (q ? rows.filter((r) => r.display_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.user_id.toLowerCase().includes(q)) : rows).map((r) => ({
		userId: r.user_id,
		name: r.display_name,
		email: r.email,
		role: r.role,
		status: r.status || "active",
		coins: Number(r.coins),
		bonusSeconds: Number(r.bonus_seconds),
		weeklySeconds: Number(r.weekly_seconds),
		subscribed: Boolean(r.subscribed)
	}));
});
var adminSetCustomer_createServerFn_handler = createServerRpc({
	id: "3fdd605fc76b9dd4f179c81375270037dcc10fd7d78c4584c7187c76ee297b43",
	name: "adminSetCustomer",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminSetCustomer.__executeServer(opts));
var adminSetCustomer = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	status: input.status === "suspended" ? "suspended" : input.status === "active" ? "active" : "",
	role: input.role === "admin" ? "admin" : input.role === "client" ? "client" : ""
})).handler(adminSetCustomer_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "customers");
	if (data.userId === context.userId && (data.status === "suspended" || data.role === "client")) throw new Error("You cannot suspend or demote your own owner account.");
	const sql = await getSql();
	if (data.status) {
		await sql`update ora_profiles set status = ${data.status} where user_id = ${data.userId}`;
		if (data.status === "suspended") await sql`update ora_advisors set online = false, busy = false, status = 'suspended' where user_id = ${data.userId} and status = 'live'`;
		await auditLog(context.userId, data.status === "suspended" ? "suspend_user" : "reactivate_user", "profile", data.userId, data.status);
	}
	if (data.role) {
		if (data.role === "client") {
			const [n] = await sql`select count(*)::int as n from ora_admins`;
			const [target] = await sql`select role from ora_admins where user_id = ${data.userId}`;
			if (target && Number(n?.n ?? 0) <= 1) throw new Error("Keep at least one owner.");
			await revokeAdmin(data.userId);
		} else if (data.role === "admin") await grantAdmin(data.userId, context.userId, "admin");
		await auditLog(context.userId, "set_role", "profile", data.userId, data.role);
	}
	return { ok: true };
});
var adminCustomerActivity_createServerFn_handler = createServerRpc({
	id: "6a0b695bb8769a70415f4ea947e1b2c3508b87d6fa7ad2908ba05098ed154676",
	name: "adminCustomerActivity",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminCustomerActivity.__executeServer(opts));
var adminCustomerActivity = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	t: Math.floor(Number(input.t) || Date.now())
})).handler(adminCustomerActivity_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "customers");
	return (await (await getSql())`
      select id, kind, amount_coins, seconds, note, created_at
      from ora_ledger where user_id = ${data.userId} order by created_at desc limit 40
    `).map((r) => ({
		id: r.id,
		kind: r.kind,
		coins: Number(r.amount_coins),
		seconds: Number(r.seconds),
		note: r.note,
		createdAt: String(r.created_at)
	}));
});
var adminSessions_createServerFn_handler = createServerRpc({
	id: "4afd7e319cbfecb711192947b9f6931f3acdc843f09a2c2dcefad02050218724",
	name: "adminSessions",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminSessions.__executeServer(opts));
var adminSessions = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminSessions_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "sessions");
	return (await (await getSql())`
      select r.id, r.status, r.seconds, r.coins_spent, r.advisor_earned, r.platform_fee, r.rate_coins,
             r.started_at, r.ended_at, coalesce(p.display_name, 'Client') as client, a.name as advisor
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_profiles p on p.user_id = r.client_id
      order by r.started_at desc
      limit 60
    `).map((r) => ({
		id: r.id,
		status: r.status,
		seconds: Number(r.seconds),
		coinsSpent: Number(r.coins_spent),
		advisorEarned: Number(r.advisor_earned),
		platformFee: Number(r.platform_fee),
		rateCoins: Number(r.rate_coins) || 20,
		startedAt: String(r.started_at),
		endedAt: r.ended_at ? String(r.ended_at) : "",
		client: r.client,
		advisor: r.advisor
	}));
});
var adminEndSession_createServerFn_handler = createServerRpc({
	id: "98ea12cb348fc7d01e107a2e4a6caae5081a32e46907d0229beea9ac9d974b3d",
	name: "adminEndSession",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminEndSession.__executeServer(opts));
var adminEndSession = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(adminEndSession_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "sessions");
	await closeReadingById(data.id);
	await auditLog(context.userId, "end_session", "reading", data.id, "Forced end");
	return { ok: true };
});
var adminFinance_createServerFn_handler = createServerRpc({
	id: "52c1c59cb511a4cfdc4c570b22bb5bb9d162ce0b72ea63b016097743d3e5f3b9",
	name: "adminFinance",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminFinance.__executeServer(opts));
var adminFinance = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminFinance_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "finance");
	const sql = await getSql();
	const [s] = await sql`
      select
        (select coalesce(sum(coins), 0)::int from ora_payments where status = 'succeeded') as payments,
        (select coalesce(sum(amount_cents), 0)::int from ora_payments where status = 'succeeded') as payment_cents,
        (select coalesce(sum(coins_spent), 0)::int from ora_readings) as spent,
        (select coalesce(sum(advisor_earned), 0)::int from ora_readings) as earned,
        (select coalesce(sum(platform_fee), 0)::int from ora_readings) as commission,
        (select coalesce(sum(coins), 0)::int from ora_adjustments where kind = 'refund') as refunds
    `;
	const payments = await sql`
      select p.id, p.user_id, p.pack_id, p.provider, p.amount_cents, p.currency, p.coins, p.status,
             p.paid_at, p.created_at, coalesce(pr.display_name, '') as display_name
      from ora_payments p
      left join ora_profiles pr on pr.user_id = p.user_id
      order by p.created_at desc
      limit 50
    `;
	const ledger = await sql`
      select l.id, l.user_id, l.kind, l.amount_coins, l.note, l.created_at, coalesce(p.display_name, '') as display_name
      from ora_ledger l
      left join ora_profiles p on p.user_id = l.user_id
      order by l.created_at desc
      limit 50
    `;
	const adjustments = await sql`
      select id, user_id, coins, kind, note, created_at from ora_adjustments order by created_at desc limit 30
    `;
	return {
		currency: (await loadSettings()).currency,
		stats: {
			payments: Number(s?.payments ?? 0),
			paymentCents: Number(s?.payment_cents ?? 0),
			spent: Number(s?.spent ?? 0),
			earned: Number(s?.earned ?? 0),
			commission: Number(s?.commission ?? 0),
			refunds: Number(s?.refunds ?? 0)
		},
		payments: payments.map((r) => ({
			id: r.id,
			userId: r.user_id,
			name: r.display_name,
			packId: r.pack_id,
			provider: r.provider,
			amountCents: Number(r.amount_cents),
			currency: r.currency,
			coins: Number(r.coins),
			status: r.status,
			paidAt: r.paid_at ? String(r.paid_at) : "",
			createdAt: String(r.created_at)
		})),
		ledger: ledger.map((r) => ({
			id: r.id,
			userId: r.user_id,
			name: r.display_name,
			kind: r.kind,
			coins: Number(r.amount_coins),
			note: r.note,
			createdAt: String(r.created_at)
		})),
		adjustments: adjustments.map((r) => ({
			id: r.id,
			userId: r.user_id,
			coins: Number(r.coins),
			kind: r.kind,
			note: r.note,
			createdAt: String(r.created_at)
		}))
	};
});
var adminRefundPayment_createServerFn_handler = createServerRpc({
	id: "d002d964f9e4e615ef9fe587a66f85b361805be8913b4b2cfa43ed50edf72fb3",
	name: "adminRefundPayment",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminRefundPayment.__executeServer(opts));
var adminRefundPayment = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(adminRefundPayment_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "finance");
	const sql = await getSql();
	const [row] = await sql`
      select id, user_id, coins, status from ora_payments where id = ${data.id}
    `;
	if (!row) throw new Error("Payment not found.");
	if (row.status === "refunded") return {
		ok: true,
		already: true
	};
	if (row.status !== "succeeded") throw new Error("Only successful payments can be refunded.");
	const coins = Number(row.coins);
	const [w] = await sql`
      select coins, promo_coins from ora_wallets where user_id = ${row.user_id}
    `;
	if (!w) throw new Error("No wallet.");
	if (Number(w.coins) < coins) throw new Error("Wallet no longer holds the purchased coins.");
	if (!(await sql`
      update ora_payments set status = 'refunded', updated_at = now()
      where id = ${row.id} and status = 'succeeded'
      returning id
    `).length) return {
		ok: true,
		already: true
	};
	const promo = Number(w.promo_coins);
	if (!(await sql`
      update ora_wallets
      set coins = coins - ${coins},
          promo_coins = greatest(0, promo_coins - ${Math.min(promo, Math.max(0, coins - Math.max(0, Number(w.coins) - promo)))})
      where user_id = ${row.user_id} and coins >= ${coins}
      returning user_id
    `).length) throw new Error("Wallet no longer holds the purchased coins.");
	await addLedger(row.user_id, "refund", -coins, 0, `Refund · ${coins}c`, row.id);
	await sql`
      insert into ora_adjustments (id, user_id, reading_id, coins, kind, note)
      values (${rid("adj")}, ${row.user_id}, ${row.id}, ${-coins}, 'refund', 'Payment refund')
    `;
	await auditLog(context.userId, "refund_payment", "payment", row.id, `${coins}c`);
	return {
		ok: true,
		already: false
	};
});
var adminAdjust_createServerFn_handler = createServerRpc({
	id: "dbb9eb082d3ae2ca5c4df7959875c4b205ac36ea4d4482d3287374aac31da40e",
	name: "adminAdjust",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminAdjust.__executeServer(opts));
var adminAdjust = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	coins: Math.min(5e3, Math.max(-5e3, Math.floor(Number(input.coins) || 0))),
	kind: [
		"refund",
		"adjustment",
		"gift"
	].includes(String(input.kind)) ? String(input.kind) : "adjustment",
	note: String(input.note ?? "").trim().slice(0, 200),
	readingId: String(input.readingId ?? "").slice(0, 64)
})).handler(adminAdjust_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "finance");
	if (data.coins === 0) throw new Error("Enter a non-zero coin amount.");
	const sql = await getSql();
	const [w] = await sql`
      select coins, promo_coins from ora_wallets where user_id = ${data.userId}
    `;
	if (!w) throw new Error("No wallet for that account.");
	if (Number(w.coins) + data.coins < 0) throw new Error("Wallet cannot go below zero.");
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
		if (!(await sql`
        update ora_wallets
        set coins = coins - ${debit},
            promo_coins = greatest(0, promo_coins - ${Math.min(promo, debit)})
        where user_id = ${data.userId} and coins >= ${debit}
        returning user_id
      `).length) throw new Error("Wallet cannot go below zero.");
	}
	await addLedger(data.userId, data.kind, data.coins, 0, data.note || `Owner ${data.kind} · ${data.coins}c`, data.readingId);
	await sql`
      insert into ora_adjustments (id, user_id, reading_id, coins, kind, note)
      values (${rid("adj")}, ${data.userId}, ${data.readingId}, ${data.coins}, ${data.kind}, ${data.note})
    `;
	if (data.kind === "refund" && data.readingId && data.coins > 0) {
		const [r] = await sql`
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
var adminPayouts_createServerFn_handler = createServerRpc({
	id: "8254fbedeed338370bce0bde0676da7d684a7320a338dbf62bac66528f8d03a6",
	name: "adminPayouts",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminPayouts.__executeServer(opts));
var adminPayouts = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminPayouts_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "payouts");
	return (await (await getSql())`
      select p.id, p.advisor_id, p.coins, p.usd, p.status, p.created_at, p.note, a.name
      from ora_payouts p
      join ora_advisors a on a.id = p.advisor_id
      order by p.created_at desc
      limit 50
    `).map((r) => ({
		id: r.id,
		advisorId: r.advisor_id,
		name: r.name,
		coins: Number(r.coins),
		usd: Number(r.usd),
		status: r.status,
		note: r.note,
		createdAt: String(r.created_at)
	}));
});
var adminDecidePayout_createServerFn_handler = createServerRpc({
	id: "355fccfe24a6e8bacf2b4b5d1170d13b5e5baf8a930e437487324c8ebddb4956",
	name: "adminDecidePayout",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminDecidePayout.__executeServer(opts));
var adminDecidePayout = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	accept: Boolean(input.accept),
	note: String(input.note ?? "").trim().slice(0, 200)
})).handler(adminDecidePayout_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "payouts");
	const sql = await getSql();
	const [row] = await sql`
      select id, advisor_id, coins, status from ora_payouts where id = ${data.id}
    `;
	if (!row || row.status !== "requested") throw new Error("That payout is already decided.");
	if (data.accept) await sql`
        update ora_payouts
        set status = 'paid', decided_at = now(), approved_at = now(), paid_at = now(), note = ${data.note}
        where id = ${row.id}
      `;
	else {
		await sql`
        update ora_payouts set status = 'rejected', decided_at = now(), note = ${data.note}
        where id = ${row.id}
      `;
		await sql`update ora_advisors set payout_coins = payout_coins + ${Number(row.coins)} where id = ${row.advisor_id}`;
	}
	await auditLog(context.userId, data.accept ? "payout_paid" : "payout_rejected", "payout", row.id, `${row.coins}c`);
	return { ok: true };
});
var adminSettings_createServerFn_handler = createServerRpc({
	id: "f41a653c8eb7649d53804d889e352331afedcc7c3ef21517bb49b2eaea91d7e0",
	name: "adminSettings",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminSettings.__executeServer(opts));
var adminSettings = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminSettings_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "settings");
	return loadSettings();
});
var adminSaveSettings_createServerFn_handler = createServerRpc({
	id: "e02049ae3f3315bf2665c3b590439345e2ad6b0b95ff09c1669c271b6a8fbf15",
	name: "adminSaveSettings",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminSaveSettings.__executeServer(opts));
var adminSaveSettings = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	name: String(input.name ?? "Ora").trim().slice(0, 40) || "Ora",
	logoUrl: String(input.logoUrl ?? "").slice(0, 500),
	supportEmail: String(input.supportEmail ?? "").trim().slice(0, 120),
	currency: String(input.currency ?? "USD").trim().slice(0, 8) || "USD",
	platformShare: Math.min(50, Math.max(0, Math.floor(Number(input.platformShare) || 30))),
	welcomeSeconds: Math.min(1800, Math.max(0, Math.floor(Number(input.welcomeSeconds) || 0))),
	weeklySeconds: Math.min(1800, Math.max(0, Math.floor(Number(input.weeklySeconds) || 0))),
	welcomeCoins: Math.min(500, Math.max(0, Math.floor(Number(input.welcomeCoins) || 0))),
	minPayoutCoins: Math.min(5e3, Math.max(1, Math.floor(Number(input.minPayoutCoins) || 50))),
	payoutHoldHours: Math.min(168, Math.max(0, Math.floor(Number(input.payoutHoldHours) || 0)))
})).handler(adminSaveSettings_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "settings");
	await (await getSql())`
      update ora_settings
      set name = ${data.name}, logo_url = ${data.logoUrl}, support_email = ${data.supportEmail},
          currency = ${data.currency}, platform_share = ${data.platformShare},
          welcome_seconds = ${data.welcomeSeconds}, weekly_seconds = ${data.weeklySeconds},
          welcome_coins = ${data.welcomeCoins}, min_payout_coins = ${data.minPayoutCoins},
          payout_hold_hours = ${data.payoutHoldHours}
      where id = 'ora'
    `;
	invalidateSettings();
	await auditLog(context.userId, "save_settings", "settings", "ora", `${data.name} · house ${data.platformShare}% · hold ${data.payoutHoldHours}h`);
	return loadSettings();
});
var adminAllCategories_createServerFn_handler = createServerRpc({
	id: "e8ea43a9789082a4873650034e8350a93df4519636be7388c943bc62a989d0c3",
	name: "adminAllCategories",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminAllCategories.__executeServer(opts));
var adminAllCategories = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminAllCategories_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "categories");
	return loadCategories(false);
});
var adminSaveCategory_createServerFn_handler = createServerRpc({
	id: "b8770b339a98c088a26e7fde6fe7a6b5b996ab4159ec7d1d1bdb2e8324d0bf72",
	name: "adminSaveCategory",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminSaveCategory.__executeServer(opts));
var adminSaveCategory = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id ?? "").slice(0, 64),
	name: String(input.name).trim().slice(0, 40),
	active: input.active !== false
})).handler(adminSaveCategory_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "categories");
	if (data.name.length < 2) throw new Error("Category name is too short.");
	const sql = await getSql();
	const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
	if (data.id) {
		await sql`update ora_categories set name = ${data.name}, slug = ${slug}, active = ${data.active} where id = ${data.id}`;
		await auditLog(context.userId, "edit_category", "category", data.id, data.name);
	} else {
		const [max] = await sql`select coalesce(max(sort_order), 0)::int as n from ora_categories`;
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
var adminDeleteCategory_createServerFn_handler = createServerRpc({
	id: "f1ad0b441c268d1fed4fe643792340d5cc5e21dd4a6027ca2e485970eef95b21",
	name: "adminDeleteCategory",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminDeleteCategory.__executeServer(opts));
var adminDeleteCategory = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(adminDeleteCategory_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "categories");
	await (await getSql())`delete from ora_categories where id = ${data.id}`;
	await auditLog(context.userId, "delete_category", "category", data.id, "");
	invalidateCategories();
	return loadCategories(false);
});
var adminReorderCategory_createServerFn_handler = createServerRpc({
	id: "5e906db3b5d075c7f33bb5e8f7a3785e5a6e091a5ce024dec438c56ec8699b94",
	name: "adminReorderCategory",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminReorderCategory.__executeServer(opts));
var adminReorderCategory = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	dir: input.dir === "down" ? "down" : "up"
})).handler(adminReorderCategory_createServerFn_handler, async ({ context, data }) => {
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
var adminPromos_createServerFn_handler = createServerRpc({
	id: "b76c3fa98435bf05747c721616b8e80dca7ff21b365f66d8e56b6184e3b120c3",
	name: "adminPromos",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminPromos.__executeServer(opts));
var adminPromos = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminPromos_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "promos");
	const rows = await (await getSql())`
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
			createdAt: String(r.created_at)
		}))
	};
});
var adminSavePromo_createServerFn_handler = createServerRpc({
	id: "b3fdbaa93c8545448602de0f201191ff2591aa8ceb058cef73e298569d13c25b",
	name: "adminSavePromo",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminSavePromo.__executeServer(opts));
var adminSavePromo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id ?? "").slice(0, 64),
	name: String(input.name).trim().slice(0, 80),
	kind: input.kind === "coins" ? "coins" : "minutes",
	amount: Math.min(1800, Math.max(1, Math.floor(Number(input.amount) || 0))),
	active: input.active !== false,
	note: String(input.note ?? "").trim().slice(0, 200)
})).handler(adminSavePromo_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "promos");
	if (!data.name) throw new Error("Name the offer.");
	const sql = await getSql();
	if (data.id) await sql`
        update ora_promos set name = ${data.name}, kind = ${data.kind}, amount = ${data.amount},
          active = ${data.active}, note = ${data.note}
        where id = ${data.id}
      `;
	else await sql`
        insert into ora_promos (id, name, kind, amount, active, note)
        values (${rid("pro")}, ${data.name}, ${data.kind}, ${data.amount}, ${data.active}, ${data.note})
      `;
	await auditLog(context.userId, "save_promo", "promo", data.id || "new", data.name);
	return { ok: true };
});
var adminGrantPromo_createServerFn_handler = createServerRpc({
	id: "bbfdd56b60f60aea183b7730ae7c963809ccd32729173a33e2fcbbad1fc28ffa",
	name: "adminGrantPromo",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminGrantPromo.__executeServer(opts));
var adminGrantPromo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	promoId: String(input.promoId).slice(0, 64)
})).handler(adminGrantPromo_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "promos");
	const sql = await getSql();
	const [promo] = await sql`
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
var adminReviews_createServerFn_handler = createServerRpc({
	id: "9e4d2f72b789f666b9c2530c12fb983370af56cda216a981c89a81bbd884d2a2",
	name: "adminReviews",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminReviews.__executeServer(opts));
var adminReviews = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(adminReviews_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "reviews");
	return (await (await getSql())`
      select r.id, r.rating, r.body, r.hidden, r.created_at, a.name as advisor, r.advisor_id,
             coalesce(p.display_name, 'Client') as client
      from ora_reviews r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_profiles p on p.user_id = r.client_id
      order by r.created_at desc
      limit 60
    `).map((r) => ({
		id: r.id,
		rating: Number(r.rating),
		body: r.body,
		hidden: Boolean(r.hidden),
		createdAt: String(r.created_at),
		advisor: r.advisor,
		advisorId: r.advisor_id,
		client: r.client
	}));
});
var adminModerateReview_createServerFn_handler = createServerRpc({
	id: "9ab6fb88ef65483d1293cce42bc883d600baf463907828384f21e674f6d504b6",
	name: "adminModerateReview",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminModerateReview.__executeServer(opts));
var adminModerateReview = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	hidden: Boolean(input.hidden)
})).handler(adminModerateReview_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "reviews");
	const sql = await getSql();
	const [row] = await sql`select advisor_id from ora_reviews where id = ${data.id}`;
	if (!row) throw new Error("Review not found.");
	await sql`update ora_reviews set hidden = ${data.hidden} where id = ${data.id}`;
	const [agg] = await sql`
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
var adminReports_createServerFn_handler = createServerRpc({
	id: "01cd4167a05b1384c248a2d54b4cd84ada05bb5a4af4f4006d4ca031dd1b9efe",
	name: "adminReports",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminReports.__executeServer(opts));
var adminReports = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({
	days: Math.min(90, Math.max(7, Math.floor(Number(input?.days) || 14))),
	t: Math.floor(Number(input?.t) || Date.now())
})).handler(adminReports_createServerFn_handler, async ({ context, data }) => {
	await actor(context.userId, "reports");
	const rows = await (await getSql())`
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
	const from = /* @__PURE__ */ new Date();
	from.setDate(from.getDate() - data.days);
	const fromStr = from.toISOString().slice(0, 10);
	return {
		days: data.days,
		coinsPerDollar: 10,
		rows: rows.filter((r) => r.day >= fromStr).map((r) => ({
			day: r.day,
			sessions: Number(r.sessions),
			spent: Number(r.spent),
			earned: Number(r.earned),
			fee: Number(r.fee)
		}))
	};
});
var adminAudit_createServerFn_handler = createServerRpc({
	id: "482dfff08e14133df6d83404c9772ca27f7803b38af50ba3a61d6d6ec55f4d7c",
	name: "adminAudit",
	filename: "src/lib/ora-admin.ts"
}, (opts) => adminAudit.__executeServer(opts));
var adminAudit = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ t: Math.floor(Number(input?.t) || Date.now()) })).handler(adminAudit_createServerFn_handler, async ({ context }) => {
	await actor(context.userId, "audit");
	const rows = await (await getSql()).query(`select l.id, l.actor_id, coalesce(nullif(p.display_name, ''), l.actor_id) as actor_name,
              l.act, l.target_type, l.target_id, l.body, l.created_at
       from ora_owner_log l
       left join ora_profiles p on p.user_id = l.actor_id
       order by l.created_at desc
       limit 80`);
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
			createdAt: String(r.created_at)
		}))
	};
});
//#endregion
export { adminAdjust_createServerFn_handler, adminAdvisors_createServerFn_handler, adminAllCategories_createServerFn_handler, adminAudit_createServerFn_handler, adminCustomerActivity_createServerFn_handler, adminCustomers_createServerFn_handler, adminDecidePayout_createServerFn_handler, adminDeleteCategory_createServerFn_handler, adminEndSession_createServerFn_handler, adminFinance_createServerFn_handler, adminGrantPromo_createServerFn_handler, adminModerateReview_createServerFn_handler, adminOverview_createServerFn_handler, adminPayouts_createServerFn_handler, adminPromos_createServerFn_handler, adminRefundPayment_createServerFn_handler, adminReorderCategory_createServerFn_handler, adminReports_createServerFn_handler, adminReviews_createServerFn_handler, adminSaveCategory_createServerFn_handler, adminSavePromo_createServerFn_handler, adminSaveSettings_createServerFn_handler, adminSession_createServerFn_handler, adminSessions_createServerFn_handler, adminSetCustomer_createServerFn_handler, adminSettings_createServerFn_handler, adminUpdateAdvisor_createServerFn_handler };

import { r as createServerFn } from "./ssr.mjs";
import { i as getSql, t as authMiddleware } from "./middleware-DaHnGAQf.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ora-ePjyfKuK.js
var FALLBACK = "I'm here. Say the thing you've been circling — I'll take it from there.";
async function advisorReply(input) {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return FALLBACK;
	const messages = [
		{
			role: "system",
			content: [
				`You are ${input.name}, a psychic advisor on Ora, in a live paid reading.`,
				`Specialties: ${input.specialties || "general readings"}.`,
				`Voice: ${input.bio}`,
				`Background: ${input.experience}`,
				"Stay in character. Never mention being an AI, a model, or Grok.",
				"Entertainment only — never medical, legal, or financial advice.",
				"Be specific and grounded. 2–4 short paragraphs. At most one question.",
				"Do not ask for personal data (address, full name of third parties, passwords)."
			].join(" ")
		},
		...input.history.slice(-8).map((m) => ({
			role: m.role === "client" ? "user" : "assistant",
			content: m.body
		})),
		{
			role: "user",
			content: input.question
		}
	];
	try {
		const res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: "grok-4.5",
				messages,
				max_tokens: 220,
				temperature: .85
			})
		});
		if (!res.ok) return FALLBACK;
		return (await res.json()).choices?.[0]?.message?.content?.trim() || FALLBACK;
	} catch {
		return FALLBACK;
	}
}
var WEEKLY_SECONDS = 180;
var WELCOME_SECONDS = 180;
var SUB_PRICE_USD = 10;
var COINS_PER_DOLLAR = 10;
var LOW_BALANCE_SECONDS = 60;
function rid(prefix) {
	return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
var DEFAULT_SETTINGS = {
	name: "Ora",
	logoUrl: "",
	supportEmail: "",
	currency: "USD",
	platformShare: 30,
	welcomeSeconds: WELCOME_SECONDS,
	weeklySeconds: WEEKLY_SECONDS,
	welcomeCoins: 0,
	minPayoutCoins: 50,
	payoutHoldHours: 0
};
var settingsMemo = null;
async function loadSettings() {
	if (settingsMemo && Date.now() - settingsMemo.at < 6e4) return settingsMemo.value;
	try {
		const [row] = await (await getSql())`
      select name, logo_url, support_email, currency, platform_share, welcome_seconds, weekly_seconds, welcome_coins,
             min_payout_coins, payout_hold_hours
      from ora_settings where id = 'ora'
    `;
		const value = row ? {
			name: row.name || "Ora",
			logoUrl: row.logo_url || "",
			supportEmail: row.support_email || "",
			currency: row.currency || "USD",
			platformShare: Math.min(50, Math.max(0, Number(row.platform_share) || 30)),
			welcomeSeconds: Math.min(1800, Math.max(0, Number(row.welcome_seconds) || WELCOME_SECONDS)),
			weeklySeconds: Math.min(1800, Math.max(0, Number(row.weekly_seconds) || WEEKLY_SECONDS)),
			welcomeCoins: Math.min(500, Math.max(0, Number(row.welcome_coins) || 0)),
			minPayoutCoins: Math.min(5e3, Math.max(1, Number(row.min_payout_coins) || 50)),
			payoutHoldHours: Math.min(168, Math.max(0, Number(row.payout_hold_hours) || 0))
		} : DEFAULT_SETTINGS;
		settingsMemo = {
			at: Date.now(),
			value
		};
		return value;
	} catch {
		return DEFAULT_SETTINGS;
	}
}
var getPublicSettings_createServerFn_handler = createServerRpc({
	id: "112aa346ec80a3eda219ab7e080bb579a47f1a0bb9ed7e26060cd319b6a7eda2",
	name: "getPublicSettings",
	filename: "src/lib/ora.ts"
}, (opts) => getPublicSettings.__executeServer(opts));
var getPublicSettings = createServerFn({ method: "GET" }).handler(getPublicSettings_createServerFn_handler, () => loadSettings());
var DEFAULT_CATEGORIES = [
	{
		id: "cat_love",
		name: "Love",
		slug: "love",
		sortOrder: 1,
		active: true
	},
	{
		id: "cat_career",
		name: "Career",
		slug: "career",
		sortOrder: 2,
		active: true
	},
	{
		id: "cat_grief",
		name: "Grief",
		slug: "grief",
		sortOrder: 3,
		active: true
	},
	{
		id: "cat_astro",
		name: "Astrology",
		slug: "astrology",
		sortOrder: 4,
		active: true
	},
	{
		id: "cat_medium",
		name: "Medium",
		slug: "medium",
		sortOrder: 5,
		active: true
	}
];
var categoriesMemo = null;
async function loadCategories(activeOnly = true) {
	if (categoriesMemo && categoriesMemo.activeOnly === activeOnly && Date.now() - categoriesMemo.at < 6e4) return categoriesMemo.value;
	try {
		const sql = await getSql();
		const value = (activeOnly ? await sql`
          select id, name, slug, sort_order, active from ora_categories where active = true
          order by sort_order asc, name
        ` : await sql`
          select id, name, slug, sort_order, active from ora_categories
          order by sort_order asc, name
        `).map((r) => ({
			id: r.id,
			name: r.name,
			slug: r.slug,
			sortOrder: Number(r.sort_order),
			active: Boolean(r.active)
		}));
		categoriesMemo = {
			at: Date.now(),
			activeOnly,
			value
		};
		return value;
	} catch {
		return DEFAULT_CATEGORIES;
	}
}
var listCategories_createServerFn_handler = createServerRpc({
	id: "08656a14e98632773fbad498117c874b333fc7c89d0fa3311d6ae28e829cc206",
	name: "listCategories",
	filename: "src/lib/ora.ts"
}, (opts) => listCategories.__executeServer(opts));
var listCategories = createServerFn({ method: "GET" }).handler(listCategories_createServerFn_handler, () => loadCategories(true));
async function auditLog(actorId, event, targetType = "", targetId = "", detail = "") {
	const sql = await getSql();
	const id = rid("aud");
	await sql.query("insert into ora_owner_log (id, actor_id, act, target_type, target_id, body) values ($1, $2, $3, $4, $5, $6)", [
		id,
		actorId,
		event,
		targetType,
		targetId,
		detail
	]);
}
async function assertActive(userId) {
	const sql = await getSql();
	try {
		const [p] = await sql`select status from ora_profiles where user_id = ${userId}`;
		if (p?.status === "suspended") throw new Error("This account is suspended.");
	} catch (e) {
		if (e instanceof Error && e.message.includes("suspended")) throw e;
	}
}
function mapAdvisor(r) {
	return {
		id: String(r.id),
		userId: String(r.user_id ?? ""),
		name: String(r.name ?? ""),
		slug: String(r.slug ?? ""),
		bio: String(r.bio ?? ""),
		experience: String(r.experience ?? ""),
		specialties: String(r.specialties ?? ""),
		rateCoins: Number(r.rate_coins ?? 20),
		photoUrl: String(r.photo_url ?? ""),
		videoUrl: String(r.video_url ?? ""),
		status: String(r.status ?? "live"),
		trusted: Boolean(r.trusted),
		isNew: Boolean(r.is_new),
		rating: Number(r.rating ?? 4.8),
		reviews: Number(r.reviews ?? 0),
		legalName: String(r.legal_name ?? ""),
		languages: String(r.languages ?? "English"),
		years: Number(r.years ?? 0),
		online: Boolean(r.online),
		busy: Boolean(r.busy),
		payoutCoins: Number(r.payout_coins ?? 0),
		pendingCoins: Number(r.pending_coins ?? 0)
	};
}
function normalizeMessages(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const row of list) {
		if (!row || typeof row !== "object") continue;
		const id = String(row.id ?? "").trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push({
			id,
			role: row.role === "advisor" ? "advisor" : "client",
			body: String(row.body ?? "")
		});
	}
	return out;
}
function isHouseAdvisor(userId) {
	return userId.startsWith("seed:");
}
async function authName(userId) {
	const [u] = await (await getSql())`select name from "user" where id = ${userId}`;
	return (u?.name || "Member").trim() || "Member";
}
async function addLedger(userId, kind, amountCoins, seconds, note, refId = "") {
	await (await getSql())`
    insert into ora_ledger (id, user_id, kind, amount_coins, seconds, note, ref_id)
    values (${rid("led")}, ${userId}, ${kind}, ${amountCoins}, ${seconds}, ${note}, ${refId})
  `;
}
async function creditAdvisorEarning(advisorId, readingId, gross, fee, net) {
	if (net <= 0 && gross <= 0) return;
	const sql = await getSql();
	const [dup] = await sql`
    select id from ora_earnings where reading_id = ${readingId} limit 1
  `;
	if (dup) return;
	const hold = (await loadSettings()).payoutHoldHours;
	const id = rid("ern");
	const availableAt = new Date(Date.now() + hold * 36e5).toISOString();
	const status = hold <= 0 ? "available" : "pending";
	try {
		await sql`
      insert into ora_earnings (id, advisor_id, reading_id, gross_coins, commission_coins, net_coins, status, available_at)
      values (${id}, ${advisorId}, ${readingId}, ${gross}, ${fee}, ${net}, ${status}, ${availableAt})
    `;
	} catch {
		return;
	}
	if (net <= 0) return;
	if (status === "available") await sql`update ora_advisors set payout_coins = payout_coins + ${net} where id = ${advisorId}`;
	else await sql`update ora_advisors set pending_coins = pending_coins + ${net} where id = ${advisorId}`;
}
async function settleAdvisorEarnings(advisorId) {
	const sql = await getSql();
	const due = await sql`
    select id, net_coins from ora_earnings
    where advisor_id = ${advisorId} and status = 'pending' and available_at <= now()
  `;
	for (const row of due) {
		const net = Number(row.net_coins);
		if (!(await sql`
      update ora_earnings set status = 'available' where id = ${row.id} and status = 'pending' returning id
    `).length) continue;
		await sql`
      update ora_advisors
      set pending_coins = greatest(0, pending_coins - ${net}),
          payout_coins = payout_coins + ${net}
      where id = ${advisorId}
    `;
	}
}
var lastEarningsSettle = /* @__PURE__ */ new Map();
async function maybeSettleAdvisorEarnings(advisorId) {
	const at = lastEarningsSettle.get(advisorId) ?? 0;
	if (Date.now() - at < 3e4) return;
	lastEarningsSettle.set(advisorId, Date.now());
	await settleAdvisorEarnings(advisorId);
}
var lastRequestExpireAt = 0;
async function expireStaleRequests(advisorId) {
	if (Date.now() - lastRequestExpireAt < 2e4) return;
	lastRequestExpireAt = Date.now();
	await (await getSql())`
    update ora_chat_requests set status = 'expired'
    where advisor_id = ${advisorId} and status = 'pending'
      and created_at < now() - interval '3 minutes'
  `;
}
async function logReadingOnce(userId, readingId) {
	const sql = await getSql();
	const [dup] = await sql`
    select id from ora_ledger where user_id = ${userId} and ref_id = ${readingId} and kind = 'reading' limit 1
  `;
	if (dup) {
		await sql`update ora_advisors set busy = false where id = (select advisor_id from ora_readings where id = ${readingId})`;
		return;
	}
	const [row] = await sql`
    select seconds, coins_spent, advisor_earned, platform_fee, advisor_id, client_id, rate_coins
    from ora_readings where id = ${readingId}
  `;
	if (!row) return;
	const secs = Number(row.seconds);
	const coins = Number(row.coins_spent);
	const split = splitCoins(coins);
	const earned = Number(row.advisor_earned) || split.advisorEarned;
	const fee = Number(row.platform_fee) || split.platformFee;
	if (earned !== Number(row.advisor_earned) || fee !== Number(row.platform_fee)) await sql`
      update ora_readings set advisor_earned = ${earned}, platform_fee = ${fee} where id = ${readingId}
    `;
	if (secs > 0 || coins > 0) {
		const rate = Number(row.rate_coins) || 20;
		await addLedger(row.client_id, "reading", -coins, secs, `Reading · ${formatClock(secs)} · ${rate}c/min · ${coins}c`, readingId);
		if (earned > 0) await creditAdvisorEarning(row.advisor_id, readingId, coins, fee, earned);
		if (fee > 0) {
			const [plat] = await sql`
        select id from ora_platform_ledger where reading_id = ${readingId} limit 1
      `;
			if (!plat) await sql`
          insert into ora_platform_ledger (id, reading_id, coins)
          values (${rid("plat")}, ${readingId}, ${fee})
        `;
		}
	}
	await sql`update ora_advisors set busy = false where id = ${row.advisor_id}`;
}
function adminHasPermission(stored, needed) {
	if (!needed) return true;
	const p = stored.trim();
	if (p === "*" || p === "all") return true;
	return p.split(",").map((s) => s.trim()).includes(needed);
}
async function grantAdmin(userId, byUserId, role = "admin") {
	const sql = await getSql();
	const [p] = await sql`select email from ora_profiles where user_id = ${userId}`;
	await sql`update ora_profiles set role = 'admin' where user_id = ${userId}`;
	await sql`
    insert into ora_admins (user_id, email, role, permissions, created_by)
    values (${userId}, ${p?.email || ""}, ${role}, '*', ${byUserId})
    on conflict (user_id) do update
      set email = excluded.email,
          role = excluded.role
  `;
}
async function syncAdminRoster() {
	await (await getSql())`
    insert into ora_admins (user_id, email, role, permissions, created_by)
    select user_id, email, 'owner', '*', user_id
    from ora_profiles
    where role = 'admin'
    on conflict (user_id) do nothing
  `;
}
async function claimFirstOwner(userId) {
	const sql = await getSql();
	await syncAdminRoster();
	const [row] = await sql`select count(*)::int as n from ora_admins`;
	if (Number(row?.n ?? 0) > 0) return;
	await grantAdmin(userId, userId, "owner");
	try {
		await auditLog(userId, "claim_owner", "profile", userId, "First owner on this marketplace");
	} catch (e) {
		console.error("[ora] claim_owner audit failed", e);
	}
}
async function ensureAccount(userId, name) {
	const sql = await getSql();
	const [auth] = await sql`
    select name, email from "user" where id = ${userId}
  `;
	const display = (name || auth?.name || "Member").trim() || "Member";
	const email = (auth?.email || "").trim();
	await sql`
    insert into ora_profiles (user_id, display_name, role, email)
    values (${userId}, ${display}, 'client', ${email})
    on conflict (user_id) do nothing
  `;
	if (display && display !== "Member") await sql`
      update ora_profiles set display_name = ${display}
      where user_id = ${userId} and (display_name = '' or display_name = 'Member')
    `;
	if (email) await sql`update ora_profiles set email = ${email} where user_id = ${userId} and email = ''`;
	const [wallet] = await sql`select user_id from ora_wallets where user_id = ${userId}`;
	if (!wallet) {
		const settings = await loadSettings();
		await sql`
      insert into ora_wallets (user_id, coins, promo_coins, bonus_seconds, weekly_seconds, subscribed)
      values (${userId}, ${settings.welcomeCoins}, ${settings.welcomeCoins}, ${settings.welcomeSeconds}, 0, false)
    `;
		await addLedger(userId, "welcome", settings.welcomeCoins, settings.welcomeSeconds, "First login · welcome minutes");
		if (settings.welcomeCoins > 0) await addLedger(userId, "promo", settings.welcomeCoins, 0, `Welcome coins · ${settings.welcomeCoins}c`);
	}
	await sql`
    update ora_wallets
    set weekly_seconds = ${(await loadSettings()).weeklySeconds}, week_started_at = now()
    where user_id = ${userId}
      and subscribed = true
      and (week_started_at is null or week_started_at < now() - interval '7 days')
  `;
	const [admins] = await sql`select count(*)::int as n from ora_admins`;
	const [legacy] = await sql`select count(*)::int as n from ora_profiles where role = 'admin'`;
	if (Number(admins?.n ?? 0) === 0 && Number(legacy?.n ?? 0) === 0) await claimFirstOwner(userId);
	else if (Number(admins?.n ?? 0) === 0) await syncAdminRoster();
}
async function loadMe(userId) {
	const name = await authName(userId);
	await ensureAccount(userId, name);
	const sql = await getSql();
	const [profile] = await sql`
    select user_id, display_name, role, email, status from ora_profiles where user_id = ${userId}
  `;
	const [wallet] = await sql`
    select coins, promo_coins, bonus_seconds, weekly_seconds, subscribed from ora_wallets where user_id = ${userId}
  `;
	const [adv] = await sql`
    select id from ora_advisors where user_id = ${userId} and status = 'live' limit 1
  `;
	const [app] = await sql`
    select id from ora_applications where user_id = ${userId} and status = 'pending' limit 1
  `;
	return {
		userId,
		displayName: profile?.display_name || name || "Member",
		email: profile?.email || "",
		role: profile?.role ?? "client",
		status: profile?.status ?? "active",
		wallet: mapWallet(wallet),
		advisorId: adv?.id,
		pendingApplication: Boolean(app)
	};
}
var getMe_createServerFn_handler = createServerRpc({
	id: "2801ef905aac0d5d9d09169ac3ac9bd6c47ac3c796ec67e0f914ff3b2e56c427",
	name: "getMe",
	filename: "src/lib/ora.ts"
}, (opts) => getMe.__executeServer(opts));
var getMe = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getMe_createServerFn_handler, async ({ context }) => loadMe(context.userId));
var listAdvisors_createServerFn_handler = createServerRpc({
	id: "95d582db7e9a32958c7a8c61b475821907a1c322a6f6afda2429d99e5eee5964",
	name: "listAdvisors",
	filename: "src/lib/ora.ts"
}, (opts) => listAdvisors.__executeServer(opts));
var listAdvisors = createServerFn({ method: "GET" }).handler(listAdvisors_createServerFn_handler, async () => {
	return (await (await getSql())`
    select id, user_id, name, slug, specialties, rate_coins, photo_url, status, trusted, is_new, rating, reviews, online, busy
    from ora_advisors where status = 'live' order by online desc, trusted desc, rating desc, name
  `).map(mapAdvisor);
});
var listFloor_createServerFn_handler = createServerRpc({
	id: "3c026eeb98e984ea150bb1be200ce2945c77c2f2aecf5bce9ac22885d32751cc",
	name: "listFloor",
	filename: "src/lib/ora.ts"
}, (opts) => listFloor.__executeServer(opts));
var listFloor = createServerFn({ method: "GET" }).handler(listFloor_createServerFn_handler, async () => {
	return (await (await getSql())`
    select id, online, busy from ora_advisors where status = 'live'
  `).map((r) => ({
		id: r.id,
		online: Boolean(r.online),
		busy: Boolean(r.busy)
	}));
});
var getAdvisor_createServerFn_handler = createServerRpc({
	id: "809f94a08c254a1f7fda20d30dd6e4da0933d4a061a912992ae2f177818fdcf0",
	name: "getAdvisor",
	filename: "src/lib/ora.ts"
}, (opts) => getAdvisor.__executeServer(opts));
var getAdvisor = createServerFn({ method: "GET" }).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(getAdvisor_createServerFn_handler, async ({ data }) => {
	const [row] = await (await getSql())`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where (id = ${data.id} or slug = ${data.id}) and status = 'live'
    `;
	return row ? mapAdvisor(row) : null;
});
var subscribe_createServerFn_handler = createServerRpc({
	id: "0cabade028403be618ba1a9ed0145d284bdda7fee87b76d123bdf879f2ec3321",
	name: "subscribe",
	filename: "src/lib/ora.ts"
}, (opts) => subscribe.__executeServer(opts));
var subscribe = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(subscribe_createServerFn_handler, async ({ context }) => {
	await ensureAccount(context.userId, await authName(context.userId));
	await assertActive(context.userId);
	const settings = await loadSettings();
	await (await getSql())`
      update ora_wallets
      set subscribed = true,
          sub_started_at = now(),
          week_started_at = now(),
          weekly_seconds = ${settings.weeklySeconds}
      where user_id = ${context.userId}
    `;
	await addLedger(context.userId, "subscribe", 0, settings.weeklySeconds, `Weekly subscription · $${SUB_PRICE_USD}`);
	return loadMe(context.userId);
});
var buyCoins_createServerFn_handler = createServerRpc({
	id: "d1530b7d9363d412afc6a5a9f7c36f17f2f21d9aefe11c36751fa0aa9babb86d",
	name: "buyCoins",
	filename: "src/lib/ora.ts"
}, (opts) => buyCoins.__executeServer(opts));
var buyCoins = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ packId: String(input.packId) })).handler(buyCoins_createServerFn_handler, async () => {
	throw new Error("Add funds opens checkout. Coins are credited only after the payment is verified.");
});
async function walletCanPay(userId) {
	const [wallet] = await (await getSql())`
    select coins, bonus_seconds, weekly_seconds from ora_wallets where user_id = ${userId}
  `;
	return Number(wallet?.bonus_seconds ?? 0) + Number(wallet?.weekly_seconds ?? 0) > 0 || Number(wallet?.coins ?? 0) > 0;
}
async function openReading(clientId, adv, greet) {
	const sql = await getSql();
	const rate = Math.min(80, Math.max(8, Number(adv.rate_coins) || 20));
	if (!isHouseAdvisor(adv.user_id)) {
		if (!(await sql`
      update ora_advisors set busy = true where id = ${adv.id} and busy = false and online = true and status = 'live'
      returning id
    `).length) throw new Error("Advisor is in a session.");
	}
	await sql`update ora_readings set status = 'ended', ended_at = now() where client_id = ${clientId} and status = 'live'`;
	const id = rid("read");
	await sql`
    insert into ora_readings (id, client_id, advisor_id, status, rate_coins, last_billed_at)
    values (${id}, ${clientId}, ${adv.id}, 'live', ${rate}, now())
  `;
	await sql`
    insert into ora_messages (id, reading_id, role, body)
    values (${rid("msg")}, ${id}, 'advisor', ${greet ?? `I'm ${adv.name}. Your included minutes run first. Tell me what you want to know.`})
  `;
	return id;
}
var applyAdvisor_createServerFn_handler = createServerRpc({
	id: "9ee962e92e4aa143aae7d1c5d4d2457287537d150cf209c128cefdf8d7c24b24",
	name: "applyAdvisor",
	filename: "src/lib/ora.ts"
}, (opts) => applyAdvisor.__executeServer(opts));
var applyAdvisor = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	name: String(input.name).trim().slice(0, 80),
	legalName: String(input.legalName ?? "").trim().slice(0, 80),
	bio: String(input.bio).trim().slice(0, 1200),
	experience: String(input.experience).trim().slice(0, 800),
	specialties: String(input.specialties).trim().slice(0, 120),
	rateCoins: Math.min(80, Math.max(8, Number(input.rateCoins) || 20)),
	photoUrl: String(input.photoUrl ?? "").slice(0, 4e5),
	videoUrl: String(input.videoUrl ?? "").slice(0, 500),
	languages: String(input.languages ?? "English").trim().slice(0, 80) || "English",
	years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0)))
})).handler(applyAdvisor_createServerFn_handler, async ({ context, data }) => {
	if (!data.name || data.bio.length < 20) throw new Error("Name and a short bio are required.");
	await ensureAccount(context.userId, data.legalName || data.name);
	const sql = await getSql();
	await sql`update ora_applications set status = 'withdrawn' where user_id = ${context.userId} and status = 'pending'`;
	const id = rid("app");
	await sql`
      insert into ora_applications (id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, status, legal_name, languages, years)
      values (${id}, ${context.userId}, ${data.name}, ${data.bio}, ${data.experience}, ${data.specialties}, ${data.rateCoins}, ${data.photoUrl}, ${data.videoUrl}, 'pending', ${data.legalName}, ${data.languages}, ${data.years})
    `;
	return { id };
});
var startReading_createServerFn_handler = createServerRpc({
	id: "ebe9c9546b8290b549f6d14e68e749f8146f5284bbdf4fb01e3d4aa235134672",
	name: "startReading",
	filename: "src/lib/ora.ts"
}, (opts) => startReading.__executeServer(opts));
var startReading = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(startReading_createServerFn_handler, async ({ context, data }) => {
	await ensureAccount(context.userId, await authName(context.userId));
	await assertActive(context.userId);
	const [adv] = await (await getSql())`
      select id, name, user_id, online, busy, rate_coins from ora_advisors where id = ${data.advisorId} and status = 'live'
    `;
	if (!adv) throw new Error("Advisor not available.");
	if (!adv.online) throw new Error("This advisor is offline.");
	if (adv.busy && !isHouseAdvisor(adv.user_id)) throw new Error("Advisor is in a session. Try in a moment.");
	if (!await walletCanPay(context.userId)) throw new Error("Subscribe or add coins to start a reading.");
	return { id: await openReading(context.userId, adv) };
});
var requestChat_createServerFn_handler = createServerRpc({
	id: "b1cf413135b8187796d3c6ce4fa363c9b739c2b39a8d5a81d614d233aaf35dd9",
	name: "requestChat",
	filename: "src/lib/ora.ts"
}, (opts) => requestChat.__executeServer(opts));
var requestChat = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(requestChat_createServerFn_handler, async ({ context, data }) => {
	await ensureAccount(context.userId, await authName(context.userId));
	await assertActive(context.userId);
	const sql = await getSql();
	const [adv] = await sql`
      select id, name, user_id, online, busy, rate_coins from ora_advisors
      where (id = ${data.advisorId} or slug = ${data.advisorId}) and status = 'live'
    `;
	if (!adv) throw new Error("Advisor not available.");
	if (!adv.online) throw new Error("This advisor is offline.");
	if (adv.busy && !isHouseAdvisor(adv.user_id)) throw new Error("Advisor is in a session. Try in a moment.");
	if (!await walletCanPay(context.userId)) throw new Error("Subscribe or add coins to start a reading.");
	if (isHouseAdvisor(adv.user_id)) return {
		mode: "live",
		id: await openReading(context.userId, adv),
		requestId: ""
	};
	await sql`
      update ora_chat_requests set status = 'expired'
      where client_id = ${context.userId} and status = 'pending'
    `;
	const requestId = rid("req");
	await sql`
      insert into ora_chat_requests (id, client_id, advisor_id, status)
      values (${requestId}, ${context.userId}, ${adv.id}, 'pending')
    `;
	return {
		mode: "wait",
		id: "",
		requestId
	};
});
function mapWallet(row) {
	const coins = Number(row?.coins ?? 0);
	const promo = Math.min(coins, Math.max(0, Number(row?.promo_coins ?? 0)));
	return {
		coins,
		promoCoins: promo,
		purchasedCoins: Math.max(0, coins - promo),
		bonusSeconds: Number(row?.bonus_seconds ?? 0),
		weeklySeconds: Number(row?.weekly_seconds ?? 0),
		subscribed: Boolean(row?.subscribed)
	};
}
function splitCoins(coins, platformSharePct = 30) {
	const c = Math.max(0, Math.floor(Number(coins) || 0));
	const pct = Math.min(50, Math.max(0, Math.floor(Number(platformSharePct) || 30)));
	const advisorEarned = Math.floor(c * (100 - pct) / 100);
	return {
		advisorEarned,
		platformFee: c - advisorEarned
	};
}
function affordableSeconds(wallet, rate) {
	const inc = includedSeconds(wallet);
	const r = Math.max(1, Math.floor(rate) || 20);
	return inc + Math.floor(Math.max(0, wallet.coins) * 60 / r);
}
function settleSpend(wallet, rate, current, addSeconds) {
	const rateN = Math.max(1, rate);
	let left = Math.max(0, Math.floor(addSeconds));
	const take = (pool) => {
		const n = Math.min(Math.max(0, pool), left);
		left -= n;
		return n;
	};
	const bonus = take(Number(wallet.bonus_seconds));
	const weekly = take(Number(wallet.weekly_seconds));
	const paidAlready = Math.max(0, Number(current.seconds) - Number(current.bonus_used) - Number(current.weekly_used));
	const coinsAlready = Number(current.coins_spent);
	const coinsWallet = Math.max(0, Number(wallet.coins));
	const maxCoinsTotal = coinsAlready + coinsWallet;
	const maxPaidSeconds = maxCoinsTotal <= 0 ? 0 : Math.floor(((maxCoinsTotal + 1) * 60 - 1) / rateN);
	const desiredPaid = paidAlready + left;
	const newPaid = Math.min(desiredPaid, Math.max(paidAlready, maxPaidSeconds));
	const newCoinsTarget = Math.floor(newPaid * rateN / 60);
	const coins = Math.max(0, Math.min(coinsWallet, newCoinsTarget - coinsAlready));
	const additionalPaid = Math.max(0, newPaid - paidAlready);
	const used = bonus + weekly + additionalPaid;
	return {
		bonus,
		weekly,
		coins,
		used,
		ok: used > 0,
		dry: newPaid < desiredPaid
	};
}
function billFrom(reading, wallet) {
	const rate = Number(reading.rate_coins) || 20;
	const status = reading.status === "ended" ? "ended" : "live";
	const remaining = status === "live" && wallet ? affordableSeconds(wallet, rate) : 0;
	return {
		id: String(reading.id ?? ""),
		seconds: Number(reading.seconds) || 0,
		status,
		coinsSpent: Number(reading.coins_spent) || 0,
		rateCoins: rate,
		advisorEarned: Number(reading.advisor_earned) || 0,
		platformFee: Number(reading.platform_fee) || 0,
		remainingSeconds: Number.isFinite(remaining) ? remaining : 0,
		lowBalance: status === "live" && remaining > 0 && remaining <= LOW_BALANCE_SECONDS,
		wallet,
		startedAt: reading.started_at ? String(reading.started_at) : "",
		endedAt: reading.ended_at ? String(reading.ended_at) : null
	};
}
async function loadReadingRow(id) {
	const [row] = await (await getSql())`
    select id, client_id, advisor_id, seconds, coins_spent, bonus_used, weekly_used, status,
           rate_coins, advisor_earned, platform_fee, started_at, ended_at
    from ora_readings where id = ${id}
  `;
	return row ?? null;
}
async function settleReading(readingId) {
	const sql = await getSql();
	const reading = await loadReadingRow(readingId);
	if (!reading) return null;
	const [walletRow] = await sql`
    select coins, promo_coins, bonus_seconds, weekly_seconds, subscribed from ora_wallets where user_id = ${reading.client_id}
  `;
	const wallet = mapWallet(walletRow);
	if (reading.status !== "live") return billFrom(reading, wallet);
	const started = new Date(reading.started_at).getTime();
	if (!Number.isFinite(started)) return billFrom(reading, wallet);
	const target = Math.max(0, Math.floor((Date.now() - started) / 1e3));
	const billed = Number(reading.seconds);
	const delta = target - billed;
	if (delta < 1) return billFrom(reading, wallet);
	if (!walletRow) {
		await sql`
      update ora_readings set status = 'ended', ended_at = now() where id = ${readingId} and status = 'live'
    `;
		await logReadingOnce(reading.client_id, readingId);
		const ended = await loadReadingRow(readingId);
		return ended ? billFrom(ended, wallet) : null;
	}
	const result = settleSpend(walletRow, Number(reading.rate_coins) || 20, reading, delta);
	const nextSeconds = billed + result.used;
	const nextCoins = Number(reading.coins_spent) + result.coins;
	const nextBonus = Number(reading.bonus_used) + result.bonus;
	const nextWeekly = Number(reading.weekly_used) + result.weekly;
	const split = splitCoins(nextCoins, (await loadSettings()).platformShare);
	const ended = result.dry || !result.ok;
	const endedAt = ended ? (/* @__PURE__ */ new Date()).toISOString() : null;
	if (!(await sql`
    update ora_readings
    set seconds = ${nextSeconds},
        coins_spent = ${nextCoins},
        bonus_used = ${nextBonus},
        weekly_used = ${nextWeekly},
        advisor_earned = ${split.advisorEarned},
        platform_fee = ${split.platformFee},
        last_billed_at = now(),
        status = ${ended ? "ended" : "live"},
        ended_at = ${endedAt}
    where id = ${readingId} and status = 'live' and seconds = ${billed}
    returning id
  `).length) {
		const again = await loadReadingRow(readingId);
		return again ? billFrom(again, wallet) : null;
	}
	const fromPromo = Math.min(Math.max(0, Number(walletRow.promo_coins ?? 0)), result.coins);
	await sql`
    update ora_wallets
    set coins = coins - ${result.coins},
        promo_coins = greatest(0, promo_coins - ${fromPromo}),
        bonus_seconds = bonus_seconds - ${result.bonus},
        weekly_seconds = weekly_seconds - ${result.weekly}
    where user_id = ${reading.client_id}
  `;
	if (ended) await logReadingOnce(reading.client_id, readingId);
	const fresh = await loadReadingRow(readingId);
	const [nextWallet] = await sql`
    select coins, promo_coins, bonus_seconds, weekly_seconds, subscribed from ora_wallets where user_id = ${reading.client_id}
  `;
	return fresh ? billFrom(fresh, mapWallet(nextWallet)) : null;
}
var tickReading_createServerFn_handler = createServerRpc({
	id: "c7eed7fa22056ce088c1d85d1dc9ef2cbbd90e9cb5073868d81cc5f10183e124",
	name: "tickReading",
	filename: "src/lib/ora.ts"
}, (opts) => tickReading.__executeServer(opts));
var tickReading = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(tickReading_createServerFn_handler, async ({ context, data }) => {
	const [row] = await (await getSql())`
      select r.client_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id}
    `;
	if (!row || row.client_id !== context.userId && row.advisor_user !== context.userId) return {
		status: "ended",
		seconds: 0,
		coinsSpent: 0,
		rateCoins: 20,
		advisorEarned: 0,
		platformFee: 0,
		remainingSeconds: 0,
		lowBalance: false,
		wallet: null,
		startedAt: "",
		endedAt: null,
		id: data.id
	};
	return await settleReading(data.id) ?? {
		status: "ended",
		seconds: 0,
		coinsSpent: 0,
		rateCoins: 20,
		advisorEarned: 0,
		platformFee: 0,
		remainingSeconds: 0,
		lowBalance: false,
		wallet: null,
		startedAt: "",
		endedAt: null,
		id: data.id
	};
});
var endReading_createServerFn_handler = createServerRpc({
	id: "19c677d4e2a8925c6e132eaee01a9b46f44053629cec33e37a8ef085e8c00e3f",
	name: "endReading",
	filename: "src/lib/ora.ts"
}, (opts) => endReading.__executeServer(opts));
var endReading = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(endReading_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const [row] = await sql`
      select r.id, r.client_id, r.advisor_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id} and r.status = 'live'
        and (r.client_id = ${context.userId} or a.user_id = ${context.userId})
    `;
	if (!row) return loadMe(context.userId);
	await settleReading(row.id);
	await sql`
      update ora_readings set status = 'ended', ended_at = coalesce(ended_at, now())
      where id = ${row.id} and status = 'live'
    `;
	await logReadingOnce(row.client_id, row.id);
	return loadMe(context.userId);
});
var getReading_createServerFn_handler = createServerRpc({
	id: "586d1c8211b4c1fe0c9d2384f7229c6b4b1bc5b1356599298f19445607facd58",
	name: "getReading",
	filename: "src/lib/ora.ts"
}, (opts) => getReading.__executeServer(opts));
var getReading = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(getReading_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const [access] = await sql`
      select r.client_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id}
    `;
	if (!access || access.client_id !== context.userId && access.advisor_user !== context.userId) return null;
	const bill = await settleReading(data.id);
	if (!bill) return null;
	const row = await loadReadingRow(data.id);
	if (!row) return null;
	const [adv] = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where id = ${row.advisor_id}
    `;
	const [client] = await sql`
      select display_name from ora_profiles where user_id = ${row.client_id}
    `;
	const [rev] = await sql`
      select id from ora_reviews where reading_id = ${data.id} limit 1
    `;
	return {
		...bill,
		clientName: client?.display_name || "Client",
		clientId: row.client_id,
		advisor: adv ? mapAdvisor(adv) : null,
		reviewed: Boolean(rev)
	};
});
var listMessages_createServerFn_handler = createServerRpc({
	id: "88d5e716ce710e94896a84dc742785f47e70607db6a80364bf9f4f87cb099b6e",
	name: "listMessages",
	filename: "src/lib/ora.ts"
}, (opts) => listMessages.__executeServer(opts));
var listMessages = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(listMessages_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const [reading] = await sql`
      select r.id from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id} and (r.client_id = ${context.userId} or a.user_id = ${context.userId})
    `;
	if (!reading) return [];
	return (await sql`
      select id, role, body from ora_messages where reading_id = ${data.id} order by created_at asc
    `).map((r) => ({
		id: String(r?.id ?? ""),
		role: r?.role === "advisor" ? "advisor" : "client",
		body: String(r?.body ?? "")
	})).filter((m) => m.id);
});
var syncReading_createServerFn_handler = createServerRpc({
	id: "75e2bfae3e0a9041caa5caf718ab886f1aa1ee04c573ab3c87a2db2a2d367166",
	name: "syncReading",
	filename: "src/lib/ora.ts"
}, (opts) => syncReading.__executeServer(opts));
var syncReading = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(syncReading_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const [row] = await sql`
      select r.client_id, a.user_id as advisor_user
      from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.id}
    `;
	const empty = {
		status: "ended",
		seconds: 0,
		coinsSpent: 0,
		rateCoins: 20,
		advisorEarned: 0,
		platformFee: 0,
		remainingSeconds: 0,
		lowBalance: false,
		wallet: null,
		startedAt: "",
		endedAt: null,
		id: data.id,
		messages: []
	};
	if (!row || row.client_id !== context.userId && row.advisor_user !== context.userId) return empty;
	const bill = await settleReading(data.id);
	const messages = normalizeMessages((await sql`
      select id, role, body from ora_messages where reading_id = ${data.id} order by created_at asc
    `).map((r) => ({
		id: String(r?.id ?? ""),
		role: r?.role === "advisor" ? "advisor" : "client",
		body: String(r?.body ?? "")
	})));
	if (!bill) return {
		...empty,
		messages
	};
	return {
		...bill,
		messages
	};
});
var sendMessage_createServerFn_handler = createServerRpc({
	id: "c342deb35738e4dded377a0b8a337e042555073f074c8ca9a2a97b197c50eb14",
	name: "sendMessage",
	filename: "src/lib/ora.ts"
}, (opts) => sendMessage.__executeServer(opts));
var sendMessage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	body: String(input.body).trim().slice(0, 800)
})).handler(sendMessage_createServerFn_handler, async ({ context, data }) => {
	if (data.body.length < 1) throw new Error("Write something first.");
	const sql = await getSql();
	const [owned] = await sql`
      select id from ora_readings where id = ${data.id} and client_id = ${context.userId}
    `;
	if (!owned) throw new Error("This reading has ended.");
	const bill = await settleReading(data.id);
	if (!bill || bill.status !== "live") throw new Error("This reading has ended.");
	const [reading] = await sql`
      select id, advisor_id, status from ora_readings
      where id = ${data.id} and client_id = ${context.userId}
    `;
	if (!reading || reading.status !== "live") throw new Error("This reading has ended.");
	const [adv] = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where id = ${reading.advisor_id}
    `;
	if (!adv) throw new Error("Advisor not available.");
	const advisor = mapAdvisor(adv);
	const clientMsgId = rid("msg");
	await sql`
      insert into ora_messages (id, reading_id, role, body)
      values (${clientMsgId}, ${data.id}, 'client', ${data.body})
    `;
	if (!isHouseAdvisor(advisor.userId)) return {
		client: {
			id: clientMsgId,
			role: "client",
			body: data.body
		},
		advisor: null
	};
	const history = (await sql`
      select role, body from ora_messages where reading_id = ${data.id} order by created_at asc
    `).slice(0, -1).map((m) => ({
		role: m.role === "advisor" ? "advisor" : "client",
		body: m.body
	}));
	const reply = await advisorReply({
		name: advisor.name,
		bio: advisor.bio,
		specialties: advisor.specialties,
		experience: advisor.experience,
		history,
		question: data.body
	});
	const advMsgId = rid("msg");
	await sql`
      insert into ora_messages (id, reading_id, role, body)
      values (${advMsgId}, ${data.id}, 'advisor', ${reply})
    `;
	return {
		client: {
			id: clientMsgId,
			role: "client",
			body: data.body
		},
		advisor: {
			id: advMsgId,
			role: "advisor",
			body: reply
		}
	};
});
var saveStudio_createServerFn_handler = createServerRpc({
	id: "16e0edf658c83dc3f9ad8840e1745534b919381744b1f22a3e0872a512f964ad",
	name: "saveStudio",
	filename: "src/lib/ora.ts"
}, (opts) => saveStudio.__executeServer(opts));
var saveStudio = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	bio: String(input.bio).trim().slice(0, 1200),
	experience: String(input.experience).trim().slice(0, 800),
	specialties: String(input.specialties).trim().slice(0, 120),
	rateCoins: Math.min(80, Math.max(8, Number(input.rateCoins) || 20)),
	photoUrl: input.photoUrl ? String(input.photoUrl).slice(0, 4e5) : void 0,
	videoUrl: String(input.videoUrl ?? "").slice(0, 500)
})).handler(saveStudio_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	if (data.photoUrl) await sql`
        update ora_advisors
        set bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, photo_url = ${data.photoUrl}, video_url = ${data.videoUrl}
        where user_id = ${context.userId}
      `;
	else await sql`
        update ora_advisors
        set bio = ${data.bio}, experience = ${data.experience}, specialties = ${data.specialties},
            rate_coins = ${data.rateCoins}, video_url = ${data.videoUrl}
        where user_id = ${context.userId}
      `;
	return loadMe(context.userId);
});
var getStudio_createServerFn_handler = createServerRpc({
	id: "3d87d420071a5e9d955edcb633c673516fd4e13b390a517fff8d71379da1f457",
	name: "getStudio",
	filename: "src/lib/ora.ts"
}, (opts) => getStudio.__executeServer(opts));
var getStudio = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getStudio_createServerFn_handler, async ({ context }) => {
	const [row] = await (await getSql())`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors where user_id = ${context.userId}
    `;
	return row ? mapAdvisor(row) : null;
});
async function requireAdmin(userId, permission) {
	await ensureAccount(userId, await authName(userId));
	const sql = await getSql();
	await claimFirstOwner(userId);
	const [me] = await sql`
    select role, status from ora_profiles where user_id = ${userId}
  `;
	if (me?.status === "suspended") throw new Error("This account is suspended.");
	const [admin] = await sql`
    select role, permissions from ora_admins where user_id = ${userId}
  `;
	if (!admin) {
		if (me?.role === "admin") await grantAdmin(userId, userId, "owner");
		else throw new Error("Not admin");
	}
	if (!adminHasPermission(admin?.permissions ?? "*", permission)) throw new Error("Not admin");
}
var adminSnapshot_createServerFn_handler = createServerRpc({
	id: "d225f6a0b22956a73e8d515925bc691b8e8295ad1a72c6886652ec279e89f28f",
	name: "adminSnapshot",
	filename: "src/lib/ora.ts"
}, (opts) => adminSnapshot.__executeServer(opts));
var adminSnapshot = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminSnapshot_createServerFn_handler, async ({ context }) => {
	await ensureAccount(context.userId, await authName(context.userId));
	await requireAdmin(context.userId, "overview");
	const sql = await getSql();
	const applications = await sql`
      select id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, status, created_at, legal_name, languages, years
      from ora_applications order by created_at desc limit 40
    `;
	const advisors = await sql`
      select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins
      from ora_advisors order by name
    `;
	const wallets = await sql`
      select w.user_id, p.display_name, p.role, w.coins, w.bonus_seconds, w.weekly_seconds, w.subscribed
      from ora_wallets w join ora_profiles p on p.user_id = w.user_id
      order by p.created_at desc limit 40
    `;
	const readings = await sql`
      select id, client_id, advisor_id, seconds, coins_spent, advisor_earned, platform_fee, rate_coins, status, started_at
      from ora_readings order by started_at desc limit 30
    `;
	const [stats] = await sql`
      select
        (select count(*)::int from ora_profiles) as clients,
        (select count(*)::int from ora_applications where status = 'pending') as pending,
        (select count(*)::int from ora_advisors where status = 'live') as live,
        (select count(*)::int from ora_readings) as sessions,
        (select coalesce(sum(platform_fee), 0)::int from ora_readings) as commission
    `;
	return {
		stats: {
			clients: Number(stats?.clients ?? 0),
			pending: Number(stats?.pending ?? 0),
			live: Number(stats?.live ?? 0),
			sessions: Number(stats?.sessions ?? 0),
			commission: Number(stats?.commission ?? 0)
		},
		applications: applications.map((a) => ({
			...a,
			created_at: String(a.created_at)
		})),
		advisors: advisors.map(mapAdvisor),
		wallets,
		readings: readings.map((r) => ({
			...r,
			started_at: String(r.started_at)
		}))
	};
});
var adminDecide_createServerFn_handler = createServerRpc({
	id: "94755e3e800cd6cbd1381dfc3993aea414471be1298505cfb07f9cd3598ae512",
	name: "adminDecide",
	filename: "src/lib/ora.ts"
}, (opts) => adminDecide.__executeServer(opts));
var adminDecide = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	decision: input.decision === "approved" ? "approved" : "declined"
})).handler(adminDecide_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId, "advisors");
	const sql = await getSql();
	const [app] = await sql`
      select id, user_id, name, bio, experience, specialties, rate_coins, photo_url, video_url, legal_name, languages, years
      from ora_applications where id = ${data.id}
    `;
	if (!app) throw new Error("Missing application");
	if (data.decision === "approved") {
		const [existing] = await sql`
        select id from ora_advisors where user_id = ${app.user_id} limit 1
      `;
		const years = Math.min(60, Math.max(0, Math.floor(Number(app.years) || 0)));
		const rate = Math.min(80, Math.max(8, Number(app.rate_coins) || 20));
		const legal = String(app.legal_name ?? "");
		const languages = String(app.languages ?? "English") || "English";
		const [pe] = await sql`select email from ora_profiles where user_id = ${app.user_id}`;
		const email = pe?.email || "";
		if (existing) await sql`
          update ora_advisors
          set name = ${app.name}, bio = ${app.bio}, experience = ${app.experience},
              specialties = ${app.specialties}, rate_coins = ${rate},
              photo_url = ${app.photo_url}, video_url = ${app.video_url}, status = 'live',
              legal_name = ${legal}, languages = ${languages}, years = ${years},
              is_new = true, email = ${email}
          where id = ${existing.id}
        `;
		else {
			const base = app.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "advisor";
			const advId = rid("adv");
			const uniqueSlug = `${base}-${advId.slice(-6)}`;
			await sql`
          insert into ora_advisors (id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, legal_name, languages, years, is_new, email)
          values (${advId}, ${app.user_id}, ${app.name}, ${uniqueSlug}, ${app.bio}, ${app.experience}, ${app.specialties}, ${rate}, ${app.photo_url}, ${app.video_url}, 'live', ${legal}, ${languages}, ${years}, true, ${email})
        `;
		}
		await sql`update ora_profiles set role = 'advisor', display_name = ${app.name} where user_id = ${app.user_id}`;
	}
	await sql`update ora_applications set status = ${data.decision} where id = ${data.id}`;
	await auditLog(context.userId, data.decision === "approved" ? "approve_advisor" : "decline_advisor", "application", data.id, app.name);
	return { ok: true };
});
var adminSetAdvisor_createServerFn_handler = createServerRpc({
	id: "5de9be4b6ae19fb27893534c1be1818e27770090a45e5c5b83303ee4b188d3c5",
	name: "adminSetAdvisor",
	filename: "src/lib/ora.ts"
}, (opts) => adminSetAdvisor.__executeServer(opts));
var adminSetAdvisor = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	status: input.status === "paused" ? "paused" : "live"
})).handler(adminSetAdvisor_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId, "advisors");
	const sql = await getSql();
	if (data.status === "paused") await sql`update ora_advisors set status = 'paused', online = false, busy = false where id = ${data.id}`;
	else await sql`update ora_advisors set status = 'live' where id = ${data.id}`;
	await auditLog(context.userId, "set_advisor_status", "advisor", data.id, data.status);
	return { ok: true };
});
var adminGift_createServerFn_handler = createServerRpc({
	id: "894d1b1869cb2ba1561e9d67aa9da21849c5c380e5f32400320ffb0a3dcb4c9d",
	name: "adminGift",
	filename: "src/lib/ora.ts"
}, (opts) => adminGift.__executeServer(opts));
var adminGift = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	coins: Math.min(5e3, Math.max(1, Math.floor(Number(input.coins) || 0)))
})).handler(adminGift_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId, "finance");
	await (await getSql())`update ora_wallets set coins = coins + ${data.coins}, promo_coins = promo_coins + ${data.coins} where user_id = ${data.userId}`;
	await addLedger(data.userId, "gift", data.coins, 0, `Owner gift · ${data.coins} coins`);
	await auditLog(context.userId, "gift_coins", "wallet", data.userId, `${data.coins}c`);
	return { ok: true };
});
function formatClock(total) {
	const n = Math.max(0, Math.floor(Number.isFinite(Number(total)) ? Number(total) : 0));
	const m = Math.floor(n / 60);
	const s = n % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}
function includedSeconds(w) {
	return Math.max(0, Number(w?.bonusSeconds) || 0) + Math.max(0, Number(w?.weeklySeconds) || 0);
}
var getCustomer_createServerFn_handler = createServerRpc({
	id: "c5ad073ff9f5a2dd42b09e2c2ccba4b605fc2221ba18bf65e503373daf1c11f1",
	name: "getCustomer",
	filename: "src/lib/ora.ts"
}, (opts) => getCustomer.__executeServer(opts));
var getCustomer = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getCustomer_createServerFn_handler, async ({ context }) => {
	const me = await loadMe(context.userId);
	const sql = await getSql();
	const sessions = await sql`
      select r.id, a.name, a.slug, a.photo_url, r.seconds, r.coins_spent, r.advisor_earned, r.platform_fee,
             r.rate_coins, r.status, r.started_at, r.ended_at, rv.id as review_id
      from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      left join ora_reviews rv on rv.reading_id = r.id
      where r.client_id = ${context.userId}
      order by r.started_at desc
      limit 40
    `;
	const ledger = await sql`
      select id, kind, amount_coins, seconds, note, created_at
      from ora_ledger where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
	const favs = await sql`
      select a.id, a.user_id, a.name, a.slug, a.bio, a.experience, a.specialties, a.rate_coins,
             a.photo_url, a.video_url, a.status, a.trusted, a.is_new, a.rating, a.reviews,
             a.legal_name, a.languages, a.years, a.online, a.busy, a.payout_coins
      from ora_favorites f
      join ora_advisors a on a.id = f.advisor_id
      where f.user_id = ${context.userId} and a.status = 'live'
      order by f.created_at desc
    `;
	const payments = await sql`
      select id, coins, amount_cents, currency, status, provider, created_at, paid_at
      from ora_payments where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
	return {
		me,
		sessions: sessions.map((r) => ({
			id: r.id,
			advisorName: r.name,
			advisorSlug: r.slug,
			photoUrl: r.photo_url,
			seconds: Number(r.seconds),
			coinsSpent: Number(r.coins_spent),
			advisorEarned: Number(r.advisor_earned),
			platformFee: Number(r.platform_fee),
			rateCoins: Number(r.rate_coins) || 20,
			status: r.status,
			startedAt: String(r.started_at),
			endedAt: r.ended_at ? String(r.ended_at) : "",
			reviewed: Boolean(r.review_id)
		})),
		ledger: ledger.map((r) => ({
			id: r.id,
			kind: r.kind,
			amountCoins: Number(r.amount_coins),
			seconds: Number(r.seconds),
			note: r.note,
			createdAt: String(r.created_at)
		})),
		favorites: favs.map(mapAdvisor),
		payments: payments.map((p) => ({
			id: p.id,
			coins: Number(p.coins),
			amountCents: Number(p.amount_cents),
			currency: p.currency,
			status: p.status,
			provider: p.provider,
			createdAt: String(p.created_at),
			paidAt: p.paid_at ? String(p.paid_at) : ""
		}))
	};
});
var updateProfile_createServerFn_handler = createServerRpc({
	id: "c949df31487f9fc17ad01b3ecba84b9f40668156d7065c2305e8cf78b67f8b95",
	name: "updateProfile",
	filename: "src/lib/ora.ts"
}, (opts) => updateProfile.__executeServer(opts));
var updateProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ displayName: String(input.displayName).trim().slice(0, 80) })).handler(updateProfile_createServerFn_handler, async ({ context, data }) => {
	if (data.displayName.length < 2) throw new Error("Name is too short.");
	await ensureAccount(context.userId, data.displayName);
	await (await getSql())`update ora_profiles set display_name = ${data.displayName} where user_id = ${context.userId}`;
	return loadMe(context.userId);
});
var toggleFavorite_createServerFn_handler = createServerRpc({
	id: "80a145abc45b8f8eb28d7d4cb7699b6bf6b3a88e5024423aaa6ea077fe41a754",
	name: "toggleFavorite",
	filename: "src/lib/ora.ts"
}, (opts) => toggleFavorite.__executeServer(opts));
var toggleFavorite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(toggleFavorite_createServerFn_handler, async ({ context, data }) => {
	await ensureAccount(context.userId, await authName(context.userId));
	const sql = await getSql();
	const [adv] = await sql`
      select id from ora_advisors where (id = ${data.advisorId} or slug = ${data.advisorId}) and status = 'live'
    `;
	if (!adv) throw new Error("Advisor not available.");
	const [row] = await sql`
      select advisor_id from ora_favorites where user_id = ${context.userId} and advisor_id = ${adv.id}
    `;
	if (row) {
		await sql`delete from ora_favorites where user_id = ${context.userId} and advisor_id = ${adv.id}`;
		return { saved: false };
	}
	await sql`
      insert into ora_favorites (user_id, advisor_id) values (${context.userId}, ${adv.id})
    `;
	return { saved: true };
});
var isFavorite_createServerFn_handler = createServerRpc({
	id: "7f94a4c3e5848a0d2163601cab5a0e8151d6861e453ae41236d01084e1d4cdeb",
	name: "isFavorite",
	filename: "src/lib/ora.ts"
}, (opts) => isFavorite.__executeServer(opts));
var isFavorite = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(isFavorite_createServerFn_handler, async ({ context, data }) => {
	const [row] = await (await getSql())`
      select count(*)::int as n from ora_favorites f
      join ora_advisors a on a.id = f.advisor_id
      where f.user_id = ${context.userId} and (a.id = ${data.advisorId} or a.slug = ${data.advisorId})
    `;
	return { saved: Number(row?.n ?? 0) > 0 };
});
async function advisorForUser(userId) {
	const [row] = await (await getSql())`
    select id, user_id, name, slug, bio, experience, specialties, rate_coins, photo_url, video_url, status, trusted, is_new, rating, reviews, legal_name, languages, years, online, busy, payout_coins, pending_coins
    from ora_advisors where user_id = ${userId}
  `;
	return row ? mapAdvisor(row) : null;
}
var getDesk_createServerFn_handler = createServerRpc({
	id: "6e3656a01308ffde60310d67df0e4ef52316d005b6f670d393983aebffa0ccd3",
	name: "getDesk",
	filename: "src/lib/ora.ts"
}, (opts) => getDesk.__executeServer(opts));
var getDesk = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getDesk_createServerFn_handler, async ({ context }) => {
	const me = await loadMe(context.userId);
	const sql = await getSql();
	const advisor = await advisorForUser(context.userId);
	if (advisor) await maybeSettleAdvisorEarnings(advisor.id);
	const [app] = await sql`
      select status from ora_applications where user_id = ${context.userId} order by created_at desc limit 1
    `;
	if (advisor) await expireStaleRequests(advisor.id);
	const requests = advisor ? await sql`
          select r.id, coalesce(p.display_name, 'Client') as display_name, r.created_at
          from ora_chat_requests r
          left join ora_profiles p on p.user_id = r.client_id
          where r.advisor_id = ${advisor.id} and r.status = 'pending'
          order by r.created_at asc
        ` : [];
	const [live] = advisor ? await sql`
          select r.id, coalesce(p.display_name, 'Client') as display_name, r.seconds, r.coins_spent, r.advisor_earned
          from ora_readings r
          left join ora_profiles p on p.user_id = r.client_id
          where r.advisor_id = ${advisor.id} and r.status = 'live'
          order by r.started_at desc
          limit 1
        ` : [];
	let liveNow = live ?? null;
	if (live) {
		const bill = await settleReading(live.id);
		if (!bill || bill.status === "ended") liveNow = null;
		else liveNow = {
			...live,
			seconds: bill.seconds,
			coins_spent: bill.coinsSpent,
			advisor_earned: bill.advisorEarned
		};
	}
	const [earn] = advisor ? await sql`
          select
            coalesce(sum(case when started_at >= date_trunc('day', now()) then advisor_earned else 0 end), 0)::int as today,
            coalesce(sum(advisor_earned), 0)::int as total
          from ora_readings where advisor_id = ${advisor.id}
        ` : [{
		today: 0,
		total: 0
	}];
	const sessions = advisor ? await sql`
          select r.id, coalesce(p.display_name, 'Client') as display_name, r.seconds, r.coins_spent,
                 r.advisor_earned, r.platform_fee, r.rate_coins, r.status, r.started_at, r.ended_at
          from ora_readings r
          left join ora_profiles p on p.user_id = r.client_id
          where r.advisor_id = ${advisor.id}
          order by r.started_at desc
          limit 40
        ` : [];
	const reviews = advisor ? await sql`
          select id, rating, body, created_at from ora_reviews
          where advisor_id = ${advisor.id} and hidden = false order by created_at desc limit 20
        ` : [];
	const payouts = advisor ? await sql`
          select id, coins, usd, status, created_at from ora_payouts
          where advisor_id = ${advisor.id} order by created_at desc limit 20
        ` : [];
	return {
		me,
		advisor,
		applicationStatus: app?.status ?? null,
		requests: requests.map((r) => ({
			id: r.id,
			clientName: r.display_name,
			createdAt: String(r.created_at)
		})),
		live: liveNow ? {
			id: liveNow.id,
			clientName: liveNow.display_name,
			seconds: Number(liveNow.seconds),
			coinsSpent: Number(liveNow.coins_spent),
			advisorEarned: Number(liveNow.advisor_earned)
		} : null,
		earningsToday: Number(earn?.today ?? 0),
		earningsTotal: Number(earn?.total ?? 0),
		sessions: sessions.map((s) => ({
			id: s.id,
			advisorName: s.display_name,
			advisorSlug: "",
			photoUrl: "",
			seconds: Number(s.seconds),
			coinsSpent: Number(s.coins_spent),
			advisorEarned: Number(s.advisor_earned),
			platformFee: Number(s.platform_fee),
			rateCoins: Number(s.rate_coins) || 20,
			status: s.status,
			startedAt: String(s.started_at),
			endedAt: s.ended_at ? String(s.ended_at) : "",
			reviewed: false
		})),
		reviews: reviews.map((r) => ({
			id: r.id,
			rating: Number(r.rating),
			body: r.body,
			createdAt: String(r.created_at)
		})),
		payouts: payouts.map((p) => ({
			id: p.id,
			coins: Number(p.coins),
			usd: Number(p.usd),
			status: p.status,
			createdAt: String(p.created_at)
		}))
	};
});
var getInbox_createServerFn_handler = createServerRpc({
	id: "4d6ea151ed6f9eb9b3445d49e3c55c407d0b69d1cc62ae946480a0ace9e7565e",
	name: "getInbox",
	filename: "src/lib/ora.ts"
}, (opts) => getInbox.__executeServer(opts));
var getInbox = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getInbox_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const [adv] = await sql`
      select id, online, busy from ora_advisors where user_id = ${context.userId} limit 1
    `;
	if (!adv) return {
		online: false,
		busy: false,
		live: null,
		requests: []
	};
	await expireStaleRequests(adv.id);
	const requests = await sql`
      select r.id, coalesce(p.display_name, 'Client') as display_name, r.created_at
      from ora_chat_requests r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${adv.id} and r.status = 'pending'
      order by r.created_at asc
    `;
	const [live] = await sql`
      select r.id, coalesce(p.display_name, 'Client') as display_name, r.seconds, r.coins_spent, r.advisor_earned
      from ora_readings r
      left join ora_profiles p on p.user_id = r.client_id
      where r.advisor_id = ${adv.id} and r.status = 'live'
      order by r.started_at desc
      limit 1
    `;
	return {
		online: Boolean(adv.online),
		busy: Boolean(adv.busy),
		live: live ? {
			id: live.id,
			clientName: live.display_name,
			seconds: Number(live.seconds),
			coinsSpent: Number(live.coins_spent),
			advisorEarned: Number(live.advisor_earned)
		} : null,
		requests: requests.map((r) => ({
			id: r.id,
			clientName: r.display_name,
			createdAt: String(r.created_at)
		}))
	};
});
var setOnline_createServerFn_handler = createServerRpc({
	id: "40020ac503afe580e27fedbb158ca6ca0151f4a8bebdac3169d124af270aadec",
	name: "setOnline",
	filename: "src/lib/ora.ts"
}, (opts) => setOnline.__executeServer(opts));
var setOnline = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ online: Boolean(input.online) })).handler(setOnline_createServerFn_handler, async ({ context, data }) => {
	const advisor = await advisorForUser(context.userId);
	if (!advisor || advisor.status !== "live") throw new Error("Only approved advisors can go online.");
	await assertActive(context.userId);
	if (advisor.busy && !data.online) throw new Error("End the session before going offline.");
	const sql = await getSql();
	if (!data.online) {
		await sql`update ora_advisors set online = false, busy = false where id = ${advisor.id}`;
		await sql`update ora_chat_requests set status = 'expired' where advisor_id = ${advisor.id} and status = 'pending'`;
	} else await sql`update ora_advisors set online = true where id = ${advisor.id}`;
	return advisorForUser(context.userId);
});
var decideRequest_createServerFn_handler = createServerRpc({
	id: "d17f8d2ac4f4f0b1a098519bea74286a691e9983313aae325b6759a70b4916d7",
	name: "decideRequest",
	filename: "src/lib/ora.ts"
}, (opts) => decideRequest.__executeServer(opts));
var decideRequest = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	accept: Boolean(input.accept)
})).handler(decideRequest_createServerFn_handler, async ({ context, data }) => {
	const advisor = await advisorForUser(context.userId);
	if (!advisor || advisor.status !== "live") throw new Error("Not an approved advisor.");
	if (!advisor.online) throw new Error("Go online first.");
	if (advisor.busy) throw new Error("You are already in a session.");
	const sql = await getSql();
	const [req] = await sql`
      select id, client_id, status from ora_chat_requests
      where id = ${data.id} and advisor_id = ${advisor.id}
    `;
	if (!req || req.status !== "pending") throw new Error("That request is gone.");
	if (!data.accept) {
		await sql`update ora_chat_requests set status = 'declined' where id = ${req.id}`;
		return { readingId: "" };
	}
	if (!await walletCanPay(req.client_id)) {
		await sql`update ora_chat_requests set status = 'declined' where id = ${req.id}`;
		throw new Error("Client has no time or coins left.");
	}
	const readingId = await openReading(req.client_id, {
		id: advisor.id,
		name: advisor.name,
		user_id: advisor.userId,
		rate_coins: advisor.rateCoins
	}, `I'm ${advisor.name}. I'm with you now — tell me what you need.`);
	await sql`
      update ora_chat_requests set status = 'accepted', reading_id = ${readingId} where id = ${req.id}
    `;
	await sql`
      update ora_chat_requests set status = 'expired'
      where advisor_id = ${advisor.id} and status = 'pending' and id <> ${req.id}
    `;
	return { readingId };
});
var getRequest_createServerFn_handler = createServerRpc({
	id: "814c69ab0d157abdc599be4d0d380d9a656fb78cc2fe9b429563a23de5535c51",
	name: "getRequest",
	filename: "src/lib/ora.ts"
}, (opts) => getRequest.__executeServer(opts));
var getRequest = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(getRequest_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const [row] = await sql`
      select status, reading_id, created_at from ora_chat_requests
      where id = ${data.id} and client_id = ${context.userId}
    `;
	if (!row) return {
		status: "missing",
		readingId: ""
	};
	if (row.status === "pending") {
		const age = Date.now() - new Date(row.created_at).getTime();
		if (Number.isFinite(age) && age > 18e4) {
			await sql`
          update ora_chat_requests set status = 'expired'
          where id = ${data.id} and client_id = ${context.userId} and status = 'pending'
        `;
			return {
				status: "expired",
				readingId: ""
			};
		}
	}
	return {
		status: row.status,
		readingId: row.reading_id || ""
	};
});
var cancelRequest_createServerFn_handler = createServerRpc({
	id: "74d13e144c8e0c60e5daf6bf4ac999e7fcb4293272dfc02a677fd7f677ee63d2",
	name: "cancelRequest",
	filename: "src/lib/ora.ts"
}, (opts) => cancelRequest.__executeServer(opts));
var cancelRequest = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(cancelRequest_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      update ora_chat_requests set status = 'expired'
      where id = ${data.id} and client_id = ${context.userId} and status = 'pending'
    `;
	return { ok: true };
});
var sendAdvisorMessage_createServerFn_handler = createServerRpc({
	id: "d95da643b8c22fa72ed1f936f2ad096076784ae05d7f8c26342e0bedf124417e",
	name: "sendAdvisorMessage",
	filename: "src/lib/ora.ts"
}, (opts) => sendAdvisorMessage.__executeServer(opts));
var sendAdvisorMessage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	body: String(input.body).trim().slice(0, 800)
})).handler(sendAdvisorMessage_createServerFn_handler, async ({ context, data }) => {
	if (!data.body) throw new Error("Write something first.");
	const advisor = await advisorForUser(context.userId);
	if (!advisor) throw new Error("Not an advisor.");
	const sql = await getSql();
	const [owned] = await sql`
      select id from ora_readings where id = ${data.id} and advisor_id = ${advisor.id}
    `;
	if (!owned) throw new Error("This reading has ended.");
	const bill = await settleReading(data.id);
	if (!bill || bill.status !== "live") throw new Error("This reading has ended.");
	const [reading] = await sql`
      select id, status from ora_readings where id = ${data.id} and advisor_id = ${advisor.id}
    `;
	if (!reading || reading.status !== "live") throw new Error("This reading has ended.");
	const id = rid("msg");
	await sql`
      insert into ora_messages (id, reading_id, role, body)
      values (${id}, ${data.id}, 'advisor', ${data.body})
    `;
	return {
		id,
		role: "advisor",
		body: data.body
	};
});
var requestPayout_createServerFn_handler = createServerRpc({
	id: "c595b1a3ac1fc5cb38ceb54be7ed953789a44f882aa3eb9d2492cd56fd34f335",
	name: "requestPayout",
	filename: "src/lib/ora.ts"
}, (opts) => requestPayout.__executeServer(opts));
var requestPayout = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ coins: Math.min(5e4, Math.max(1, Math.floor(Number(input.coins) || 0))) })).handler(requestPayout_createServerFn_handler, async ({ context, data }) => {
	const advisor = await advisorForUser(context.userId);
	if (!advisor || advisor.status !== "live") throw new Error("Not an approved advisor.");
	await settleAdvisorEarnings(advisor.id);
	const fresh = await advisorForUser(context.userId);
	if (!fresh) throw new Error("Not an approved advisor.");
	const settings = await loadSettings();
	if (data.coins < settings.minPayoutCoins) throw new Error(`Minimum withdrawal is ${settings.minPayoutCoins} coins.`);
	const sql = await getSql();
	if (!(await sql`
      update ora_advisors
      set payout_coins = payout_coins - ${data.coins}
      where id = ${fresh.id} and payout_coins >= ${data.coins}
      returning id
    `).length) throw new Error("Not enough available earnings.");
	const id = rid("pay");
	const usd = data.coins / COINS_PER_DOLLAR;
	const cents = Math.round(usd * 100);
	try {
		await sql`
        insert into ora_payouts (id, user_id, advisor_id, coins, usd, status, currency, amount_cents)
        values (${id}, ${context.userId}, ${fresh.id}, ${data.coins}, ${usd}, 'requested', ${settings.currency}, ${cents})
      `;
	} catch (e) {
		await sql`update ora_advisors set payout_coins = payout_coins + ${data.coins} where id = ${fresh.id}`;
		throw e instanceof Error ? e : /* @__PURE__ */ new Error("Could not request payout.");
	}
	return {
		ok: true,
		coins: data.coins,
		usd
	};
});
var leaveReview_createServerFn_handler = createServerRpc({
	id: "aeb8f2789a4ce97b5cffe1d41288fcf9a53e51e88e18e9c1c5be2ca6d5de772e",
	name: "leaveReview",
	filename: "src/lib/ora.ts"
}, (opts) => leaveReview.__executeServer(opts));
var leaveReview = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	readingId: String(input.readingId).slice(0, 64),
	rating: Math.min(5, Math.max(1, Math.floor(Number(input.rating) || 5))),
	body: String(input.body ?? "").trim().slice(0, 400)
})).handler(leaveReview_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const [reading] = await sql`
      select id, advisor_id, status from ora_readings
      where id = ${data.readingId} and client_id = ${context.userId}
    `;
	if (!reading) throw new Error("Reading not found.");
	if (reading.status !== "ended") throw new Error("Rate the sitting after it ends.");
	const id = rid("rev");
	const [existing] = await sql`
      select id from ora_reviews where reading_id = ${reading.id} limit 1
    `;
	if (existing) await sql`
        update ora_reviews set rating = ${data.rating}, body = ${data.body} where reading_id = ${reading.id}
      `;
	else await sql`
        insert into ora_reviews (id, reading_id, client_id, advisor_id, rating, body)
        values (${id}, ${reading.id}, ${context.userId}, ${reading.advisor_id}, ${data.rating}, ${data.body})
      `;
	const [agg] = await sql`
      select avg(rating)::numeric(2,1) as avg, count(*)::int as n
      from ora_reviews where advisor_id = ${reading.advisor_id} and hidden = false
    `;
	await sql`
      update ora_advisors set rating = ${Number(agg?.avg ?? 5)}, reviews = ${Number(agg?.n ?? 1)}
      where id = ${reading.advisor_id}
    `;
	return { ok: true };
});
var saveAdvisorProfile_createServerFn_handler = createServerRpc({
	id: "086be0b21195534be58a477f86d901e8733c6e4dda06b376a49a8d93bc069733",
	name: "saveAdvisorProfile",
	filename: "src/lib/ora.ts"
}, (opts) => saveAdvisorProfile.__executeServer(opts));
var saveAdvisorProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	name: String(input.name).trim().slice(0, 80),
	bio: String(input.bio).trim().slice(0, 1200),
	experience: String(input.experience).trim().slice(0, 800),
	specialties: String(input.specialties).trim().slice(0, 120),
	rateCoins: Math.min(80, Math.max(8, Number(input.rateCoins) || 20)),
	languages: String(input.languages).trim().slice(0, 80) || "English",
	years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
	photoUrl: input.photoUrl ? String(input.photoUrl).slice(0, 4e5) : void 0
})).handler(saveAdvisorProfile_createServerFn_handler, async ({ context, data }) => {
	const advisor = await advisorForUser(context.userId);
	if (!advisor) throw new Error("Not an advisor.");
	const sql = await getSql();
	if (data.photoUrl) await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience},
            specialties = ${data.specialties}, rate_coins = ${data.rateCoins},
            languages = ${data.languages}, years = ${data.years}, photo_url = ${data.photoUrl}
        where id = ${advisor.id}
      `;
	else await sql`
        update ora_advisors
        set name = ${data.name}, bio = ${data.bio}, experience = ${data.experience},
            specialties = ${data.specialties}, rate_coins = ${data.rateCoins},
            languages = ${data.languages}, years = ${data.years}
        where id = ${advisor.id}
      `;
	return advisorForUser(context.userId);
});
//#endregion
export { adminDecide_createServerFn_handler, adminGift_createServerFn_handler, adminSetAdvisor_createServerFn_handler, adminSnapshot_createServerFn_handler, applyAdvisor_createServerFn_handler, buyCoins_createServerFn_handler, cancelRequest_createServerFn_handler, decideRequest_createServerFn_handler, endReading_createServerFn_handler, getAdvisor_createServerFn_handler, getCustomer_createServerFn_handler, getDesk_createServerFn_handler, getInbox_createServerFn_handler, getMe_createServerFn_handler, getPublicSettings_createServerFn_handler, getReading_createServerFn_handler, getRequest_createServerFn_handler, getStudio_createServerFn_handler, isFavorite_createServerFn_handler, leaveReview_createServerFn_handler, listAdvisors_createServerFn_handler, listCategories_createServerFn_handler, listFloor_createServerFn_handler, listMessages_createServerFn_handler, requestChat_createServerFn_handler, requestPayout_createServerFn_handler, saveAdvisorProfile_createServerFn_handler, saveStudio_createServerFn_handler, sendAdvisorMessage_createServerFn_handler, sendMessage_createServerFn_handler, setOnline_createServerFn_handler, startReading_createServerFn_handler, subscribe_createServerFn_handler, syncReading_createServerFn_handler, tickReading_createServerFn_handler, toggleFavorite_createServerFn_handler, updateProfile_createServerFn_handler };

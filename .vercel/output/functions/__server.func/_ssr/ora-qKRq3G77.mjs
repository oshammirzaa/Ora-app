import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { i as getSql, t as authMiddleware } from "./middleware-DaHnGAQf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ora-qKRq3G77.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var COIN_PACKS = [
	{
		id: "10",
		coins: 10,
		usd: 1
	},
	{
		id: "50",
		coins: 50,
		usd: 5
	},
	{
		id: "100",
		coins: 100,
		usd: 10
	},
	{
		id: "300",
		coins: 300,
		usd: 25
	}
];
function rid(prefix) {
	return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
var DEFAULT_SETTINGS = {
	name: "Ora",
	logoUrl: "",
	supportEmail: "",
	currency: "USD",
	platformShare: 30,
	welcomeSeconds: 180,
	weeklySeconds: 180,
	welcomeCoins: 0,
	minPayoutCoins: 50,
	payoutHoldHours: 0
};
var settingsMemo = null;
function invalidateSettings() {
	settingsMemo = null;
}
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
			welcomeSeconds: Math.min(1800, Math.max(0, Number(row.welcome_seconds) || 180)),
			weeklySeconds: Math.min(1800, Math.max(0, Number(row.weekly_seconds) || 180)),
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
var getPublicSettings = createServerFn({ method: "GET" }).handler(createSsrRpc("112aa346ec80a3eda219ab7e080bb579a47f1a0bb9ed7e26060cd319b6a7eda2"));
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
function invalidateCategories() {
	categoriesMemo = null;
}
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
createServerFn({ method: "GET" }).handler(createSsrRpc("08656a14e98632773fbad498117c874b333fc7c89d0fa3311d6ae28e829cc206"));
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
async function closeReadingById(id) {
	await settleReading(id);
	const sql = await getSql();
	const [row] = await sql`select client_id from ora_readings where id = ${id}`;
	await sql`
    update ora_readings set status = 'ended', ended_at = coalesce(ended_at, now())
    where id = ${id} and status = 'live'
  `;
	if (row) await logReadingOnce(row.client_id, id);
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
function sameMessages(a, b) {
	if (!Array.isArray(a) || !Array.isArray(b)) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		const left = a[i];
		const right = b[i];
		if (!left || !right || left.id !== right.id || left.body !== right.body) return false;
	}
	return true;
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
function mergeMessages(current, extra) {
	return normalizeMessages([...Array.isArray(current) ? current : [], ...extra]);
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
async function revokeAdmin(userId) {
	const sql = await getSql();
	await sql`delete from ora_admins where user_id = ${userId}`;
	await sql`update ora_profiles set role = 'client' where user_id = ${userId} and role = 'admin'`;
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
var getMe = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("2801ef905aac0d5d9d09169ac3ac9bd6c47ac3c796ec67e0f914ff3b2e56c427"));
createServerFn({ method: "GET" }).handler(createSsrRpc("95d582db7e9a32958c7a8c61b475821907a1c322a6f6afda2429d99e5eee5964"));
createServerFn({ method: "GET" }).handler(createSsrRpc("3c026eeb98e984ea150bb1be200ce2945c77c2f2aecf5bce9ac22885d32751cc"));
var getAdvisor = createServerFn({ method: "GET" }).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("809f94a08c254a1f7fda20d30dd6e4da0933d4a061a912992ae2f177818fdcf0"));
var subscribe = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("0cabade028403be618ba1a9ed0145d284bdda7fee87b76d123bdf879f2ec3321"));
var buyCoins = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ packId: String(input.packId) })).handler(createSsrRpc("d1530b7d9363d412afc6a5a9f7c36f17f2f21d9aefe11c36751fa0aa9babb86d"));
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
})).handler(createSsrRpc("9ee962e92e4aa143aae7d1c5d4d2457287537d150cf209c128cefdf8d7c24b24"));
createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(createSsrRpc("ebe9c9546b8290b549f6d14e68e749f8146f5284bbdf4fb01e3d4aa235134672"));
var requestChat = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(createSsrRpc("b1cf413135b8187796d3c6ce4fa363c9b739c2b39a8d5a81d614d233aaf35dd9"));
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
		lowBalance: status === "live" && remaining > 0 && remaining <= 60,
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
var tickReading = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("c7eed7fa22056ce088c1d85d1dc9ef2cbbd90e9cb5073868d81cc5f10183e124"));
var endReading = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("19c677d4e2a8925c6e132eaee01a9b46f44053629cec33e37a8ef085e8c00e3f"));
var getReading = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("586d1c8211b4c1fe0c9d2384f7229c6b4b1bc5b1356599298f19445607facd58"));
createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("88d5e716ce710e94896a84dc742785f47e70607db6a80364bf9f4f87cb099b6e"));
var syncReading = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("75e2bfae3e0a9041caa5caf718ab886f1aa1ee04c573ab3c87a2db2a2d367166"));
var sendMessage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	body: String(input.body).trim().slice(0, 800)
})).handler(createSsrRpc("c342deb35738e4dded377a0b8a337e042555073f074c8ca9a2a97b197c50eb14"));
var saveStudio = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	bio: String(input.bio).trim().slice(0, 1200),
	experience: String(input.experience).trim().slice(0, 800),
	specialties: String(input.specialties).trim().slice(0, 120),
	rateCoins: Math.min(80, Math.max(8, Number(input.rateCoins) || 20)),
	photoUrl: input.photoUrl ? String(input.photoUrl).slice(0, 4e5) : void 0,
	videoUrl: String(input.videoUrl ?? "").slice(0, 500)
})).handler(createSsrRpc("16e0edf658c83dc3f9ad8840e1745534b919381744b1f22a3e0872a512f964ad"));
var getStudio = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("3d87d420071a5e9d955edcb633c673516fd4e13b390a517fff8d71379da1f457"));
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
createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("d225f6a0b22956a73e8d515925bc691b8e8295ad1a72c6886652ec279e89f28f"));
var adminDecide = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	decision: input.decision === "approved" ? "approved" : "declined"
})).handler(createSsrRpc("94755e3e800cd6cbd1381dfc3993aea414471be1298505cfb07f9cd3598ae512"));
createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	status: input.status === "paused" ? "paused" : "live"
})).handler(createSsrRpc("5de9be4b6ae19fb27893534c1be1818e27770090a45e5c5b83303ee4b188d3c5"));
createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	coins: Math.min(5e3, Math.max(1, Math.floor(Number(input.coins) || 0)))
})).handler(createSsrRpc("894d1b1869cb2ba1561e9d67aa9da21849c5c380e5f32400320ffb0a3dcb4c9d"));
function formatClock(total) {
	const n = Math.max(0, Math.floor(Number.isFinite(Number(total)) ? Number(total) : 0));
	const m = Math.floor(n / 60);
	const s = n % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}
function formatMoney(cents, currency = "USD") {
	const n = Math.max(0, Number(cents) || 0) / 100;
	try {
		return new Intl.NumberFormat(void 0, {
			style: "currency",
			currency: currency || "USD"
		}).format(n);
	} catch {
		return `${n.toFixed(2)} ${currency || "USD"}`;
	}
}
function formatWhen(iso) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString(void 0, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
function includedSeconds(w) {
	return Math.max(0, Number(w?.bonusSeconds) || 0) + Math.max(0, Number(w?.weeklySeconds) || 0);
}
var getCustomer = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("c5ad073ff9f5a2dd42b09e2c2ccba4b605fc2221ba18bf65e503373daf1c11f1"));
var updateProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ displayName: String(input.displayName).trim().slice(0, 80) })).handler(createSsrRpc("c949df31487f9fc17ad01b3ecba84b9f40668156d7065c2305e8cf78b67f8b95"));
var toggleFavorite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(createSsrRpc("80a145abc45b8f8eb28d7d4cb7699b6bf6b3a88e5024423aaa6ea077fe41a754"));
var isFavorite = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ advisorId: String(input.advisorId).slice(0, 64) })).handler(createSsrRpc("7f94a4c3e5848a0d2163601cab5a0e8151d6861e453ae41236d01084e1d4cdeb"));
var getDesk = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("6e3656a01308ffde60310d67df0e4ef52316d005b6f670d393983aebffa0ccd3"));
var getInbox = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("4d6ea151ed6f9eb9b3445d49e3c55c407d0b69d1cc62ae946480a0ace9e7565e"));
var setOnline = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ online: Boolean(input.online) })).handler(createSsrRpc("40020ac503afe580e27fedbb158ca6ca0151f4a8bebdac3169d124af270aadec"));
var decideRequest = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	accept: Boolean(input.accept)
})).handler(createSsrRpc("d17f8d2ac4f4f0b1a098519bea74286a691e9983313aae325b6759a70b4916d7"));
var getRequest = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("814c69ab0d157abdc599be4d0d380d9a656fb78cc2fe9b429563a23de5535c51"));
var cancelRequest = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("74d13e144c8e0c60e5daf6bf4ac999e7fcb4293272dfc02a677fd7f677ee63d2"));
var sendAdvisorMessage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	body: String(input.body).trim().slice(0, 800)
})).handler(createSsrRpc("d95da643b8c22fa72ed1f936f2ad096076784ae05d7f8c26342e0bedf124417e"));
var requestPayout = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ coins: Math.min(5e4, Math.max(1, Math.floor(Number(input.coins) || 0))) })).handler(createSsrRpc("c595b1a3ac1fc5cb38ceb54be7ed953789a44f882aa3eb9d2492cd56fd34f335"));
var leaveReview = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	readingId: String(input.readingId).slice(0, 64),
	rating: Math.min(5, Math.max(1, Math.floor(Number(input.rating) || 5))),
	body: String(input.body ?? "").trim().slice(0, 400)
})).handler(createSsrRpc("aeb8f2789a4ce97b5cffe1d41288fcf9a53e51e88e18e9c1c5be2ca6d5de772e"));
var saveAdvisorProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	name: String(input.name).trim().slice(0, 80),
	bio: String(input.bio).trim().slice(0, 1200),
	experience: String(input.experience).trim().slice(0, 800),
	specialties: String(input.specialties).trim().slice(0, 120),
	rateCoins: Math.min(80, Math.max(8, Number(input.rateCoins) || 20)),
	languages: String(input.languages).trim().slice(0, 80) || "English",
	years: Math.min(60, Math.max(0, Math.floor(Number(input.years) || 0))),
	photoUrl: input.photoUrl ? String(input.photoUrl).slice(0, 4e5) : void 0
})).handler(createSsrRpc("086be0b21195534be58a477f86d901e8733c6e4dda06b376a49a8d93bc069733"));
//#endregion
export { leaveReview as A, sameMessages as B, getStudio as C, invalidateSettings as D, invalidateCategories as E, requestChat as F, setOnline as G, saveStudio as H, requestPayout as I, tickReading as J, subscribe as K, requireAdmin as L, loadSettings as M, mapAdvisor as N, isFavorite as O, mergeMessages as P, revokeAdmin as R, getRequest as S, includedSeconds as T, sendAdvisorMessage as U, saveAdvisorProfile as V, sendMessage as W, updateProfile as X, toggleFavorite as Y, getDesk as _, auditLog as a, getPublicSettings as b, closeReadingById as c, endReading as d, formatClock as f, getCustomer as g, getAdvisor as h, applyAdvisor as i, loadCategories as j, isHouseAdvisor as k, createSsrRpc as l, formatWhen as m, addLedger as n, buyCoins as o, formatMoney as p, syncReading as q, adminDecide as r, cancelRequest as s, COIN_PACKS as t, decideRequest as u, getInbox as v, grantAdmin as w, getReading as x, getMe as y, rid as z };

import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-DaHnGAQf.mjs";
import { l as createSsrRpc } from "./ora-qKRq3G77.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ora-admin-Uuns6yB9.js
function stamp(input) {
	return { t: Math.floor(Number(input?.t) || Date.now()) };
}
var adminSession = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("89d826a7feb503e62e6147cf25a5211fcee41df86b463c05986d7b31b3807ce9"));
var adminOverview = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("875618004ca83473a8c079a6564a884fee3943548119ca1e3ddc5f80ad7e3e3f"));
var adminAdvisors = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("9289a40cb0e0b3b7f9b2aca62ce03df9bafec57acc25db704b2e6c79976bca05"));
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
})).handler(createSsrRpc("0142e604076d5ae1a6bb465af1d6d05d629ac3c722d53fd9d0820b70bc572aa1"));
var adminCustomers = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({
	q: String(input?.q ?? "").trim().slice(0, 80),
	t: Math.floor(Number(input?.t) || Date.now())
})).handler(createSsrRpc("e8cd84f81633f3b7894136303933d61ce6609a07038d4c930a9ac20399f9740f"));
var adminSetCustomer = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	status: input.status === "suspended" ? "suspended" : input.status === "active" ? "active" : "",
	role: input.role === "admin" ? "admin" : input.role === "client" ? "client" : ""
})).handler(createSsrRpc("3fdd605fc76b9dd4f179c81375270037dcc10fd7d78c4584c7187c76ee297b43"));
var adminCustomerActivity = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	t: Math.floor(Number(input.t) || Date.now())
})).handler(createSsrRpc("6a0b695bb8769a70415f4ea947e1b2c3508b87d6fa7ad2908ba05098ed154676"));
var adminSessions = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("4afd7e319cbfecb711192947b9f6931f3acdc843f09a2c2dcefad02050218724"));
var adminEndSession = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("98ea12cb348fc7d01e107a2e4a6caae5081a32e46907d0229beea9ac9d974b3d"));
var adminFinance = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("52c1c59cb511a4cfdc4c570b22bb5bb9d162ce0b72ea63b016097743d3e5f3b9"));
var adminRefundPayment = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("d002d964f9e4e615ef9fe587a66f85b361805be8913b4b2cfa43ed50edf72fb3"));
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
})).handler(createSsrRpc("dbb9eb082d3ae2ca5c4df7959875c4b205ac36ea4d4482d3287374aac31da40e"));
var adminPayouts = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("8254fbedeed338370bce0bde0676da7d684a7320a338dbf62bac66528f8d03a6"));
var adminDecidePayout = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	accept: Boolean(input.accept),
	note: String(input.note ?? "").trim().slice(0, 200)
})).handler(createSsrRpc("355fccfe24a6e8bacf2b4b5d1170d13b5e5baf8a930e437487324c8ebddb4956"));
var adminSettings = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("f41a653c8eb7649d53804d889e352331afedcc7c3ef21517bb49b2eaea91d7e0"));
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
})).handler(createSsrRpc("e02049ae3f3315bf2665c3b590439345e2ad6b0b95ff09c1669c271b6a8fbf15"));
var adminAllCategories = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("e8ea43a9789082a4873650034e8350a93df4519636be7388c943bc62a989d0c3"));
var adminSaveCategory = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id ?? "").slice(0, 64),
	name: String(input.name).trim().slice(0, 40),
	active: input.active !== false
})).handler(createSsrRpc("b8770b339a98c088a26e7fde6fe7a6b5b996ab4159ec7d1d1bdb2e8324d0bf72"));
var adminDeleteCategory = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({ id: String(input.id).slice(0, 64) })).handler(createSsrRpc("f1ad0b441c268d1fed4fe643792340d5cc5e21dd4a6027ca2e485970eef95b21"));
var adminReorderCategory = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	dir: input.dir === "down" ? "down" : "up"
})).handler(createSsrRpc("5e906db3b5d075c7f33bb5e8f7a3785e5a6e091a5ce024dec438c56ec8699b94"));
var adminPromos = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("b76c3fa98435bf05747c721616b8e80dca7ff21b365f66d8e56b6184e3b120c3"));
var adminSavePromo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id ?? "").slice(0, 64),
	name: String(input.name).trim().slice(0, 80),
	kind: input.kind === "coins" ? "coins" : "minutes",
	amount: Math.min(1800, Math.max(1, Math.floor(Number(input.amount) || 0))),
	active: input.active !== false,
	note: String(input.note ?? "").trim().slice(0, 200)
})).handler(createSsrRpc("b3fdbaa93c8545448602de0f201191ff2591aa8ceb058cef73e298569d13c25b"));
var adminGrantPromo = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	userId: String(input.userId).slice(0, 128),
	promoId: String(input.promoId).slice(0, 64)
})).handler(createSsrRpc("bbfdd56b60f60aea183b7730ae7c963809ccd32729173a33e2fcbbad1fc28ffa"));
var adminReviews = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(stamp).handler(createSsrRpc("9e4d2f72b789f666b9c2530c12fb983370af56cda216a981c89a81bbd884d2a2"));
var adminModerateReview = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => ({
	id: String(input.id).slice(0, 64),
	hidden: Boolean(input.hidden)
})).handler(createSsrRpc("9ab6fb88ef65483d1293cce42bc883d600baf463907828384f21e674f6d504b6"));
var adminReports = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({
	days: Math.min(90, Math.max(7, Math.floor(Number(input?.days) || 14))),
	t: Math.floor(Number(input?.t) || Date.now())
})).handler(createSsrRpc("01cd4167a05b1384c248a2d54b4cd84ada05bb5a4af4f4006d4ca031dd1b9efe"));
var adminAudit = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((input) => ({ t: Math.floor(Number(input?.t) || Date.now()) })).handler(createSsrRpc("482dfff08e14133df6d83404c9772ca27f7803b38af50ba3a61d6d6ec55f4d7c"));
//#endregion
export { adminSession as C, adminUpdateAdvisor as D, adminSettings as E, adminSaveSettings as S, adminSetCustomer as T, adminReorderCategory as _, adminCustomerActivity as a, adminSaveCategory as b, adminDeleteCategory as c, adminGrantPromo as d, adminModerateReview as f, adminRefundPayment as g, adminPromos as h, adminAudit as i, adminEndSession as l, adminPayouts as m, adminAdvisors as n, adminCustomers as o, adminOverview as p, adminAllCategories as r, adminDecidePayout as s, adminAdjust as t, adminFinance as u, adminReports as v, adminSessions as w, adminSavePromo as x, adminReviews as y };

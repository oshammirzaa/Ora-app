import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as createRootRoute, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, v as Link, x as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as createServerFn, s as __exportAll } from "./ssr.mjs";
import { h as getAdvisor, l as createSsrRpc } from "./ora-qKRq3G77.mjs";
import { r as uid, t as cn } from "./utils-CT3EiHu6.mjs";
import { L as string, N as number, P as object, R as union, j as literal } from "../_libs/@better-auth/core+[...].mjs";
import { n as auth } from "./server-D1a15mPm.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { o as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hunt-shell-78p2XsHh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PLANS = [
	{
		id: "starter",
		name: "Starter",
		tagline: "News, entertainment, and a clean Fire TV app.",
		usdMonth: 12.99,
		pkrMonth: 3499,
		usdYear: 119,
		pkrYear: 32999,
		devices: 1,
		features: [
			"Live news & entertainment",
			"On-demand movies & series",
			"1 screen at a time",
			"Works on Fire TV Stick",
			"Email setup in under 10 minutes"
		]
	},
	{
		id: "family",
		name: "Family",
		tagline: "The one most households keep.",
		usdMonth: 22.99,
		pkrMonth: 5999,
		usdYear: 199,
		pkrYear: 54999,
		devices: 3,
		popular: true,
		features: [
			"Everything in Starter",
			"Kids profiles & parental pin",
			"3 screens at once",
			"HD on Fire TV, phones, tablets",
			"Priority WhatsApp support"
		]
	},
	{
		id: "sports",
		name: "Sports+",
		tagline: "Match days without hunting for a stream.",
		usdMonth: 34.99,
		pkrMonth: 8999,
		usdYear: 299,
		pkrYear: 79999,
		devices: 4,
		features: [
			"Everything in Family",
			"Live football, cricket, and more",
			"4 screens, including a spare for guests",
			"Match-day alerts",
			"Same-day activation"
		]
	}
];
var PLATFORMS = [
	{
		id: "tiktok",
		label: "TikTok"
	},
	{
		id: "facebook",
		label: "Facebook"
	},
	{
		id: "instagram",
		label: "Instagram"
	},
	{
		id: "whatsapp",
		label: "WhatsApp"
	},
	{
		id: "website",
		label: "Website"
	},
	{
		id: "bot",
		label: "Ember bot"
	},
	{
		id: "reddit",
		label: "Reddit"
	},
	{
		id: "other",
		label: "Other"
	}
];
var STATUSES = [
	{
		id: "new",
		label: "New"
	},
	{
		id: "contacted",
		label: "Contacted"
	},
	{
		id: "interested",
		label: "Interested"
	},
	{
		id: "sold",
		label: "Sold"
	},
	{
		id: "lost",
		label: "Lost"
	}
];
function searchUrl(network, query) {
	const q = encodeURIComponent(query);
	if (network === "tiktok") return `https://www.tiktok.com/search?q=${q}`;
	if (network === "facebook") return `https://www.facebook.com/search/posts?q=${q}`;
	if (network === "instagram") return `https://www.instagram.com/explore/search/keyword/?q=${q}`;
	if (network === "x") return `https://x.com/search?q=${q}&f=live`;
	if (network === "reddit") return `https://www.reddit.com/search/?q=${q}&sort=new`;
	if (network === "youtube") return `https://www.youtube.com/results?search_query=${q}`;
	if (network === "quora") return `https://www.quora.com/search?q=${q}`;
	if (network === "indeed") return `https://www.indeed.com/jobs?q=${q}`;
	if (network === "linkedin") return `https://www.linkedin.com/jobs/search/?keywords=${q}`;
	return `https://www.google.com/search?q=${q}&tbs=qdr:m`;
}
var DEFAULT_CHIPS = [
	"Prices",
	"Fire Stick setup",
	"Sports",
	"Request a login"
];
function welcomeMessage() {
	return {
		text: "Hi — I’m Ember’s shop bot. I answer Fire TV questions and take login requests from people who write in. I cannot search TikTok, Facebook, or Instagram, and I will not message anyone who did not start the chat.",
		chips: DEFAULT_CHIPS
	};
}
var seedLeads = [
	{
		id: "lead_demo_1",
		name: "Ayesha K.",
		contact: "@ayesha.watches",
		platform: "instagram",
		status: "interested",
		notes: "Asked about kids profile. Family plan.",
		planId: "family",
		createdAt: 17572652e5
	},
	{
		id: "lead_demo_2",
		name: "Hamza",
		contact: "+92 300 0000000",
		platform: "whatsapp",
		status: "contacted",
		notes: "Wants cricket this weekend.",
		planId: "sports",
		createdAt: 1757312e6
	},
	{
		id: "lead_demo_3",
		name: "Website inquiry",
		contact: "sara@email.com",
		platform: "website",
		status: "new",
		notes: "Starter, 1 stick already at home.",
		planId: "starter",
		createdAt: 17573276e5
	}
];
function priceFor(planId, months) {
	const plan = PLANS.find((p) => p.id === planId);
	return months === 12 ? {
		amountUsd: plan.usdYear,
		amountPkr: plan.pkrYear
	} : {
		amountUsd: plan.usdMonth,
		amountPkr: plan.pkrMonth
	};
}
function freshThread() {
	const now = Date.now();
	const welcome = welcomeMessage();
	return {
		id: uid("bot"),
		step: "chat",
		createdAt: now,
		updatedAt: now,
		messages: [{
			id: uid("msg"),
			role: "bot",
			text: welcome.text,
			chips: welcome.chips,
			createdAt: now
		}]
	};
}
var useEmber = create()(persist((set, get) => ({
	settings: {
		businessName: "Ember",
		whatsapp: "",
		currency: "PKR"
	},
	leads: seedLeads,
	orders: [{
		id: "ord_demo_1",
		customerName: "Bilal R.",
		contact: "+92 321 1111111",
		planId: "family",
		months: 12,
		amountUsd: 199,
		amountPkr: 54999,
		status: "active",
		createdAt: 17565524e5
	}],
	botThreads: [],
	currentBotId: null,
	seenHeadlines: [],
	setSettings: (patch) => set({ settings: {
		...get().settings,
		...patch
	} }),
	addLead: (lead) => {
		const next = {
			...lead,
			id: uid("lead"),
			status: lead.status ?? "new",
			createdAt: Date.now()
		};
		set({ leads: [next, ...get().leads] });
		return next;
	},
	updateLead: (id, patch) => set({ leads: get().leads.map((l) => l.id === id ? {
		...l,
		...patch
	} : l) }),
	removeLead: (id) => set({ leads: get().leads.filter((l) => l.id !== id) }),
	addOrder: (order) => {
		const priced = priceFor(order.planId, order.months);
		const next = {
			...order,
			...priced,
			id: uid("ord"),
			status: order.status ?? "pending",
			createdAt: Date.now()
		};
		set({ orders: [next, ...get().orders] });
		return next;
	},
	updateOrder: (id, patch) => set({ orders: get().orders.map((o) => o.id === id ? {
		...o,
		...patch
	} : o) }),
	ensureBotThread: () => {
		const { currentBotId, botThreads } = get();
		const existing = botThreads.find((t) => t.id === currentBotId);
		if (existing) return existing.id;
		const t = freshThread();
		set({
			botThreads: [t, ...botThreads],
			currentBotId: t.id
		});
		return t.id;
	},
	newBotThread: () => {
		const t = freshThread();
		set({
			botThreads: [t, ...get().botThreads],
			currentBotId: t.id
		});
		return t.id;
	},
	pushBotMessage: (threadId, msg) => {
		const now = Date.now();
		set({ botThreads: get().botThreads.map((t) => t.id === threadId ? {
			...t,
			updatedAt: now,
			messages: [...t.messages, {
				...msg,
				id: uid("msg"),
				createdAt: now
			}]
		} : t) });
	},
	patchBotThread: (id, patch) => set({ botThreads: get().botThreads.map((t) => t.id === id ? {
		...t,
		...patch,
		updatedAt: Date.now()
	} : t) }),
	markHeadlines: (ids) => {
		const have = new Set(get().seenHeadlines);
		for (const id of ids) have.add(id);
		set({ seenHeadlines: [...have].slice(-200) });
	}
}), {
	name: "ember-store",
	skipHydration: true,
	merge: (persisted, current) => {
		const p = persisted ?? {};
		return {
			...current,
			...p,
			botThreads: p.botThreads ?? [],
			currentBotId: p.currentBotId ?? null,
			seenHeadlines: p.seenHeadlines ?? []
		};
	}
}));
function EmberHydrate() {
	(0, import_react.useEffect)(() => {
		useEmber.persist.rehydrate();
	}, []);
	return null;
}
var LINKS = [{
	to: "/",
	label: "Hunt"
}, {
	to: "/leads",
	label: "Leads"
}];
function EmberMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/",
		className: cn("flex items-center gap-2 text-fg", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex size-8 items-center justify-center rounded-sm bg-primary",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 24 24",
				className: "size-4 text-primary-fg",
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: "M12 3c2.2 3.4-1 5.2.4 8.2C14.2 8.8 18 10.4 18 14.2 18 17.4 15.3 20 12 20s-6-2.6-6-5.8c0-3.2 3.1-5.6 4.4-8.4C11 4.2 11.4 3.4 12 3Z",
					fill: "currentColor"
				})
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-lg tracking-tight",
			children: "Ember"
		})]
	});
}
function HuntShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur-md",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmberMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					className: "flex min-w-0 items-center gap-0.5 sm:gap-1",
					children: [LINKS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: l.to,
						className: "flex h-11 items-center rounded-md px-2 text-sm text-muted hover:text-fg sm:px-3",
						activeProps: { className: "text-fg" },
						children: l.label
					}, l.label)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/#check",
						className: "ml-1 flex h-11 items-center rounded-md bg-primary px-2.5 text-sm text-primary-fg sm:px-3",
						children: "Check"
					})]
				})]
			})
		}), children]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-XQJ8Xa6I.js
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-BjWMvKjF.css";
var APP_NAME = "Ember";
var Route$35 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Find people interested in Fire Stick live TV. Score public posts. Save leads."
			},
			{
				name: "theme-color",
				content: "#0d0b09"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Outfit:wght@400;500;600&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthProvider, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmberHydrate, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
					theme: "dark",
					position: "top-center",
					richColors: false
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var loadRadar = createServerFn({ method: "GET" }).handler(createSsrRpc("480c7d4d0691d89a7eaf1b5a1b7fc69e53d1584273c1ba367ca73994cbbd58a3"));
var $$splitComponentImporter$33 = () => import("./routes-BnOVpJyr.mjs");
var Route$34 = createFileRoute("/")({
	staleTime: 12e4,
	loader: () => loadRadar(),
	pendingMs: 400,
	pendingComponent: HuntPending,
	component: lazyRouteComponent($$splitComponentImporter$33, "component")
});
function HuntPending() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HuntShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto max-w-6xl px-4 py-20 sm:px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "Looking for people talking about Fire Stick…"
		})
	}) });
}
var $$splitComponentImporter$32 = () => import("./account-i94-dLo6.mjs");
var Route$33 = createFileRoute("/account")({ component: lazyRouteComponent($$splitComponentImporter$32, "component") });
var $$splitComponentImporter$31 = () => import("./route-D6mx31aP.mjs");
var Route$32 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$31, "component") });
var $$splitComponentImporter$30 = () => import("./apply-64dBe71u.mjs");
var Route$31 = createFileRoute("/apply")({ component: lazyRouteComponent($$splitComponentImporter$30, "component") });
var $$splitComponentImporter$29 = () => import("./forgot-password-DM0dhh10.mjs");
var Route$30 = createFileRoute("/forgot-password")({ component: lazyRouteComponent($$splitComponentImporter$29, "component") });
var $$splitComponentImporter$28 = () => import("./leads-PgqQHQCt.mjs");
var Route$29 = createFileRoute("/leads")({ component: lazyRouteComponent($$splitComponentImporter$28, "component") });
var $$splitComponentImporter$27 = () => import("./login-Cn2c8cdI.mjs");
var Route$28 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$27, "component") });
var $$splitComponentImporter$26 = () => import("./me-BRQaDJMR.mjs");
var Route$27 = createFileRoute("/me")({ component: lazyRouteComponent($$splitComponentImporter$26, "component") });
var $$splitComponentImporter$25 = () => import("./reset-password-DtRuh_D2.mjs");
var Route$26 = createFileRoute("/reset-password")({ component: lazyRouteComponent($$splitComponentImporter$25, "component") });
var $$splitComponentImporter$24 = () => import("./signup-CANpYnfE.mjs");
var Route$25 = createFileRoute("/signup")({ component: lazyRouteComponent($$splitComponentImporter$24, "component") });
var $$splitComponentImporter$23 = () => import("./studio-7hUl29CP.mjs");
var Route$24 = createFileRoute("/studio")({ component: lazyRouteComponent($$splitComponentImporter$23, "component") });
var $$splitComponentImporter$22 = () => import("./terms-TKHetuOO.mjs");
var Route$23 = createFileRoute("/terms")({ component: lazyRouteComponent($$splitComponentImporter$22, "component") });
var $$splitComponentImporter$21 = () => import("./admin-CSs27UZ-.mjs");
var Route$22 = createFileRoute("/admin/")({ component: lazyRouteComponent($$splitComponentImporter$21, "component") });
var $$splitComponentImporter$20 = () => import("./advisors-5nVknm3o.mjs");
var Route$21 = createFileRoute("/admin/advisors")({ component: lazyRouteComponent($$splitComponentImporter$20, "component") });
var $$splitComponentImporter$19 = () => import("./audit-Dy58ggtk.mjs");
var Route$20 = createFileRoute("/admin/audit")({ component: lazyRouteComponent($$splitComponentImporter$19, "component") });
var $$splitComponentImporter$18 = () => import("./categories-ot8uFoxT.mjs");
var Route$19 = createFileRoute("/admin/categories")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
var $$splitComponentImporter$17 = () => import("./customers-Cc5LbtLE.mjs");
var Route$18 = createFileRoute("/admin/customers")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
var $$splitComponentImporter$16 = () => import("./finance-D71bunln.mjs");
var Route$17 = createFileRoute("/admin/finance")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
var $$splitComponentImporter$15 = () => import("./login-DfXL_Ov1.mjs");
var Route$16 = createFileRoute("/admin/login")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
var $$splitComponentImporter$14 = () => import("./payouts-oxwotkzx.mjs");
var Route$15 = createFileRoute("/admin/payouts")({ component: lazyRouteComponent($$splitComponentImporter$14, "component") });
var $$splitComponentImporter$13 = () => import("./promos-DQsm6JgB.mjs");
var Route$14 = createFileRoute("/admin/promos")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./reports-D-VttNB7.mjs");
var Route$13 = createFileRoute("/admin/reports")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./reviews-BcRY3p1M.mjs");
var Route$12 = createFileRoute("/admin/reviews")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./sessions-CWINyinz.mjs");
var Route$11 = createFileRoute("/admin/sessions")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./settings-Dh_BsASt.mjs");
var Route$10 = createFileRoute("/admin/settings")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./advisor-DWSBxsUg.mjs");
var Route$9 = createFileRoute("/advisor/")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./earnings-BpcqUNfg.mjs");
var Route$8 = createFileRoute("/advisor/earnings")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./login-DYh85Rqs.mjs");
var Route$7 = createFileRoute("/advisor/login")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./profile-fmxkWYef.mjs");
var Route$6 = createFileRoute("/advisor/profile")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./signup-t2wylwAm.mjs");
var Route$5 = createFileRoute("/advisor/signup")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("../_id-C44fGAsX.mjs");
var Route$4 = createFileRoute("/advisors/$id")({
	staleTime: 3e4,
	loader: async ({ params }) => getAdvisor({ data: { id: params.id } }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("../_id-CcZ9UgNg.mjs");
var Route$3 = createFileRoute("/reading/$id")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("../_id-pTYdpT8F.mjs");
var Route$2 = createFileRoute("/wait/$id")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("../_id-D86dG8rw.mjs");
var Route$1 = createFileRoute("/advisor/session/$id")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var Route = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var IndexRoute = Route$34.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$35
});
var AccountRoute = Route$33.update({
	id: "/account",
	path: "/account",
	getParentRoute: () => Route$35
});
var AdminRouteRoute = Route$32.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$35
});
var ApplyRoute = Route$31.update({
	id: "/apply",
	path: "/apply",
	getParentRoute: () => Route$35
});
var ForgotPasswordRoute = Route$30.update({
	id: "/forgot-password",
	path: "/forgot-password",
	getParentRoute: () => Route$35
});
var LeadsRoute = Route$29.update({
	id: "/leads",
	path: "/leads",
	getParentRoute: () => Route$35
});
var LoginRoute = Route$28.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$35
});
var MeRoute = Route$27.update({
	id: "/me",
	path: "/me",
	getParentRoute: () => Route$35
});
var ResetPasswordRoute = Route$26.update({
	id: "/reset-password",
	path: "/reset-password",
	getParentRoute: () => Route$35
});
var SignupRoute = Route$25.update({
	id: "/signup",
	path: "/signup",
	getParentRoute: () => Route$35
});
var StudioRoute = Route$24.update({
	id: "/studio",
	path: "/studio",
	getParentRoute: () => Route$35
});
var TermsRoute = Route$23.update({
	id: "/terms",
	path: "/terms",
	getParentRoute: () => Route$35
});
var AdminIndexRoute = Route$22.update({
	id: "/",
	path: "/",
	getParentRoute: () => AdminRouteRoute
});
var AdminAdvisorsRoute = Route$21.update({
	id: "/advisors",
	path: "/advisors",
	getParentRoute: () => AdminRouteRoute
});
var AdminAuditRoute = Route$20.update({
	id: "/audit",
	path: "/audit",
	getParentRoute: () => AdminRouteRoute
});
var AdminCategoriesRoute = Route$19.update({
	id: "/categories",
	path: "/categories",
	getParentRoute: () => AdminRouteRoute
});
var AdminCustomersRoute = Route$18.update({
	id: "/customers",
	path: "/customers",
	getParentRoute: () => AdminRouteRoute
});
var AdminFinanceRoute = Route$17.update({
	id: "/finance",
	path: "/finance",
	getParentRoute: () => AdminRouteRoute
});
var AdminLoginRoute = Route$16.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => AdminRouteRoute
});
var AdminPayoutsRoute = Route$15.update({
	id: "/payouts",
	path: "/payouts",
	getParentRoute: () => AdminRouteRoute
});
var AdminPromosRoute = Route$14.update({
	id: "/promos",
	path: "/promos",
	getParentRoute: () => AdminRouteRoute
});
var AdminReportsRoute = Route$13.update({
	id: "/reports",
	path: "/reports",
	getParentRoute: () => AdminRouteRoute
});
var AdminReviewsRoute = Route$12.update({
	id: "/reviews",
	path: "/reviews",
	getParentRoute: () => AdminRouteRoute
});
var AdminSessionsRoute = Route$11.update({
	id: "/sessions",
	path: "/sessions",
	getParentRoute: () => AdminRouteRoute
});
var AdminSettingsRoute = Route$10.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AdminRouteRoute
});
var AdvisorIndexRoute = Route$9.update({
	id: "/advisor/",
	path: "/advisor/",
	getParentRoute: () => Route$35
});
var AdvisorEarningsRoute = Route$8.update({
	id: "/advisor/earnings",
	path: "/advisor/earnings",
	getParentRoute: () => Route$35
});
var AdvisorLoginRoute = Route$7.update({
	id: "/advisor/login",
	path: "/advisor/login",
	getParentRoute: () => Route$35
});
var AdvisorProfileRoute = Route$6.update({
	id: "/advisor/profile",
	path: "/advisor/profile",
	getParentRoute: () => Route$35
});
var AdvisorSignupRoute = Route$5.update({
	id: "/advisor/signup",
	path: "/advisor/signup",
	getParentRoute: () => Route$35
});
var AdvisorsIdRoute = Route$4.update({
	id: "/advisors/$id",
	path: "/advisors/$id",
	getParentRoute: () => Route$35
});
var ReadingIdRoute = Route$3.update({
	id: "/reading/$id",
	path: "/reading/$id",
	getParentRoute: () => Route$35
});
var WaitIdRoute = Route$2.update({
	id: "/wait/$id",
	path: "/wait/$id",
	getParentRoute: () => Route$35
});
var AdvisorSessionIdRoute = Route$1.update({
	id: "/advisor/session/$id",
	path: "/advisor/session/$id",
	getParentRoute: () => Route$35
});
var ApiAuthSplatRoute = Route.update({
	id: "/api/auth/$",
	path: "/api/auth/$",
	getParentRoute: () => Route$35
});
var AdminRouteRouteChildren = {
	AdminAdvisorsRoute,
	AdminAuditRoute,
	AdminCategoriesRoute,
	AdminCustomersRoute,
	AdminFinanceRoute,
	AdminLoginRoute,
	AdminPayoutsRoute,
	AdminPromosRoute,
	AdminReportsRoute,
	AdminReviewsRoute,
	AdminSessionsRoute,
	AdminSettingsRoute,
	AdminIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AdminRouteRoute: AdminRouteRoute._addFileChildren(AdminRouteRouteChildren),
	AccountRoute,
	ApplyRoute,
	ForgotPasswordRoute,
	LeadsRoute,
	LoginRoute,
	MeRoute,
	ResetPasswordRoute,
	SignupRoute,
	StudioRoute,
	TermsRoute,
	AdvisorEarningsRoute,
	AdvisorLoginRoute,
	AdvisorProfileRoute,
	AdvisorSignupRoute,
	AdvisorsIdRoute,
	ReadingIdRoute,
	WaitIdRoute,
	AdvisorIndexRoute,
	AdvisorSessionIdRoute,
	ApiAuthSplatRoute
};
var routeTree = Route$35._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent,
		defaultPreload: false,
		defaultPreloadStaleTime: 2e4,
		defaultPendingMs: 2e3,
		defaultGcTime: 6e4
	});
}
//#endregion
export { Route$4 as a, PLATFORMS as c, useEmber as d, Route$3 as i, STATUSES as l, Route$1 as n, Route$34 as o, Route$2 as r, HuntShell as s, router_exports as t, searchUrl as u };

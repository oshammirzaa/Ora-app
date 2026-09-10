import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { f as formatClock, m as formatWhen, p as formatMoney } from "./ora-qKRq3G77.mjs";
import { A as Banknote, a as UserRound, h as MessageSquare, m as Radio, n as Wallet, r as Users } from "../_libs/lucide-react.mjs";
import { p as adminOverview } from "./ora-admin-Uuns6yB9.mjs";
import { i as Stat, n as PageHeader, r as Panel } from "./admin-shell-DiyvPvi5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-CSs27UZ-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function coinsToMoney(coins, currency) {
	return formatMoney(Math.max(0, coins) * 10, currency);
}
function OverviewPage() {
	const [data, setData] = (0, import_react.useState)(null);
	const [err, setErr] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		adminOverview({ data: { t: Date.now() } }).then(setData).catch((e) => setErr(e instanceof Error ? e.message : "No access"));
	}, []);
	if (err) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-danger",
		children: err
	});
	if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-elevated" });
	const s = data.stats;
	const currency = data.settings.currency;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			kicker: `${data.settings.name} · owner`,
			title: "Overview",
			description: "Live floor, sales, and house take. Figures are from the database — tap a card to open that section."
		}),
		s.pendingApps > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/admin/advisors",
			className: "mb-5 flex h-11 items-center justify-between rounded-xl bg-elevated px-4 text-sm text-primary shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
				s.pendingApps,
				" advisor ",
				s.pendingApps === 1 ? "application" : "applications",
				" waiting"
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Review" })]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 gap-3 sm:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Total Customers",
					value: String(s.customers),
					icon: UserRound,
					to: "/admin/customers"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Total Advisors",
					value: String(s.advisors),
					icon: Users,
					to: "/admin/advisors"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Advisors Online Now",
					value: String(s.online),
					icon: Radio,
					to: "/admin/advisors",
					pulse: s.online > 0
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Active Live Chats",
					value: String(s.liveChats),
					icon: MessageSquare,
					to: "/admin/sessions",
					pulse: s.liveChats > 0
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Today's Sales",
					value: coinsToMoney(s.todaySales, currency),
					hint: `${s.todaySales}c billed today`,
					icon: Wallet,
					to: "/admin/finance"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Total House Revenue",
					value: coinsToMoney(s.revenue, currency),
					hint: `${s.revenue}c · ${data.settings.platformShare}% take`,
					icon: Banknote,
					to: "/admin/finance"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Pending Payouts",
					value: coinsToMoney(s.pendingPayouts, currency),
					hint: `${s.pendingPayouts}c waiting`,
					icon: Banknote,
					to: "/admin/payouts"
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
			title: "Live sessions",
			children: [!data.live.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "No chats on the clock."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: data.live.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex justify-between gap-3 px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						r.client,
						" · ",
						r.advisor,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs text-faint",
							children: formatWhen(r.startedAt)
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums text-primary",
						children: [
							formatClock(r.seconds),
							" · ",
							r.coinsSpent,
							"c"
						]
					})]
				}, r.id))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-4 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/admin/sessions",
						className: "text-primary",
						children: "All sessions"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/admin/advisors",
						className: "text-primary",
						children: "Applications"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/admin/payouts",
						className: "text-primary",
						children: "Payouts"
					})
				]
			})]
		})
	] });
}
//#endregion
export { OverviewPage as component };

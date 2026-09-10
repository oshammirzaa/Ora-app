import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { v as adminReports } from "./ora-admin-Uuns6yB9.mjs";
import { i as Stat, n as PageHeader } from "./admin-shell-DiyvPvi5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reports-D-VttNB7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ReportsPage() {
	const [days, setDays] = (0, import_react.useState)(14);
	const [data, setData] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		adminReports({ data: {
			days,
			t: Date.now()
		} }).then(setData).catch(() => setData(null));
	}, [days]);
	if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-elevated" });
	const tot = data.rows.reduce((a, r) => ({
		sessions: a.sessions + r.sessions,
		spent: a.spent + r.spent,
		earned: a.earned + r.earned,
		fee: a.fee + r.fee
	}), {
		sessions: 0,
		spent: 0,
		earned: 0,
		fee: 0
	});
	const max = Math.max(1, ...data.rows.map((r) => r.spent + r.fee));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Reports",
			description: "Revenue, sittings, advisor earnings, and customer spend by day."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 flex gap-2",
			children: [
				7,
				14,
				30
			].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: days === n ? "default" : "outline",
				onClick: () => setDays(n),
				children: [n, " days"]
			}, n))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Sessions",
					value: String(tot.sessions)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Customer spend",
					value: `${tot.spent}c`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Advisor earnings",
					value: `${tot.earned}c`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "House take",
					value: `${tot.fee}c`
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-8 space-y-2",
			children: !data.rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "text-sm text-muted",
				children: "No sittings in this window."
			}) : data.rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: r.day }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "tabular-nums text-muted",
					children: [
						r.sessions,
						" · ",
						r.spent,
						"c · house ",
						r.fee,
						"c"
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 h-2 overflow-hidden rounded-full bg-elevated",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full rounded-full bg-primary",
					style: { width: `${Math.round((r.spent + r.fee) / max * 100)}%` }
				})
			})] }, r.day))
		})
	] });
}
//#endregion
export { ReportsPage as component };

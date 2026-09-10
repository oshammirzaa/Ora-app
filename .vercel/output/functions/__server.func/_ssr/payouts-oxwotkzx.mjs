import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { m as formatWhen } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { m as adminPayouts, s as adminDecidePayout } from "./ora-admin-Uuns6yB9.mjs";
import { n as PageHeader } from "./admin-shell-DiyvPvi5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/payouts-oxwotkzx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PayoutsPage() {
	const [rows, setRows] = (0, import_react.useState)([]);
	async function load() {
		setRows(await adminPayouts({ data: { t: Date.now() } }));
	}
	(0, import_react.useEffect)(() => {
		load().catch(() => setRows([]));
	}, []);
	const pending = rows.filter((r) => r.status === "requested");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Payouts",
			description: "Approve or reject advisor withdrawals. Rejected coins return to the desk."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 font-display text-xl",
			children: "Requested"
		}),
		!pending.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted",
			children: "None waiting."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 space-y-2",
			children: pending.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-medium",
						children: [
							p.name,
							" · ",
							p.coins,
							"c · $",
							p.usd.toFixed(2)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-faint",
						children: formatWhen(p.createdAt)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => void adminDecidePayout({ data: {
								id: p.id,
								accept: true
							} }).then(() => {
								toast.success("Marked paid.");
								return load();
							}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not pay")),
							children: "Approve"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => void adminDecidePayout({ data: {
								id: p.id,
								accept: false,
								note: "Rejected"
							} }).then(() => {
								toast.success("Rejected. Coins returned.");
								return load();
							}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not reject")),
							children: "Reject"
						})]
					})
				]
			}, p.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 font-display text-xl",
			children: "History"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
			children: !rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-4 py-3 text-sm text-muted",
				children: "No withdrawal requests yet."
			}) : rows.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex justify-between px-4 py-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					p.name,
					" · ",
					p.coins,
					"c",
					p.note ? ` · ${p.note}` : "",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block text-xs text-faint",
						children: formatWhen(p.createdAt)
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted",
					children: p.status
				})]
			}, p.id))
		})
	] });
}
//#endregion
export { PayoutsPage as component };

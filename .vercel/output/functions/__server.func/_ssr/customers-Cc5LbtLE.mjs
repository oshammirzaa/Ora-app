import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { f as formatClock, m as formatWhen } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { T as adminSetCustomer, a as adminCustomerActivity, o as adminCustomers, t as adminAdjust } from "./ora-admin-Uuns6yB9.mjs";
import { n as PageHeader } from "./admin-shell-DiyvPvi5.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/customers-Cc5LbtLE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CustomersPage() {
	const [q, setQ] = (0, import_react.useState)("");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [open, setOpen] = (0, import_react.useState)("");
	const [ledger, setLedger] = (0, import_react.useState)([]);
	const [coins, setCoins] = (0, import_react.useState)("10");
	async function load(query = q) {
		setRows(await adminCustomers({ data: {
			q: query,
			t: Date.now()
		} }));
	}
	(0, import_react.useEffect)(() => {
		load("").catch(() => setRows([]));
	}, []);
	async function openUser(id) {
		setOpen(id);
		setLedger(await adminCustomerActivity({ data: {
			userId: id,
			t: Date.now()
		} }));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Customers",
			description: "Search, suspend, assign owner, and inspect wallet activity."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-4 flex gap-2",
			onSubmit: (e) => {
				e.preventDefault();
				load();
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Name or email"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				variant: "outline",
				children: "Search"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 space-y-2",
			children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: r.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: [
							r.email || "No email",
							" · ",
							r.role,
							" · ",
							r.status,
							" · ",
							r.coins,
							"c · promo ",
							formatClock(r.bonusSeconds),
							r.subscribed ? " · sub" : ""
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => void openUser(r.userId),
								children: "Wallet"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => void adminSetCustomer({ data: {
									userId: r.userId,
									status: r.status === "suspended" ? "active" : "suspended"
								} }).then(() => {
									toast.success(r.status === "suspended" ? "Reactivated." : "Suspended.");
									return load();
								}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update")),
								children: r.status === "suspended" ? "Reactivate" : "Suspend"
							}),
							r.role !== "admin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => void adminSetCustomer({ data: {
									userId: r.userId,
									role: "admin"
								} }).then(() => {
									toast.success("Assigned as owner.");
									return load();
								}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not assign")),
								children: "Make owner"
							}) : null
						]
					})]
				}), open === r.userId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 border-t border-border pt-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "flex flex-wrap gap-2",
						onSubmit: (e) => {
							e.preventDefault();
							adminAdjust({ data: {
								userId: r.userId,
								coins: Number(coins),
								kind: "adjustment",
								note: "Owner wallet adjustment"
							} }).then(() => {
								toast.success("Wallet updated.");
								return Promise.all([load(), openUser(r.userId)]);
							}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not adjust"));
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "w-24",
							type: "number",
							value: coins,
							onChange: (e) => setCoins(e.target.value)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							type: "submit",
							children: "Adjust coins"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 divide-y divide-border",
						children: !ledger.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "py-2 text-sm text-muted",
							children: "No wallet movement."
						}) : ledger.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex justify-between py-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [l.note, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-0.5 block text-xs text-faint",
								children: formatWhen(l.createdAt)
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular-nums text-primary",
								children: l.coins ? `${l.coins > 0 ? "+" : ""}${l.coins}c` : formatClock(l.seconds)
							})]
						}, l.id))
					})]
				}) : null]
			}, r.userId))
		})
	] });
}
//#endregion
export { CustomersPage as component };

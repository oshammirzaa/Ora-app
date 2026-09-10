import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { E as adminSettings, S as adminSaveSettings } from "./ora-admin-Uuns6yB9.mjs";
import { n as PageHeader, r as Panel } from "./admin-shell-DiyvPvi5.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-Dh_BsASt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsPage() {
	const [form, setForm] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		adminSettings({ data: { t: Date.now() } }).then(setForm).catch(() => setForm(null));
	}, []);
	if (!form) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-elevated" });
	function set(key, value) {
		setForm((f) => f ? {
			...f,
			[key]: value
		} : f);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Settings",
		description: "Marketplace identity, house commission, payout rules, and currency. Billing reads these on the server."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mt-6 space-y-8",
		onSubmit: (e) => {
			e.preventDefault();
			adminSaveSettings({ data: form }).then((next) => {
				setForm(next);
				toast.success("Settings saved.");
			}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Marketplace",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "mname",
								children: "Marketplace name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "mname",
								value: form.name,
								onChange: (e) => set("name", e.target.value),
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "logo",
								children: "Logo URL"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "logo",
								value: form.logoUrl,
								onChange: (e) => set("logoUrl", e.target.value),
								placeholder: "/favicon.svg"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "semail",
								children: "Support email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "semail",
								type: "email",
								value: form.supportEmail,
								onChange: (e) => set("supportEmail", e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "cur",
								children: "Currency"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "cur",
								value: form.currency,
								onChange: (e) => set("currency", e.target.value)
							})]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Commission",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "comm",
								children: "House commission %"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "comm",
								type: "number",
								min: 0,
								max: 50,
								value: form.platformShare,
								onChange: (e) => set("platformShare", Number(e.target.value))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-faint",
								children: [
									"Advisors keep ",
									100 - form.platformShare,
									"% of paid coins. Max 50%. Applied on the next sitting."
								]
							})
						]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Payout rules",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "minp",
							children: "Minimum payout (coins)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "minp",
							type: "number",
							min: 1,
							value: form.minPayoutCoins,
							onChange: (e) => set("minPayoutCoins", Number(e.target.value))
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "hold",
								children: "Earnings hold (hours)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "hold",
								type: "number",
								min: 0,
								max: 168,
								value: form.payoutHoldHours,
								onChange: (e) => set("payoutHoldHours", Number(e.target.value))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-faint",
								children: "0 releases advisor earnings immediately after a sitting."
							})
						]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				children: "Save settings"
			})
		]
	})] });
}
//#endregion
export { SettingsPage as component };

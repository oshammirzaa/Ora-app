import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as formatDate, t as cn } from "./utils-CT3EiHu6.mjs";
import { s as Trash2 } from "../_libs/lucide-react.mjs";
import { c as PLATFORMS, d as useEmber, l as STATUSES, s as HuntShell } from "./router-XQJ8Xa6I.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/leads-PgqQHQCt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LeadsPage() {
	const leads = useEmber((s) => s.leads);
	const updateLead = useEmber((s) => s.updateLead);
	const removeLead = useEmber((s) => s.removeLead);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const shown = filter === "all" ? leads : leads.filter((l) => l.status === filter);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HuntShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-3xl px-4 py-10 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl",
				children: "Leads"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted",
				children: [
					"People you saved from the hunt.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "text-primary",
						children: "Find more"
					}),
					"."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 flex gap-1 overflow-x-auto pb-1",
				children: [{
					id: "all",
					label: "All"
				}, ...STATUSES].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(s.id),
					className: cn("min-h-11 rounded-full px-3 text-sm whitespace-nowrap", filter === s.id ? "bg-fg text-bg" : "bg-elevated text-muted"),
					children: s.label
				}, s.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-5 space-y-3",
				children: shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "rounded-xl bg-surface p-8 text-center text-sm text-muted",
					children: "No leads in this column. Hunt and tap Save lead."
				}) : shown.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-medium",
									children: l.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "break-all text-sm text-muted",
									children: l.contact
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-faint",
									children: [
										PLATFORMS.find((p) => p.id === l.platform)?.label,
										" · ",
										formatDate(l.createdAt)
									]
								})
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "h-11 rounded-md bg-elevated px-3 text-sm",
								value: l.status,
								onChange: (e) => updateLead(l.id, { status: e.target.value }),
								children: STATUSES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: s.id,
									children: s.label
								}, s.id))
							})]
						}),
						l.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted",
							children: l.notes
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex gap-2",
							children: [l.contact.startsWith("http") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								size: "sm",
								variant: "outline",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: l.contact,
									target: "_blank",
									rel: "noreferrer",
									children: "Open"
								})
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: () => removeLead(l.id),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" }), "Remove"]
							})]
						})
					]
				}, l.id))
			})
		]
	}) });
}
//#endregion
export { LeadsPage as component };

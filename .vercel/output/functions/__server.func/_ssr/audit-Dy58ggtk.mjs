import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { m as formatWhen } from "./ora-qKRq3G77.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { i as adminAudit } from "./ora-admin-Uuns6yB9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-Dy58ggtk.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ACTION = {
	claim_owner: "Claimed owner",
	save_settings: "Saved settings",
	add_category: "Added category",
	edit_category: "Edited category",
	delete_category: "Removed category",
	reorder_category: "Reordered category",
	edit_advisor: "Edited advisor",
	approve_advisor: "Approved advisor",
	decline_advisor: "Declined advisor",
	set_advisor_status: "Set advisor status",
	suspend_user: "Suspended account",
	reactivate_user: "Reactivated account",
	set_role: "Changed role",
	end_session: "Forced session end",
	refund: "Refund",
	adjustment: "Wallet adjustment",
	gift: "Gifted coins",
	refund_payment: "Refunded payment",
	gift_coins: "Gifted coins",
	payout_paid: "Approved payout",
	payout_rejected: "Rejected payout",
	save_promo: "Saved offer",
	grant_promo: "Granted offer",
	hide_review: "Hid review",
	show_review: "Restored review"
};
function AuditPage() {
	const [data, setData] = (0, import_react.useState)(null);
	const [err, setErr] = (0, import_react.useState)("");
	const load = (0, import_react.useCallback)(() => {
		adminAudit({ data: { t: Date.now() } }).then((r) => {
			setData(r);
			setErr("");
		}).catch((e) => setErr(e instanceof Error ? e.message : "Could not load"));
	}, []);
	(0, import_react.useEffect)(() => {
		load();
	}, [load]);
	const rows = data?.rows ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl",
				children: "Audit log"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Owner actions: approvals, payouts, wallet edits, settings, reviews."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "outline",
				onClick: load,
				children: "Refresh"
			})]
		}),
		err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-danger",
			children: err
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-xs text-faint",
			children: data ? `${data.total} recorded` : "Loading…"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-6 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
			children: !rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-4 py-3 text-sm text-muted",
				children: "No owner actions recorded yet."
			}) : rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "px-4 py-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					r.actor,
					" · ",
					ACTION[r.action] || r.action.replace(/_/g, " "),
					r.detail ? ` · ${r.detail}` : ""
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-faint",
					children: [
						r.targetType,
						" ",
						r.targetId,
						" · ",
						formatWhen(r.createdAt)
					]
				})]
			}, r.id))
		})
	] });
}
//#endregion
export { AuditPage as component };

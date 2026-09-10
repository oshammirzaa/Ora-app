import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { f as formatClock, m as formatWhen } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { l as adminEndSession, w as adminSessions } from "./ora-admin-Uuns6yB9.mjs";
import { n as PageHeader } from "./admin-shell-DiyvPvi5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sessions-CWINyinz.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SessionsPage() {
	const [rows, setRows] = (0, import_react.useState)([]);
	async function load() {
		setRows(await adminSessions({ data: { t: Date.now() } }));
	}
	(0, import_react.useEffect)(() => {
		load().catch(() => setRows([]));
	}, []);
	const live = rows.filter((r) => r.status === "live");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Sessions",
			description: "Active chats and the full sitting record. Ending a live chat stops billing."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 font-display text-xl",
			children: "Active"
		}),
		!live.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted",
			children: "None live."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 space-y-2",
			children: live.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-sm",
					children: [
						r.client,
						" · ",
						r.advisor,
						" · ",
						formatClock(r.seconds),
						" · ",
						r.coinsSpent,
						"c"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => void adminEndSession({ data: { id: r.id } }).then(() => {
						toast.success("Session ended.");
						return load();
					}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not end")),
					children: "Force end"
				})]
			}, r.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 font-display text-xl",
			children: "Records"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
			children: !rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "px-4 py-3 text-sm text-muted",
				children: "None yet."
			}) : rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "px-4 py-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					r.status,
					" · ",
					r.client,
					" · ",
					r.advisor
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted",
					children: [
						formatWhen(r.startedAt),
						r.endedAt ? ` – ${formatWhen(r.endedAt)}` : "",
						" · ",
						formatClock(r.seconds),
						" · ",
						r.rateCoins,
						"c/min · charged ",
						r.coinsSpent,
						"c · advisor ",
						r.advisorEarned,
						"c · house ",
						r.platformFee,
						"c"
					]
				})]
			}, r.id))
		})
	] });
}
//#endregion
export { SessionsPage as component };

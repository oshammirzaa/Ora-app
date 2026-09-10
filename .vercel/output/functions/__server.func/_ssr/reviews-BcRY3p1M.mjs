import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { m as formatWhen } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { f as adminModerateReview, y as adminReviews } from "./ora-admin-Uuns6yB9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reviews-BcRY3p1M.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ReviewsPage() {
	const [rows, setRows] = (0, import_react.useState)([]);
	async function load() {
		setRows(await adminReviews({ data: { t: Date.now() } }));
	}
	(0, import_react.useEffect)(() => {
		load().catch(() => setRows([]));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl",
			children: "Reviews"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "Hide a rating from the advisor profile. Hidden reviews drop out of the average."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-6 space-y-2",
			children: !rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "text-sm text-muted",
				children: "No ratings yet."
			}) : rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							r.rating,
							"/5 · ",
							r.advisor,
							" · ",
							r.client,
							r.hidden ? " · hidden" : ""
						]
					}),
					r.body ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: r.body
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-faint",
						children: formatWhen(r.createdAt)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						className: "mt-3",
						onClick: () => void adminModerateReview({ data: {
							id: r.id,
							hidden: !r.hidden
						} }).then(() => {
							toast.success(r.hidden ? "Restored." : "Hidden.");
							return load();
						}).catch((e) => toast.error(e instanceof Error ? e.message : "Could not moderate")),
						children: r.hidden ? "Restore" : "Hide"
					})
				]
			}, r.id))
		})
	] });
}
//#endregion
export { ReviewsPage as component };

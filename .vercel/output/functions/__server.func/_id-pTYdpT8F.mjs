import { o as __toESM } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate, v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
import { S as getRequest, s as cancelRequest } from "./_ssr/ora-qKRq3G77.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { r as Route$2 } from "./_ssr/router-XQJ8Xa6I.mjs";
import { o as useCurrentUserState, r as RedirectToSignIn, s as useVisibleInterval, t as AppShell } from "./_ssr/app-shell-14PMlmJH.mjs";
import { t as Button } from "./_ssr/button-ChqN0Nnn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-pTYdpT8F.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function WaitPage() {
	const { id } = Route$2.useParams();
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const [status, setStatus] = (0, import_react.useState)("pending");
	useVisibleInterval(() => getRequest({ data: { id } }).then((r) => {
		setStatus(r.status);
		if (r.status === "accepted" && r.readingId) navigate({
			to: "/reading/$id",
			params: { id: r.readingId }
		});
	}), 2500, Boolean(user));
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "home",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	const waiting = status === "pending";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "home",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-16 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-faint uppercase",
					children: "Waiting"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-display text-3xl",
					children: status === "declined" || status === "expired" || status === "missing" ? "They could not take this one" : "Advisor is reviewing your request"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: waiting ? "Stay here. Billing starts only when they accept." : "Choose another advisor on the floor."
				}),
				waiting ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-8 text-sm text-faint",
					children: "Usually under a minute."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					className: "mt-6",
					onClick: () => {
						cancelRequest({ data: { id } }).then(() => navigate({ to: "/" })).catch((e) => toast.error(e instanceof Error ? e.message : "Could not cancel"));
					},
					children: "Cancel request"
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					className: "mt-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						preload: false,
						children: "Back to advisors"
					})
				})
			]
		})
	});
}
//#endregion
export { WaitPage as component };

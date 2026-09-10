import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { u as decideRequest, v as getInbox } from "./ora-qKRq3G77.mjs";
import { t as cn } from "./utils-CT3EiHu6.mjs";
import { A as Banknote, a as UserRound, v as LayoutDashboard } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as UserButton, n as OraMark, s as useVisibleInterval } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/advisor-shell-Cqh0aqf3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TABS = [
	{
		id: "desk",
		to: "/advisor",
		label: "Desk",
		icon: LayoutDashboard
	},
	{
		id: "earnings",
		to: "/advisor/earnings",
		label: "Earnings",
		icon: Banknote
	},
	{
		id: "profile",
		to: "/advisor/profile",
		label: "Profile",
		icon: UserRound
	}
];
function AdvisorShell({ children, tab, online, busy, canToggle, onToggle }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex min-h-dvh w-full max-w-[430px] flex-col md:shadow-[var(--shadow-border)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-bg/90 px-4 backdrop-blur-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OraMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [canToggle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								if (busy) return;
								onToggle?.(!online);
							},
							className: cn("inline-flex h-9 items-center rounded-full px-3 text-xs font-medium", busy ? "bg-warn/20 text-warn" : online ? "bg-ok/20 text-ok" : "bg-elevated text-muted"),
							children: busy ? "Busy" : online ? "Online" : "Offline"
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 pb-20",
					children: [canToggle && tab !== "desk" && !busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IncomingBanner, {}) : null, children]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "sticky bottom-0 z-40 grid h-16 grid-cols-3 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
					children: TABS.map((t) => {
						const Icon = t.icon;
						const on = tab === t.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: t.to,
							preload: false,
							className: cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]", on ? "text-primary" : "text-faint"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-5",
								strokeWidth: on ? 2.2 : 1.8
							}), t.label]
						}, t.id);
					})
				})
			]
		})
	});
}
function IncomingBanner() {
	const navigate = useNavigate();
	const [requests, setRequests] = (0, import_react.useState)([]);
	const [working, setWorking] = (0, import_react.useState)(false);
	useVisibleInterval(() => {
		getInbox().then((d) => setRequests(d.live ? [] : d.requests)).catch(() => setRequests([]));
	}, 3e3);
	const r = requests[0];
	if (!r) return null;
	async function decide(accept) {
		if (working) return;
		setWorking(true);
		try {
			const res = await decideRequest({ data: {
				id: r.id,
				accept
			} });
			if (accept && res.readingId) {
				await navigate({
					to: "/advisor/session/$id",
					params: { id: res.readingId }
				});
				return;
			}
			toast.success("Declined.");
			setRequests((cur) => cur.filter((x) => x.id !== r.id));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not decide");
		} finally {
			setWorking(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-b border-border bg-surface px-4 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-warn uppercase",
				children: "Incoming chat"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-lg",
				children: r.clientName
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-faint",
				children: "Billing starts when you accept."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "flex-1",
					disabled: working,
					onClick: () => void decide(true),
					children: "Accept"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					className: "flex-1",
					disabled: working,
					onClick: () => void decide(false),
					children: "Decline"
				})]
			})
		]
	});
}
//#endregion
export { AdvisorShell as t };

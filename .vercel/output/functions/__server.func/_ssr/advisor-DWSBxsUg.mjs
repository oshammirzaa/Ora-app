import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { G as setOnline, _ as getDesk, f as formatClock, u as decideRequest, v as getInbox } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { o as useCurrentUserState, r as RedirectToSignIn, s as useVisibleInterval } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as AdvisorShell } from "./advisor-shell-Cqh0aqf3.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/advisor-DWSBxsUg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function DeskPage() {
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const [desk, setDesk] = (0, import_react.useState)(null);
	const load = (0, import_react.useCallback)(() => {
		return getDesk().then(setDesk).catch(() => setDesk(null));
	}, []);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		load();
	}, [user, load]);
	useVisibleInterval(() => {
		getInbox().then((box) => {
			setDesk((d) => {
				if (!d) return d;
				const sameLive = d.live?.id === box.live?.id && d.live?.seconds === box.live?.seconds && d.live?.advisorEarned === box.live?.advisorEarned;
				const sameReq = d.requests.length === box.requests.length && d.requests[0]?.id === box.requests[0]?.id;
				if (d.advisor?.online === box.online && d.advisor?.busy === box.busy && sameLive && sameReq) return d;
				return {
					...d,
					advisor: d.advisor ? {
						...d.advisor,
						online: box.online,
						busy: box.busy
					} : d.advisor,
					live: box.live,
					requests: box.requests
				};
			});
		}).catch(() => {});
	}, 3e3, Boolean(user && desk?.advisor), false);
	useVisibleInterval(() => {
		setDesk((d) => {
			if (!d?.live) return d;
			return {
				...d,
				live: {
					...d.live,
					seconds: d.live.seconds + 1
				}
			};
		});
	}, 1e3, Boolean(desk?.live), false);
	async function toggle(online) {
		try {
			await setOnline({ data: { online } });
			await load();
			toast.success(online ? "You are live on the floor." : "You are offline.");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not update");
		}
	}
	async function decide(id, accept) {
		try {
			const res = await decideRequest({ data: {
				id,
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
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not decide");
		}
	}
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "desk",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, { to: "/advisor/login" });
	const adv = desk?.advisor;
	const pending = desk?.applicationStatus === "pending";
	const declined = desk?.applicationStatus === "declined";
	const approved = adv?.status === "live";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "desk",
		online: adv?.online,
		busy: adv?.busy,
		canToggle: approved,
		onToggle: (v) => void toggle(v),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-faint uppercase",
					children: "Advisor desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 font-display text-3xl",
					children: adv?.name || "Desk"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: approved ? adv?.online ? "You are Live on the customer floor." : "Go online to receive paid chats." : pending ? "Application in review. You cannot go online yet." : declined ? "Application declined. Update and apply again." : "Apply as an advisor to open a desk."
				}),
				!adv && !pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						className: "w-full",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/advisor/signup",
							preload: false,
							children: "Apply as advisor"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Already have a customer account?",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/apply",
								preload: false,
								className: "text-primary",
								children: "Apply with this login"
							})
						]
					})]
				}) : null,
				pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6 rounded-xl bg-surface p-5 text-sm text-muted shadow-[var(--shadow-border)]",
					children: "Status: pending verification. The owner panel approves you before Live."
				}) : null,
				approved && desk?.live ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-warn uppercase",
							children: "Current session"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-display text-xl",
							children: desk.live.clientName
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm tabular-nums text-primary",
							children: [
								formatClock(desk.live.seconds),
								" · you ",
								desk.live.advisorEarned,
								"c"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							className: "mt-3 w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/advisor/session/$id",
								params: { id: desk.live.id },
								preload: false,
								children: "Open chat"
							})
						})
					]
				}) : null,
				approved ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Incoming chats"
					}), !desk?.requests.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: adv?.online ? "Waiting for a client." : "Go online to receive requests."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2",
						children: desk.requests.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-lg",
									children: r.clientName
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-faint",
									children: "wants a reading"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										className: "flex-1",
										disabled: Boolean(desk.live),
										onClick: () => void decide(r.id, true),
										children: "Accept"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "outline",
										className: "flex-1",
										onClick: () => void decide(r.id, false),
										children: "Decline"
									})]
								})
							]
						}, r.id))
					})]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Today",
						value: `${desk?.earningsToday ?? 0}c`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Total",
						value: `${desk?.earningsTotal ?? 0}c`
					})]
				})
			]
		})
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs tracking-wide text-faint uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 font-display text-2xl tabular-nums",
			children: value
		})]
	});
}
//#endregion
export { DeskPage as component };

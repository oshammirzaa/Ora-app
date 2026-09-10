import { o as __toESM } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate, v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
import { F as requestChat, O as isFavorite, Y as toggleFavorite, h as getAdvisor, k as isHouseAdvisor } from "./_ssr/ora-qKRq3G77.mjs";
import { t as cn } from "./_ssr/utils-CT3EiHu6.mjs";
import { b as Heart, l as Star, u as ShieldCheck } from "./_libs/lucide-react.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { a as Route$4 } from "./_ssr/router-XQJ8Xa6I.mjs";
import { i as SignInGate, o as useCurrentUserState, s as useVisibleInterval, t as AppShell } from "./_ssr/app-shell-14PMlmJH.mjs";
import { t as Button } from "./_ssr/button-ChqN0Nnn.mjs";
import { n as AdvisorVideoEmbed, r as isDirectVideo, t as AdvisorMedia } from "./_ssr/advisor-media-DGA5XZzZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-C44fGAsX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PresenceBadge({ advisor, className }) {
	const live = advisor.online && !advisor.busy;
	const busy = advisor.online && advisor.busy;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-xs", live ? "text-ok" : busy ? "text-warn" : "text-faint", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", live ? "animate-pulse bg-ok" : busy ? "bg-warn" : "bg-faint") }), live ? "Live" : busy ? "Busy" : "Offline"]
	});
}
function ChatNow({ advisor, className }) {
	const { user } = useCurrentUserState();
	const navigate = useNavigate();
	const house = isHouseAdvisor(advisor.userId);
	const blocked = !advisor.online || advisor.busy && !house;
	async function go(e) {
		e.preventDefault();
		e.stopPropagation();
		if (!user) {
			await navigate({ to: "/login" });
			return;
		}
		if (blocked) {
			toast.error(advisor.online ? "Advisor is in a session." : "This advisor is offline.");
			return;
		}
		try {
			const res = await requestChat({ data: { advisorId: advisor.id } });
			if (res.mode === "live" && res.id) await navigate({
				to: "/reading/$id",
				params: { id: res.id }
			});
			else if (res.requestId) await navigate({
				to: "/wait/$id",
				params: { id: res.requestId }
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not start");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		type: "button",
		className,
		disabled: blocked,
		onClick: (e) => void go(e),
		children: !advisor.online ? "Offline" : advisor.busy && !house ? "Busy" : "Chat now"
	});
}
function AdvisorPage() {
	const loaded = Route$4.useLoaderData();
	const { user } = useCurrentUserState();
	const [advisor, setAdvisor] = (0, import_react.useState)(loaded);
	const [saved, setSaved] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setAdvisor(loaded);
	}, [loaded]);
	useVisibleInterval(() => {
		if (!advisor) return;
		getAdvisor({ data: { id: advisor.id } }).then((next) => {
			if (next) setAdvisor(next);
		});
	}, 2e4, Boolean(advisor), false);
	(0, import_react.useEffect)(() => {
		if (!user || !advisor) return;
		isFavorite({ data: { advisorId: advisor.id } }).then((r) => setSaved(r.saved)).catch(() => setSaved(false));
	}, [user, advisor]);
	if (!advisor) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "home",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-4 py-20 text-center text-muted",
			children: "That advisor is not on the floor."
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "home",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "pb-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative aspect-3/4 overflow-hidden bg-elevated",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorMedia, {
					photo: advisor.photoUrl,
					video: advisor.videoUrl,
					alt: "",
					eager: true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PresenceBadge, {
					advisor,
					className: "absolute top-4 left-4"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-4 pt-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [advisor.trusted ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "size-3" }), "Top trusted"]
						}) : null, advisor.isNew ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-full bg-elevated px-2 py-1 text-xs text-muted",
							children: "New on the floor"
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs tracking-wide text-faint uppercase",
						children: advisor.specialties
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-1 font-display text-3xl",
						children: advisor.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 inline-flex items-center gap-1 text-sm text-primary",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "size-3.5 fill-primary text-primary" }),
							advisor.rating.toFixed(1),
							" · ",
							advisor.reviews,
							" readings"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-primary",
						children: [advisor.rateCoins, " coins / min after included time"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [advisor.years ? `${advisor.years} years · ` : "", advisor.languages || "English"]
					}),
					user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary",
						onClick: () => {
							toggleFavorite({ data: { advisorId: advisor.id } }).then((r) => {
								setSaved(r.saved);
								toast.success(r.saved ? "Saved to your account." : "Removed from saved.");
							}).catch((e) => toast.error(e instanceof Error ? e.message : "Sign in first."));
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: saved ? "size-4 fill-primary" : "size-4" }), saved ? "Saved" : "Save advisor"]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted",
						children: advisor.bio
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-6 font-display text-xl",
						children: "Experience"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: advisor.experience
					}),
					advisor.videoUrl && !isDirectVideo(advisor.videoUrl) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorVideoEmbed, { url: advisor.videoUrl })
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sticky bottom-20 mt-6 bg-bg/90 py-3 backdrop-blur-md",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignInGate, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								className: "w-full",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/login",
									children: "Sign in to chat"
								})
							}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatNow, {
								advisor,
								className: "w-full"
							})
						})
					})
				]
			})]
		})
	});
}
//#endregion
export { AdvisorPage as component };

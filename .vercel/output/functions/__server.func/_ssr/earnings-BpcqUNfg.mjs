import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { G as setOnline, I as requestPayout, _ as getDesk, b as getPublicSettings, f as formatClock, m as formatWhen } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { o as useCurrentUserState, r as RedirectToSignIn } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as AdvisorShell } from "./advisor-shell-Cqh0aqf3.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/earnings-BpcqUNfg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function EarningsPage() {
	const { user, isPending } = useCurrentUserState();
	const [desk, setDesk] = (0, import_react.useState)(null);
	const [coins, setCoins] = (0, import_react.useState)(50);
	const [share, setShare] = (0, import_react.useState)(30);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		getDesk().then(setDesk);
		getPublicSettings().then((s) => setShare(s.platformShare)).catch(() => {});
	}, [user]);
	async function pay(e) {
		e.preventDefault();
		try {
			await requestPayout({ data: { coins } });
			toast.success("Payout requested.");
			setDesk(await getDesk());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not request");
		}
	}
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "earnings",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, { to: "/advisor/login" });
	const adv = desk?.advisor;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "earnings",
		online: adv?.online,
		busy: adv?.busy,
		canToggle: adv?.status === "live",
		onToggle: (v) => void setOnline({ data: { online: v } }).then(() => getDesk().then(setDesk)),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl",
					children: "Earnings"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Today",
						value: `${desk?.earningsToday ?? 0}c`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "All time",
						value: `${desk?.earningsTotal ?? 0}c`
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-sm text-muted",
					children: [
						"Available to withdraw: ",
						adv?.payoutCoins ?? 0,
						" coins ($",
						((adv?.payoutCoins ?? 0) / 10).toFixed(2),
						"). You keep ",
						100 - share,
						"% of paid minutes. The house keeps ",
						share,
						"%."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: (e) => void pay(e),
					className: "mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Withdrawal"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: "Minimum 50 coins. 10 coins = $1. Paid after the house reviews the request."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "c",
								children: "Coins"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "c",
								type: "number",
								min: 50,
								value: coins,
								onChange: (e) => setCoins(Number(e.target.value))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							className: "mt-4 w-full",
							children: "Request payout"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Session history"
					}), !desk?.sessions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "No paid chats yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
						children: desk.sessions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "px-4 py-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									s.advisorName,
									" · ",
									formatClock(s.seconds),
									" · ",
									s.rateCoins,
									"c/min"
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "tabular-nums text-primary",
									children: [
										s.advisorEarned,
										"c",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "ml-2 text-faint",
											children: [
												"house ",
												s.platformFee,
												"c"
											]
										})
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-0.5 text-xs text-faint",
								children: [
									formatWhen(s.startedAt),
									s.endedAt ? ` – ${formatWhen(s.endedAt)}` : " · live",
									" · client ",
									s.coinsSpent,
									"c"
								]
							})]
						}, s.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Payouts"
					}), !desk?.payouts.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "None requested."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
						children: desk.payouts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex justify-between px-4 py-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								p.coins,
								"c · $",
								p.usd.toFixed(2)
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: p.status
							})]
						}, p.id))
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
export { EarningsPage as component };

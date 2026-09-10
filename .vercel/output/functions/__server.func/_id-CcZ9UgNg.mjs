import { o as __toESM } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
import { A as leaveReview, B as sameMessages, J as tickReading, P as mergeMessages, T as includedSeconds, W as sendMessage, d as endReading, f as formatClock, o as buyCoins, q as syncReading, t as COIN_PACKS, x as getReading } from "./_ssr/ora-qKRq3G77.mjs";
import { t as cn } from "./_ssr/utils-CT3EiHu6.mjs";
import { f as Send, l as Star } from "./_libs/lucide-react.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { i as Route$3 } from "./_ssr/router-XQJ8Xa6I.mjs";
import { i as rememberMe } from "./_ssr/client-cache-eGj0Q9iR.mjs";
import { o as useCurrentUserState, r as RedirectToSignIn, s as useVisibleInterval, t as AppShell } from "./_ssr/app-shell-14PMlmJH.mjs";
import { t as Button } from "./_ssr/button-ChqN0Nnn.mjs";
import { t as AdvisorMedia } from "./_ssr/advisor-media-DGA5XZzZ.mjs";
import { t as Textarea } from "./_ssr/textarea-D0gZAkVV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-CcZ9UgNg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CHIPS = [
	"A relationship I can't read.",
	"Work is stuck. What am I missing?",
	"A yes or no I've been avoiding.",
	"Someone I keep thinking about."
];
function ReadingRoom({ readingId, advisor, initialSeconds, initialStatus, initialReviewed, onEnd }) {
	const [seconds, setSeconds] = (0, import_react.useState)(initialSeconds);
	const [status, setStatus] = (0, import_react.useState)(initialStatus);
	const [wallet, setWallet] = (0, import_react.useState)(null);
	const [coinsSpent, setCoinsSpent] = (0, import_react.useState)(0);
	const [rate, setRate] = (0, import_react.useState)(advisor.rateCoins);
	const [remaining, setRemaining] = (0, import_react.useState)(0);
	const [lowBalance, setLowBalance] = (0, import_react.useState)(false);
	const [msgs, setMsgs] = (0, import_react.useState)([]);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [buying, setBuying] = (0, import_react.useState)("");
	const [ending, setEnding] = (0, import_react.useState)(false);
	const [rating, setRating] = (0, import_react.useState)(5);
	const [reviewBody, setReviewBody] = (0, import_react.useState)("");
	const [reviewed, setReviewed] = (0, import_react.useState)(Boolean(initialReviewed));
	const endRef = (0, import_react.useRef)(null);
	const warned = (0, import_react.useRef)(false);
	useVisibleInterval(() => {
		syncReading({ data: { id: readingId } }).then((res) => {
			if (!res) return;
			const nextSeconds = Number(res.seconds);
			if (Number.isFinite(nextSeconds)) setSeconds((s) => Math.max(s, nextSeconds));
			if (res.status === "ended" || res.status === "live") setStatus(res.status);
			if (Number.isFinite(Number(res.coinsSpent))) setCoinsSpent(Number(res.coinsSpent));
			if (Number.isFinite(Number(res.rateCoins)) && Number(res.rateCoins) > 0) setRate(Number(res.rateCoins));
			if (Number.isFinite(Number(res.remainingSeconds))) setRemaining(Number(res.remainingSeconds));
			setLowBalance(Boolean(res.lowBalance));
			if (res.wallet) setWallet(res.wallet);
			const incoming = Array.isArray(res.messages) ? res.messages : null;
			if (incoming) setMsgs((cur) => sameMessages(cur, incoming) ? cur : mergeMessages([], incoming));
			if (res.lowBalance && !warned.current) {
				warned.current = true;
				toast.message("Balance is running out. Add coins to stay in the reading.");
			}
			if (!res.lowBalance) warned.current = false;
		}).catch(() => {});
	}, 3500, status === "live");
	useVisibleInterval(() => {
		setSeconds((s) => s + 1);
		setRemaining((r) => r > 0 ? r - 1 : 0);
	}, 1e3, status === "live", false);
	(0, import_react.useEffect)(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [msgs.length, busy]);
	async function send(text) {
		const body = text.trim();
		if (!body || busy || status !== "live") return;
		setBusy(true);
		setDraft("");
		try {
			const res = await sendMessage({ data: {
				id: readingId,
				body
			} });
			setMsgs((m) => mergeMessages(m, [res?.client, res?.advisor]));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not send");
			if (e instanceof Error && e.message.toLowerCase().includes("ended")) setStatus("ended");
		} finally {
			setBusy(false);
		}
	}
	async function addPack(id) {
		setBuying(id);
		try {
			const me = await buyCoins({ data: { packId: id } });
			rememberMe(me);
			setWallet(me.wallet);
			toast.success("Coins added. The reading stays open.");
			const res = await tickReading({ data: { id: readingId } });
			if (Number.isFinite(Number(res?.remainingSeconds))) setRemaining(Number(res.remainingSeconds));
			setLowBalance(Boolean(res?.lowBalance));
			if (res?.status === "ended" || res?.status === "live") setStatus(res.status);
			if (res?.wallet) setWallet(res.wallet);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not add coins");
		} finally {
			setBuying("");
		}
	}
	function onSubmit(e) {
		e.preventDefault();
		send(draft);
	}
	const included = wallet ? includedSeconds(wallet) : null;
	const asked = msgs.some((m) => m.role === "client");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-[calc(100dvh-3.5rem)] flex-col",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "relative min-h-48 shrink-0 overflow-hidden bg-elevated",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorMedia, {
					photo: advisor.photoUrl,
					video: advisor.videoUrl,
					alt: "",
					eager: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-linear-to-t from-bg via-bg/20 to-transparent lg:via-transparent" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-x-0 bottom-0 p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-faint uppercase",
							children: advisor.specialties || "Reading"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-3xl",
							children: advisor.name || "Advisor"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 font-display text-5xl tabular-nums",
							children: formatClock(seconds)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-primary",
							children: [
								coinsSpent,
								"c charged · ",
								rate,
								"c / min"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-sm text-muted",
							children: status === "ended" ? "Session closed." : included !== null && included > 0 ? `Included left ${formatClock(included)} · then ${rate}c / min` : remaining > 0 ? `${formatClock(remaining)} of paid time left` : "Included minutes first, then coins."
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "flex min-h-0 flex-1 flex-col bg-bg",
			children: [
				status === "live" && lowBalance ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b border-border px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-warn",
						children: "Balance is almost gone. Add coins or this sitting ends."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex gap-2 overflow-x-auto pb-1",
						children: COIN_PACKS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							disabled: Boolean(buying),
							onClick: () => void addPack(p.id),
							children: buying === p.id ? "Adding…" : `${p.coins}c · $${p.usd}`
						}, p.id))
					})]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6",
					children: [
						msgs.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("flex", m.role === "client" ? "justify-end" : "justify-start"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: cn("max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed", m.role === "client" ? "bg-primary text-primary-fg" : "bg-elevated text-fg"),
								children: m.body
							})
						}, m.id)),
						busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-faint",
							children: [(advisor.name || "Advisor").trim().split(/\s+/)[0] || "Advisor", " is reading…"]
						}) : null,
						!asked && status === "live" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2 pt-2",
							children: CHIPS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "rounded-full bg-elevated px-3 py-2 text-left text-sm text-muted hover:text-fg",
								onClick: () => void send(c),
								children: c
							}, c))
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: endRef })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-t border-border px-4 py-4 sm:px-6",
					children: [status === "ended" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm text-warn",
								children: [
									"This reading ended. ",
									formatClock(seconds),
									" · ",
									coinsSpent,
									"c charged at ",
									rate,
									"c / min."
								]
							}),
							reviewed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-ok",
								children: "Thank you. Your rating is on their profile."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								className: "space-y-2",
								onSubmit: (e) => {
									e.preventDefault();
									leaveReview({ data: {
										readingId,
										rating,
										body: reviewBody
									} }).then(() => {
										setReviewed(true);
										toast.success("Review saved.");
									}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not review"));
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: "Rate this reading"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex gap-1",
										children: [
											1,
											2,
											3,
											4,
											5
										].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "size-10 text-primary",
											onClick: () => setRating(n),
											"aria-label": `${n} stars`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: n <= rating ? "size-5 fill-primary" : "size-5" })
										}, n))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
										value: reviewBody,
										onChange: (e) => setReviewBody(e.target.value),
										placeholder: "Optional note",
										maxLength: 400
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "submit",
										variant: "outline",
										className: "w-full",
										children: "Leave review"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/account",
										preload: false,
										children: "Add coins"
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									asChild: true,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/",
										preload: false,
										children: "Advisors"
									})
								})]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit,
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: draft,
							onChange: (e) => setDraft(e.target.value),
							placeholder: "Ask what you need…",
							maxLength: 800,
							className: "h-11 min-w-0 flex-1 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "icon",
							disabled: busy || !draft.trim(),
							"aria-label": "Send",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, {})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex items-center justify-between gap-3",
						children: [status === "live" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "text-xs text-primary",
							onClick: () => void addPack("10"),
							children: "Add 10 coins"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-faint",
							children: "Entertainment only. Not medical, legal, or financial advice."
						}), status === "live" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "text-xs text-muted hover:text-fg",
							disabled: ending,
							onClick: () => {
								if (ending) return;
								setEnding(true);
								Promise.resolve(onEnd()).then(() => setStatus("ended")).catch((err) => toast.error(err instanceof Error ? err.message : "Could not end")).finally(() => setEnding(false));
							},
							children: ending ? "Ending…" : "End reading"
						}) : null]
					})]
				})
			]
		})]
	});
}
function ReadingPage() {
	const { id } = Route$3.useParams();
	const { user, isPending } = useCurrentUserState();
	const [advisor, setAdvisor] = (0, import_react.useState)(null);
	const [seconds, setSeconds] = (0, import_react.useState)(0);
	const [status, setStatus] = (0, import_react.useState)("live");
	const [reviewed, setReviewed] = (0, import_react.useState)(false);
	const [missing, setMissing] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		getReading({ data: { id } }).then((r) => {
			if (!r?.advisor) {
				setMissing(true);
				return;
			}
			setAdvisor(r.advisor);
			setSeconds(Number(r.seconds) || 0);
			setStatus(r.status === "ended" ? "ended" : "live");
			setReviewed(Boolean(r.reviewed));
		});
	}, [id, user]);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		hideTab: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	async function stop() {
		await endReading({ data: { id } });
		setStatus("ended");
	}
	if (missing) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		hideTab: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-4 py-20 text-center text-muted",
			children: "That reading is gone."
		})
	});
	if (!advisor) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		hideTab: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse bg-elevated" })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		hideTab: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadingRoom, {
			readingId: id,
			advisor,
			initialSeconds: seconds,
			initialStatus: status,
			initialReviewed: reviewed,
			onEnd: () => stop()
		})
	});
}
//#endregion
export { ReadingPage as component };

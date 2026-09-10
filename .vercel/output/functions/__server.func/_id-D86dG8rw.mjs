import { o as __toESM } from "./_runtime.mjs";
import { u as require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { b as useNavigate } from "./_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "./_libs/@radix-ui/react-collection+[...].mjs";
import { B as sameMessages, P as mergeMessages, U as sendAdvisorMessage, d as endReading, f as formatClock, q as syncReading, x as getReading } from "./_ssr/ora-qKRq3G77.mjs";
import { t as cn } from "./_ssr/utils-CT3EiHu6.mjs";
import { f as Send } from "./_libs/lucide-react.mjs";
import { n as toast } from "./_libs/sonner.mjs";
import { n as Route$1 } from "./_ssr/router-XQJ8Xa6I.mjs";
import { o as useCurrentUserState, r as RedirectToSignIn, s as useVisibleInterval } from "./_ssr/app-shell-14PMlmJH.mjs";
import { t as Button } from "./_ssr/button-ChqN0Nnn.mjs";
import { t as AdvisorShell } from "./_ssr/advisor-shell-Cqh0aqf3.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-D86dG8rw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SessionPage() {
	const { id } = Route$1.useParams();
	const { user, isPending } = useCurrentUserState();
	const navigate = useNavigate();
	const [clientName, setClientName] = (0, import_react.useState)("Client");
	const [seconds, setSeconds] = (0, import_react.useState)(0);
	const [status, setStatus] = (0, import_react.useState)("live");
	const [rate, setRate] = (0, import_react.useState)(20);
	const [earned, setEarned] = (0, import_react.useState)(0);
	const [fee, setFee] = (0, import_react.useState)(0);
	const [charged, setCharged] = (0, import_react.useState)(0);
	const [msgs, setMsgs] = (0, import_react.useState)([]);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const endRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		getReading({ data: { id } }).then((r) => {
			if (!r) return;
			setClientName(r.clientName || "Client");
			setSeconds(Number(r.seconds) || 0);
			setStatus(r.status === "ended" ? "ended" : "live");
			setRate(Number(r.rateCoins) || 20);
			setEarned(Number(r.advisorEarned) || 0);
			setFee(Number(r.platformFee) || 0);
			setCharged(Number(r.coinsSpent) || 0);
		});
	}, [id, user]);
	useVisibleInterval(() => {
		syncReading({ data: { id } }).then((res) => {
			if (!res) return;
			const nextSeconds = Number(res.seconds);
			if (Number.isFinite(nextSeconds)) setSeconds((s) => Math.max(s, nextSeconds));
			if (res.status === "ended" || res.status === "live") setStatus(res.status);
			if (Number.isFinite(Number(res.rateCoins)) && Number(res.rateCoins) > 0) setRate(Number(res.rateCoins));
			if (Number.isFinite(Number(res.advisorEarned))) setEarned(Number(res.advisorEarned));
			if (Number.isFinite(Number(res.platformFee))) setFee(Number(res.platformFee));
			if (Number.isFinite(Number(res.coinsSpent))) setCharged(Number(res.coinsSpent));
			const incoming = Array.isArray(res.messages) ? res.messages : null;
			if (incoming) setMsgs((cur) => sameMessages(cur, incoming) ? cur : mergeMessages([], incoming));
		}).catch(() => {});
	}, 3500, Boolean(user) && status === "live");
	useVisibleInterval(() => {
		setSeconds((s) => s + 1);
	}, 1e3, status === "live", false);
	(0, import_react.useEffect)(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [msgs.length]);
	async function send(e) {
		e.preventDefault();
		const body = draft.trim();
		if (!body || busy || status !== "live") return;
		setBusy(true);
		setDraft("");
		try {
			const msg = await sendAdvisorMessage({ data: {
				id,
				body
			} });
			setMsgs((m) => mergeMessages(m, [msg]));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not send");
			if (err instanceof Error && err.message.toLowerCase().includes("ended")) setStatus("ended");
		} finally {
			setBusy(false);
		}
	}
	async function stop() {
		await endReading({ data: { id } });
		await navigate({ to: "/advisor" });
	}
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "desk",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, { to: "/advisor/login" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "desk",
		busy: status === "live",
		online: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-[calc(100dvh-8rem)] flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "border-b border-border px-4 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-faint uppercase",
							children: "Live with"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-2xl",
							children: clientName
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-3xl tabular-nums text-primary",
							children: formatClock(seconds)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-muted",
							children: [
								rate,
								"c / min · client ",
								charged,
								"c · you ",
								earned,
								"c · house ",
								fee,
								"c"
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 space-y-3 overflow-y-auto px-4 py-4",
					children: [msgs.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("flex", m.role === "advisor" ? "justify-end" : "justify-start"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: cn("max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm", m.role === "advisor" ? "bg-primary text-primary-fg" : "bg-elevated text-fg"),
							children: m.body
						})
					}, m.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: endRef })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-t border-border px-4 py-4",
					children: [status === "ended" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Session ended. ",
							formatClock(seconds),
							" · you earned ",
							earned,
							"c."
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: (e) => void send(e),
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: draft,
							onChange: (e) => setDraft(e.target.value),
							placeholder: "Reply to the client…",
							className: "h-11 min-w-0 flex-1 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							size: "icon",
							disabled: busy || !draft.trim(),
							"aria-label": "Send",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, {})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-3 text-xs text-muted",
						onClick: () => void stop(),
						children: "End session"
					})]
				})
			]
		})
	});
}
//#endregion
export { SessionPage as component };

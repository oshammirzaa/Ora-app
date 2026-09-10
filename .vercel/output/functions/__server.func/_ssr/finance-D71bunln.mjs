import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { m as formatWhen, p as formatMoney } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { g as adminRefundPayment, o as adminCustomers, t as adminAdjust, u as adminFinance } from "./ora-admin-Uuns6yB9.mjs";
import { i as Stat, n as PageHeader, r as Panel } from "./admin-shell-DiyvPvi5.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/finance-D71bunln.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function FinancePage() {
	const [data, setData] = (0, import_react.useState)(null);
	const [userId, setUserId] = (0, import_react.useState)("");
	const [coins, setCoins] = (0, import_react.useState)("10");
	const [kind, setKind] = (0, import_react.useState)("refund");
	const [note, setNote] = (0, import_react.useState)("");
	const [readingId, setReadingId] = (0, import_react.useState)("");
	const [people, setPeople] = (0, import_react.useState)([]);
	async function load() {
		const [next, list] = await Promise.all([adminFinance({ data: { t: Date.now() } }), adminCustomers({ data: {
			q: "",
			t: Date.now()
		} })]);
		setData(next);
		setPeople(list);
	}
	(0, import_react.useEffect)(() => {
		load().catch(() => setData(null));
	}, []);
	if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-elevated" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Finance",
			description: "Customer payments, wallet movement, advisor earnings, house commission, refunds."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Coin purchases",
					value: formatMoney(data.stats.paymentCents, data.currency),
					hint: `${data.stats.payments}c credited`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Customer spend",
					value: `${data.stats.spent}c`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Advisor earnings",
					value: `${data.stats.earned}c`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "House commission",
					value: `${data.stats.commission}c`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Refunds issued",
					value: `${data.stats.refunds}c`
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "Customer payments",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: !data.payments.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-3 text-sm text-muted",
					children: "No checkouts yet."
				}) : data.payments.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						p.name || p.userId.slice(0, 10),
						" · ",
						p.coins,
						"c · ",
						formatMoney(p.amountCents, p.currency),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-0.5 block text-xs text-faint",
							children: [
								p.status,
								" · ",
								p.provider,
								" · ",
								formatWhen(p.paidAt || p.createdAt)
							]
						})
					] }), p.status === "succeeded" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => void adminRefundPayment({ data: { id: p.id } }).then((r) => {
							toast.success(r.already ? "Already refunded." : "Payment refunded.");
							return load();
						}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not refund")),
						children: "Refund"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted",
						children: p.status
					})]
				}, p.id))
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "Refund or adjustment",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				onSubmit: (e) => {
					e.preventDefault();
					adminAdjust({ data: {
						userId,
						coins: Number(coins),
						kind,
						note,
						readingId
					} }).then(() => {
						toast.success("Posted.");
						setNote("");
						return load();
					}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not post"));
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "uid",
									children: "Customer"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									id: "uid",
									className: "h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]",
									value: userId,
									onChange: (e) => setUserId(e.target.value),
									required: true,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "Choose"
									}), people.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: p.userId,
										children: [
											p.name,
											" ",
											p.email ? `· ${p.email}` : ""
										]
									}, p.userId))]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "c",
									children: "Coins (negative to debit)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "c",
									type: "number",
									value: coins,
									onChange: (e) => setCoins(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Kind" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									className: "h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]",
									value: kind,
									onChange: (e) => setKind(e.target.value),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "refund",
											children: "Refund"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "adjustment",
											children: "Adjustment"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "gift",
											children: "Gift"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "rid",
									children: "Reading id (optional)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "rid",
									value: readingId,
									onChange: (e) => setReadingId(e.target.value)
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "n",
							children: "Note"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "n",
							value: note,
							onChange: (e) => setNote(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						children: "Post"
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "Wallet transactions",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: data.ledger.length ? data.ledger.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex justify-between gap-3 px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						l.name || l.userId,
						" · ",
						l.note,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs text-faint",
							children: formatWhen(l.createdAt)
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums text-primary",
						children: [
							l.coins > 0 ? "+" : "",
							l.coins,
							"c"
						]
					})]
				}, l.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-3 text-sm text-muted",
					children: "No wallet movement yet."
				})
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "Refunds and adjustments",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
				children: !data.adjustments.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-3 text-sm text-muted",
					children: "None posted yet."
				}) : data.adjustments.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex justify-between gap-3 px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						a.kind,
						" · ",
						a.userId.slice(0, 10),
						a.note ? ` · ${a.note}` : "",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs text-faint",
							children: formatWhen(a.createdAt)
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums text-primary",
						children: [
							a.coins > 0 ? "+" : "",
							a.coins,
							"c"
						]
					})]
				}, a.id))
			})
		})
	] });
}
//#endregion
export { FinancePage as component };

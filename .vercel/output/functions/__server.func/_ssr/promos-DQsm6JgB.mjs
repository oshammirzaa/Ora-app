import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { S as adminSaveSettings, d as adminGrantPromo, h as adminPromos, o as adminCustomers, x as adminSavePromo } from "./ora-admin-Uuns6yB9.mjs";
import { r as Panel } from "./admin-shell-DiyvPvi5.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/promos-DQsm6JgB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PromosPage() {
	const [data, setData] = (0, import_react.useState)(null);
	const [welcomeMin, setWelcomeMin] = (0, import_react.useState)("3");
	const [welcomeCoins, setWelcomeCoins] = (0, import_react.useState)("0");
	const [weeklyMin, setWeeklyMin] = (0, import_react.useState)("3");
	const [name, setName] = (0, import_react.useState)("");
	const [kind, setKind] = (0, import_react.useState)("minutes");
	const [amount, setAmount] = (0, import_react.useState)("3");
	const [userId, setUserId] = (0, import_react.useState)("");
	const [promoId, setPromoId] = (0, import_react.useState)("");
	const [people, setPeople] = (0, import_react.useState)([]);
	async function load() {
		const next = await adminPromos({ data: { t: Date.now() } });
		setData(next);
		setWelcomeMin(String(Math.round(next.settings.welcomeSeconds / 60)));
		setWeeklyMin(String(Math.round(next.settings.weeklySeconds / 60)));
		setWelcomeCoins(String(next.settings.welcomeCoins));
		setPeople(await adminCustomers({ data: {
			q: "",
			t: Date.now()
		} }));
	}
	(0, import_react.useEffect)(() => {
		load().catch(() => setData(null));
	}, []);
	if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-elevated" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl",
			children: "Promotions"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "New-user minutes, weekly included time, and named offers you can grant."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "Default included time",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				onSubmit: (e) => {
					e.preventDefault();
					adminSaveSettings({ data: {
						...data.settings,
						welcomeSeconds: Number(welcomeMin) * 60,
						weeklySeconds: Number(weeklyMin) * 60,
						welcomeCoins: Number(welcomeCoins)
					} }).then(() => {
						toast.success("Welcome offer saved.");
						return load();
					}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "wmin",
								children: "First-login minutes"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "wmin",
								type: "number",
								min: 0,
								value: welcomeMin,
								onChange: (e) => setWelcomeMin(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "wcoins",
								children: "Welcome coins"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "wcoins",
								type: "number",
								min: 0,
								value: welcomeCoins,
								onChange: (e) => setWelcomeCoins(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "weekm",
								children: "Weekly minutes (subscribers)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "weekm",
								type: "number",
								min: 0,
								value: weeklyMin,
								onChange: (e) => setWeeklyMin(e.target.value)
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					children: "Save defaults"
				})]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
			title: "Named offers",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				onSubmit: (e) => {
					e.preventDefault();
					adminSavePromo({ data: {
						name,
						kind,
						amount: Number(amount),
						active: true
					} }).then(() => {
						toast.success("Offer saved.");
						setName("");
						return load();
					}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Name" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: name,
								onChange: (e) => setName(e.target.value),
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Kind" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]",
								value: kind,
								onChange: (e) => setKind(e.target.value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "minutes",
									children: "Minutes"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "coins",
									children: "Coins"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: kind === "coins" ? "Coins" : "Minutes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								min: 1,
								value: amount,
								onChange: (e) => setAmount(e.target.value)
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					children: "Add offer"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border rounded-xl bg-surface",
				children: !data.promos.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-4 py-3 text-sm text-muted",
					children: "No named offers yet."
				}) : data.promos.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						p.name,
						" · ",
						p.kind,
						" · ",
						p.amount,
						" · ",
						p.active ? "active" : "off"
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => void adminSavePromo({ data: {
							id: p.id,
							name: p.name,
							kind: p.kind,
							amount: p.amount,
							active: !p.active,
							note: p.note
						} }).then(() => load()).catch((err) => toast.error(err instanceof Error ? err.message : "Could not update")),
						children: p.active ? "Turn off" : "Turn on"
					})]
				}, p.id))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "Grant to a customer",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
				onSubmit: (e) => {
					e.preventDefault();
					adminGrantPromo({ data: {
						userId,
						promoId
					} }).then(() => toast.success("Granted.")).catch((err) => toast.error(err instanceof Error ? err.message : "Could not grant"));
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Customer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
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
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Offer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							className: "h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]",
							value: promoId,
							onChange: (e) => setPromoId(e.target.value),
							required: true,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "Choose"
							}), data.promos.filter((p) => p.active).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: p.id,
								children: p.name
							}, p.id))]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						children: "Grant"
					})
				]
			})
		})
	] });
}
//#endregion
export { PromosPage as component };

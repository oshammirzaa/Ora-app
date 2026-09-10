import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as adminDecide } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as Textarea } from "./textarea-D0gZAkVV.mjs";
import { D as adminUpdateAdvisor, n as adminAdvisors } from "./ora-admin-Uuns6yB9.mjs";
import { n as PageHeader, r as Panel } from "./admin-shell-DiyvPvi5.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/advisors-5nVknm3o.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdvisorsPage() {
	const [data, setData] = (0, import_react.useState)(null);
	const [edit, setEdit] = (0, import_react.useState)(null);
	async function load() {
		setData(await adminAdvisors({ data: { t: Date.now() } }));
	}
	(0, import_react.useEffect)(() => {
		load().catch(() => setData(null));
	}, []);
	async function decide(id, decision) {
		try {
			await adminDecide({ data: {
				id,
				decision
			} });
			toast.success(decision === "approved" ? "Advisor is live." : "Declined.");
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not update");
		}
	}
	if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-40 animate-pulse rounded-xl bg-elevated" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Advisors",
			description: "Applications, profiles, categories (specialties), and per-minute rates."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "Applications",
			children: !data.applications.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "None waiting."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-3",
				children: data.applications.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [a.photo_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: a.photo_url,
							alt: "",
							className: "size-16 rounded-md object-cover"
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-medium",
									children: [
										a.name,
										" · ",
										a.status,
										" · ",
										a.rate_coins,
										"c/min"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-faint",
									children: [
										a.legal_name,
										" · ",
										a.languages,
										" · ",
										a.years,
										" yrs · ",
										a.specialties
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: a.bio
								}),
								a.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										onClick: () => void decide(a.id, "approved"),
										children: "Approve"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "outline",
										onClick: () => void decide(a.id, "declined"),
										children: "Reject"
									})]
								}) : null
							]
						})]
					})
				}, a.id))
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
			title: "On the floor",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-2",
				children: data.advisors.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-3",
							children: [a.photoUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: a.photoUrl,
								alt: "",
								className: "size-10 rounded-md object-cover"
							}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium",
								children: a.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mt-0.5 block text-xs text-muted",
								children: [
									a.status,
									a.online ? " · Live" : "",
									a.busy ? " · Busy" : "",
									a.trusted ? " · Trusted" : "",
									" · ",
									a.rateCoins,
									"c/min · ",
									a.specialties
								]
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => setEdit(edit?.id === a.id ? null : a),
							children: edit?.id === a.id ? "Close" : "Edit"
						})]
					}), edit?.id === a.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditAdvisor, {
						advisor: a,
						onSaved: () => void load().then(() => setEdit(null))
					}) : null]
				}, a.id))
			})
		})
	] });
}
function EditAdvisor({ advisor, onSaved }) {
	const [name, setName] = (0, import_react.useState)(advisor.name);
	const [bio, setBio] = (0, import_react.useState)(advisor.bio);
	const [specialties, setSpecialties] = (0, import_react.useState)(advisor.specialties);
	const [rate, setRate] = (0, import_react.useState)(advisor.rateCoins);
	const [status, setStatus] = (0, import_react.useState)(advisor.status);
	const [trusted, setTrusted] = (0, import_react.useState)(advisor.trusted);
	const [years, setYears] = (0, import_react.useState)(advisor.years);
	const [languages, setLanguages] = (0, import_react.useState)(advisor.languages);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function save() {
		setBusy(true);
		try {
			await adminUpdateAdvisor({ data: {
				id: advisor.id,
				name,
				bio,
				specialties,
				rateCoins: rate,
				status,
				trusted,
				years,
				languages
			} });
			toast.success("Advisor saved.");
			onSaved();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mt-4 space-y-3 border-t border-border pt-4",
		onSubmit: (e) => {
			e.preventDefault();
			save();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Display name",
						value: name,
						onChange: setName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Specialties / categories",
						value: specialties,
						onChange: setSpecialties
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Coins / min" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							min: 8,
							max: 80,
							value: rate,
							onChange: (e) => setRate(Number(e.target.value))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Status" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							className: "h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]",
							value: status,
							onChange: (e) => setStatus(e.target.value),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "live",
									children: "Live"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "paused",
									children: "Paused"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "suspended",
									children: "Suspended"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Languages",
						value: languages,
						onChange: setLanguages
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Years" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "number",
							min: 0,
							max: 60,
							value: years,
							onChange: (e) => setYears(Number(e.target.value))
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Bio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					value: bio,
					onChange: (e) => setBio(e.target.value),
					maxLength: 1200
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: trusted,
					onChange: (e) => setTrusted(e.target.checked)
				}), "Top trusted"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				disabled: busy,
				children: busy ? "Saving…" : "Save advisor"
			})
		]
	});
}
function Field({ label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			value,
			onChange: (e) => onChange(e.target.value)
		})]
	});
}
//#endregion
export { AdvisorsPage as component };

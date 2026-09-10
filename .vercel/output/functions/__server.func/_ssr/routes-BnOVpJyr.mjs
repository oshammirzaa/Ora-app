import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as cn } from "./utils-CT3EiHu6.mjs";
import { D as Check, E as ChevronDown, w as ExternalLink } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { c as PLATFORMS, d as useEmber, o as Route$34, s as HuntShell, u as searchUrl } from "./router-XQJ8Xa6I.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as Textarea } from "./textarea-D0gZAkVV.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
import { n as scoreInterest, t as SAMPLES } from "./interest-BclT4m1-.mjs";
import { a as SelectItemIndicator, c as SelectTrigger$1, i as SelectItem$1, l as SelectValue$1, n as SelectContent$1, o as SelectItemText, r as SelectIcon, s as SelectPortal, t as Select$1, u as SelectViewport } from "../_libs/@radix-ui/react-select+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BnOVpJyr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Select = Select$1;
var SelectValue = SelectValue$1;
var SelectTrigger = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectTrigger$1, {
	ref,
	className: cn("flex h-11 w-full items-center justify-between gap-2 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50 [&>span]:line-clamp-1", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectIcon, {
		asChild: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" })
	})]
}));
SelectTrigger.displayName = SelectTrigger$1.displayName;
var SelectContent = import_react.forwardRef(({ className, children, position = "popper", ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectPortal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent$1, {
	ref,
	position,
	className: cn("z-50 overflow-hidden rounded-lg bg-elevated text-fg shadow-[var(--shadow-border)]", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectViewport, {
		className: "p-1",
		children
	})
}) }));
SelectContent.displayName = SelectContent$1.displayName;
var SelectItem = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem$1, {
	ref,
	className: cn("relative flex cursor-pointer items-center rounded-sm py-2 pr-8 pl-2 text-sm outline-none select-none data-[highlighted]:bg-surface data-[disabled]:opacity-40", className),
	...props,
	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemText, { children }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute right-2 flex size-4 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemIndicator, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }) })
	})]
}));
SelectItem.displayName = SelectItem$1.displayName;
function bandLabel$1(b) {
	if (b === "hot") return "Interested";
	if (b === "warm") return "Maybe";
	if (b === "skip") return "Skip";
	return "Not now";
}
function bandClass$1(b) {
	if (b === "hot") return "text-ok";
	if (b === "warm") return "text-warn";
	if (b === "skip") return "text-danger";
	return "text-muted";
}
function InterestScanner() {
	const addLead = useEmber((s) => s.addLead);
	const [text, setText] = (0, import_react.useState)("");
	const [result, setResult] = (0, import_react.useState)(null);
	const [name, setName] = (0, import_react.useState)("");
	const [contact, setContact] = (0, import_react.useState)("");
	const [platform, setPlatform] = (0, import_react.useState)("tiktok");
	function analyze(value = text) {
		const t = value.trim();
		if (t.length < 8) {
			toast.error("Paste a post, comment, or message first.");
			return;
		}
		setText(value);
		setResult(scoreInterest(t));
	}
	function save() {
		if (!result) return;
		if (!name.trim() || !contact.trim()) {
			toast.error("Add a name and a handle or number before saving.");
			return;
		}
		addLead({
			name: name.trim(),
			contact: contact.trim(),
			platform,
			planId: result.planId,
			status: result.band === "hot" ? "interested" : "new",
			notes: `${result.band.toUpperCase()} ${result.score}/100. ${result.summary} Post: “${text.trim().slice(0, 180)}”`
		});
		toast.success("Saved to Leads.");
		setName("");
		setContact("");
	}
	async function copyReply() {
		if (!result) return;
		await navigator.clipboard.writeText(result.reply);
		toast.success("Reply copied.");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: SAMPLES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => analyze(s.text),
					className: "min-h-11 rounded-full bg-elevated px-3 text-sm text-muted hover:text-fg",
					children: ["Try: ", s.label]
				}, s.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "post",
						children: "Paste a post, comment, or message"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "post",
						value: text,
						onChange: (e) => setText(e.target.value),
						className: "min-h-32",
						placeholder: "e.g. Anyone know a good firestick for live cricket…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: () => analyze(),
						children: "Check interest"
					})
				]
			}),
			result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-end justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-faint uppercase",
							children: "Interest"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: cn("font-display text-4xl", bandClass$1(result.band)),
							children: bandLabel$1(result.band)
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-3xl tabular-nums text-fg",
							children: result.score
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: result.summary
					}),
					result.hits.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-wrap gap-2",
						children: result.hits.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-full bg-elevated px-3 py-1 text-xs text-muted",
							children: h.label
						}, h.label))
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-faint uppercase",
							children: "Suggested reply"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-fg",
							children: result.reply
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							className: "mt-3",
							onClick: () => void copyReply(),
							children: "Copy reply"
						})
					] }),
					result.band !== "skip" && result.band !== "cold" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 border-t border-border pt-4 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "iname",
									children: "Name or @handle"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "iname",
									value: name,
									onChange: (e) => setName(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "icontact",
									children: "Number or profile link"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "icontact",
									value: contact,
									onChange: (e) => setContact(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Where you saw them" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
									value: platform,
									onValueChange: (v) => setPlatform(v),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: PLATFORMS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: p.id,
										children: p.label
									}, p.id)) })]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-end",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									className: "w-full",
									onClick: save,
									children: "Save as lead"
								})
							})
						]
					}) : null
				]
			}) : null
		]
	});
}
var HUNTS = [
	{
		id: "sports",
		label: "Sports on Fire Stick",
		query: "watch live cricket football on firestick",
		why: "Match-day buyers."
	},
	{
		id: "setup",
		label: "Need live TV setup",
		query: "how to watch live tv on fire tv stick",
		why: "They have the stick. They need a service."
	},
	{
		id: "idle",
		label: "Stick in a drawer",
		query: "fire tv stick not using it",
		why: "Hardware sitting unused."
	},
	{
		id: "cable",
		label: "Cutting cable",
		query: "switching from cable to firestick",
		why: "Shopping for a living-room app."
	},
	{
		id: "family",
		label: "Family TV",
		query: "best family streaming fire tv stick",
		why: "Parents wanting one app."
	},
	{
		id: "ask",
		label: "Looking for a subscription",
		query: "looking for live tv subscription firestick",
		why: "Direct ask."
	}
];
var HUNT_NETS = [
	{
		id: "tiktok",
		label: "TikTok"
	},
	{
		id: "facebook",
		label: "Facebook"
	},
	{
		id: "instagram",
		label: "Instagram"
	},
	{
		id: "google",
		label: "Google"
	},
	{
		id: "x",
		label: "X"
	},
	{
		id: "reddit",
		label: "Reddit"
	},
	{
		id: "youtube",
		label: "YouTube"
	}
];
function bandLabel(b) {
	if (b === "hot") return "Interested";
	if (b === "warm") return "Maybe";
	return "Low";
}
function bandClass(b) {
	if (b === "hot") return "text-ok";
	if (b === "warm") return "text-warn";
	return "text-muted";
}
function HitCard({ h, onSave, onCopy, canSave }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex min-w-0 flex-col rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-faint uppercase",
					children: h.source
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: cn("text-sm font-medium", bandClass(h.band)),
					children: [
						bandLabel(h.band),
						" · ",
						h.score
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-2 font-display text-xl leading-snug break-words",
				children: h.title
			}),
			h.author ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: ["@", h.author]
			}) : null,
			h.body ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 line-clamp-3 text-sm text-muted",
				children: h.body
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-faint",
				children: h.summary
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						size: "sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: h.href,
							target: "_blank",
							rel: "noreferrer",
							children: ["Open post", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3.5" })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => onCopy(h.reply),
						children: "Copy reply"
					}),
					canSave ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "muted",
						onClick: () => onSave(h),
						children: "Save lead"
					}) : null
				]
			})
		]
	});
}
function HuntHome() {
	const data = Route$34.useLoaderData();
	const addLead = useEmber((s) => s.addLead);
	const leads = useEmber((s) => s.leads);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const posters = data.items.filter((h) => h.source.startsWith("Reddit"));
	const topics = data.items.filter((h) => !h.source.startsWith("Reddit"));
	const people = filter === "all" ? posters : posters.filter((h) => h.band === filter);
	function save(h) {
		addLead({
			name: h.author || h.title.slice(0, 40),
			contact: h.href,
			platform: h.source.startsWith("Reddit") ? "reddit" : "other",
			planId: h.planId,
			status: h.band === "hot" ? "interested" : "new",
			notes: `${h.band.toUpperCase()} ${h.score}/100 · ${h.source}. ${h.title}`
		});
		toast.success("Saved to Leads.");
	}
	async function copy(text) {
		await navigator.clipboard.writeText(text);
		toast.success("Reply copied.");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HuntShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-6xl px-4 py-10 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "max-w-2xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-[0.2em] text-primary uppercase",
						children: "Fire Stick · live TV"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-3 font-display text-4xl leading-tight sm:text-5xl",
						children: "Find who is interested."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-base text-muted",
						children: "Ember hunts public posts about Fire Stick and live TV, then scores them. TikTok, Facebook, and Instagram do not let apps pull people out — those hunts open in their own search. You reply yourself."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-sm text-faint",
						children: [
							data.note,
							" ",
							leads.length,
							" leads saved."
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-end justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "People posting now"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1",
						children: [
							"all",
							"hot",
							"warm"
						].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setFilter(f),
							className: cn("min-h-11 rounded-full px-3 text-sm capitalize", filter === f ? "bg-fg text-bg" : "bg-elevated text-muted"),
							children: f === "hot" ? "Interested" : f === "warm" ? "Maybe" : "All"
						}, f))
					})]
				}), people.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-6 rounded-xl bg-surface p-8 text-sm text-muted shadow-[var(--shadow-border)]",
					children: "Reddit is quiet in this filter. Use TikTok / Facebook / Instagram hunts below."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-5 grid gap-3 lg:grid-cols-2",
					children: people.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HitCard, {
						h,
						canSave: true,
						onSave: save,
						onCopy: (t) => void copy(t)
					}, h.id))
				})]
			}),
			topics.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-14",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "What’s being talked about"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "News and guides — not a person to message."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-5 grid gap-3 lg:grid-cols-2",
						children: topics.slice(0, 8).map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HitCard, {
							h,
							canSave: false,
							onSave: save,
							onCopy: (t) => void copy(t)
						}, h.id))
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-14",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Hunt TikTok, Facebook, Instagram"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-2xl text-sm text-muted",
						children: "These open their public search. Read the posts. If someone looks interested, paste it in Check a post, then save them."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-5 grid gap-3 sm:grid-cols-2",
						children: HUNTS.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-xl",
									children: h.label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: h.why
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 font-mono text-xs break-words text-faint",
									children: h.query
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-4 flex flex-wrap gap-2",
									children: HUNT_NETS.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										size: "sm",
										variant: "outline",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: searchUrl(n.id, h.query),
											target: "_blank",
											rel: "noreferrer",
											children: n.label
										})
									}, n.id))
								})
							]
						}, h.id))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				id: "check",
				className: "mt-14 scroll-mt-24",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Check a post"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-2xl text-sm text-muted",
						children: "Paste anything you found. Ember tells you if they are interested, maybe, or not now."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InterestScanner, {})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-16 text-center text-sm text-faint",
				children: [
					"Saved people live in",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/leads",
						className: "text-primary",
						children: "Leads"
					}),
					". Ember does not scrape private profiles or send auto-messages."
				]
			})
		]
	}) });
}
//#endregion
export { HuntHome as component };

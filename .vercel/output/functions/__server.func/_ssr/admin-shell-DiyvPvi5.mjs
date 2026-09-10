import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { d as useRouterState, m as Outlet, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as cn } from "./utils-CT3EiHu6.mjs";
import { A as Banknote, O as ChartColumn, a as UserRound, c as Tags, d as Settings, g as Menu, h as MessageSquare, l as Star, n as Wallet, p as ScrollText, r as Users, t as X, v as LayoutDashboard, w as ExternalLink, x as Gift } from "../_libs/lucide-react.mjs";
import { a as UserButton, n as OraMark, o as useCurrentUserState, r as RedirectToSignIn } from "./app-shell-14PMlmJH.mjs";
import { C as adminSession } from "./ora-admin-Uuns6yB9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-shell-DiyvPvi5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PRIMARY = [
	{
		to: "/admin",
		label: "Overview",
		icon: LayoutDashboard
	},
	{
		to: "/admin/advisors",
		label: "Advisors",
		icon: Users
	},
	{
		to: "/admin/customers",
		label: "Customers",
		icon: UserRound
	},
	{
		to: "/admin/sessions",
		label: "Sessions",
		icon: MessageSquare
	},
	{
		to: "/admin/finance",
		label: "Finance",
		icon: Wallet
	},
	{
		to: "/admin/payouts",
		label: "Payouts",
		icon: Banknote
	},
	{
		to: "/admin/reports",
		label: "Reports",
		icon: ChartColumn
	},
	{
		to: "/admin/settings",
		label: "Settings",
		icon: Settings
	}
];
var MORE = [
	{
		to: "/admin/reviews",
		label: "Reviews",
		icon: Star
	},
	{
		to: "/admin/categories",
		label: "Categories",
		icon: Tags
	},
	{
		to: "/admin/promos",
		label: "Promos",
		icon: Gift
	},
	{
		to: "/admin/audit",
		label: "Audit",
		icon: ScrollText
	}
];
var ALL_NAV = [...PRIMARY, ...MORE];
var IdentityContext = (0, import_react.createContext)(null);
function AdminLayout() {
	if (useRouterState({ select: (s) => s.location.pathname }) === "/admin/login") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) });
}
function AdminGuard({ children }) {
	const { user, isPending } = useCurrentUserState();
	const [state, setState] = (0, import_react.useState)("load");
	const [identity, setIdentity] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (isPending) return;
		if (!user) {
			setState("deny");
			return;
		}
		adminSession().then((s) => {
			setIdentity({
				name: s.name,
				email: s.email
			});
			setState("ok");
		}).catch(() => setState("deny"));
	}, [user, isPending]);
	if (isPending || state === "load") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-dvh bg-bg px-4 py-16 text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto h-40 max-w-5xl animate-pulse rounded-xl bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, { to: "/admin/login" });
	if (state === "deny") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-dvh max-w-sm bg-bg px-4 py-16 text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OraMark, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-8 font-display text-3xl",
				children: "Owner access only"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "This panel is not a public signup. Sign in with an assigned owner account, or with the first account on a new marketplace."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/admin/login",
				className: "mt-6 inline-flex h-11 items-center text-sm text-primary",
				children: "Owner sign in"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/",
				className: "mt-3 block text-sm text-faint",
				children: "Back to advisors"
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IdentityContext.Provider, {
		value: identity,
		children
	});
}
function isOn(path, to) {
	return to === "/admin" ? path === "/admin" || path === "/admin/" : path === to || path.startsWith(`${to}/`);
}
function NavList({ items, path, onNavigate }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-1",
		children: items.map((n) => {
			const Icon = n.icon;
			const on = isOn(path, n.to);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: n.to,
				onClick: onNavigate,
				"aria-current": on ? "page" : void 0,
				className: cn("flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 ease-[var(--ease-out)]", on ? "bg-primary text-primary-fg" : "text-muted hover:bg-elevated hover:text-fg"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "size-4 shrink-0",
					strokeWidth: on ? 2.2 : 1.8
				}), n.label]
			}) }, n.to);
		})
	});
}
function AdminShell({ children }) {
	const path = useRouterState({ select: (s) => s.location.pathname });
	const identity = (0, import_react.useContext)(IdentityContext);
	const [open, setOpen] = (0, import_react.useState)(false);
	const current = ALL_NAV.find((n) => isOn(path, n.to));
	(0, import_react.useEffect)(() => {
		setOpen(false);
	}, [path]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = prev;
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);
	const close = () => setOpen(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "fixed inset-0 z-40 bg-bg/70 md:hidden",
				"aria-label": "Close menu",
				onClick: close
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				id: "admin-sidebar",
				className: cn("fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-[var(--ease-out)]", open ? "translate-x-0" : "-translate-x-full md:translate-x-0"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 md:h-16",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-w-0 items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OraMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-primary/15 px-2 py-0.5 text-xs tracking-wide text-primary uppercase",
								children: "Owner"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "inline-flex size-11 items-center justify-center rounded-md text-muted hover:text-fg md:hidden",
							onClick: close,
							"aria-label": "Close menu",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						"aria-label": "Admin",
						className: "min-h-0 flex-1 overflow-y-auto px-3 py-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 px-3 text-xs tracking-wide text-faint uppercase",
								children: "Dashboard"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, {
								items: PRIMARY,
								path,
								onNavigate: close
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-6 mb-2 px-3 text-xs tracking-wide text-faint uppercase",
								children: "More"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, {
								items: MORE,
								path,
								onNavigate: close
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "shrink-0 border-t border-border/60 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate px-3 text-sm text-fg",
								children: identity?.name || "Owner"
							}),
							identity?.email ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate px-3 text-xs text-faint",
								children: identity.email
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/",
								className: "mt-2 flex h-11 items-center gap-2 rounded-md px-3 text-sm text-muted transition-colors duration-150 ease-[var(--ease-out)] hover:bg-elevated hover:text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-4 shrink-0" }), "View marketplace"]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "md:pl-64",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-bg/90 px-4 backdrop-blur-md md:h-16",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "inline-flex size-11 items-center justify-center rounded-md text-fg md:hidden",
							onClick: () => setOpen(true),
							"aria-label": "Open menu",
							"aria-expanded": open,
							"aria-controls": "admin-sidebar",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate font-display text-lg",
							children: current?.label ?? "Owner"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto w-full max-w-6xl px-4 py-6 lg:px-8",
					children
				})]
			})
		]
	});
}
function PageHeader({ title, description, kicker }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-6",
		children: [
			kicker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-faint uppercase",
				children: kicker
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: cn("font-display text-3xl tracking-tight", kicker && "mt-1"),
				children: title
			}),
			description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-2xl text-sm text-muted",
				children: description
			}) : null
		]
	});
}
function Stat({ label, value, hint, icon: Icon, to, pulse }) {
	const inner = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-faint uppercase",
				children: label
			}), Icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "relative flex size-8 shrink-0 items-center justify-center rounded-md bg-bg text-primary",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "size-4",
					strokeWidth: 1.8
				}), pulse ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-0.5 right-0.5 size-2 animate-pulse rounded-full bg-ok" }) : null]
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 font-display text-2xl tracking-tight tabular-nums",
			children: value
		}),
		hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs text-muted",
			children: hint
		}) : null
	] });
	const cls = "rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]";
	if (to) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		className: cn(cls, "block transition-colors duration-150 ease-[var(--ease-out)] hover:bg-elevated"),
		children: inner
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cls,
		children: inner
	});
}
function Panel({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-xl",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3",
			children
		})]
	});
}
//#endregion
export { Stat as i, PageHeader as n, Panel as r, AdminLayout as t };

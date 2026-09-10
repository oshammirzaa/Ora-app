import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { T as includedSeconds, f as formatClock } from "./ora-qKRq3G77.mjs";
import { t as cn } from "./utils-CT3EiHu6.mjs";
import { a as hasGateSessionMarker, t as GROK_PROVIDERS } from "./server-D1a15mPm.mjs";
import { T as Coins, i as User, k as Briefcase, y as House } from "../_libs/lucide-react.mjs";
import { i as signOut, r as signIn, t as authClient } from "./client-B1oB1RnN.mjs";
import { n as cachedPublicSettings, t as cachedMe } from "./client-cache-eGj0Q9iR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-shell-14PMlmJH.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function resolveSignInGateState(input) {
	if (input.isPending) return "pending";
	return input.hasUser ? "signed_in" : "signed_out";
}
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
/**
* Auth state components — plain wrappers around `useCurrentUserState()`.
*
* With auth on, visitors are signed out until they authenticate — in the sandbox
* live preview too, which does real sign-in. The shared dev user appears only
* when auth is disabled (`VITE_AUTH_ENABLED=false`, the shipped default).
* While the session is still resolving, gates that care about signed-out state
* render nothing so there's no signed-out flash on hard reload.
*/
/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
var SIGN_IN_PATH = "/login";
/**
* Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
* `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
* session loading, which feels like a second "Loading…" on /login.
*
* Guard routes by waiting out `isPending` first (see `use-current-user`), then
* render this.
*/
function RedirectToSignIn({ to = SIGN_IN_PATH }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to });
}
function SignInGate({ children, fallback }) {
	const { user, isPending } = useCurrentUserState();
	const state = resolveSignInGateState({
		isPending,
		hasUser: user !== null
	});
	if (state === "pending") return null;
	if (state === "signed_in") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: fallback ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignInButtons, {}) });
}
function SignInButtons() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex w-full max-w-sm flex-col gap-2",
		children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => signIn(p.providerId, { callbackURL: "/" }),
			className: "w-full cursor-pointer rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900",
			children: ["Continue with ", p.label]
		}, p.providerId))
	});
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid size-8 place-items-center rounded-full bg-elevated text-sm font-medium text-fg",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "hidden max-w-32 truncate text-sm font-medium sm:inline",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
/** Run `fn` on a timer only while the tab is visible. Pauses in background. Skips overlapping ticks. */
function useVisibleInterval(fn, ms, enabled = true, fireOnStart = true) {
	const fnRef = (0, import_react.useRef)(fn);
	fnRef.current = fn;
	(0, import_react.useEffect)(() => {
		if (!enabled) return;
		let id = 0;
		let running = false;
		const tick = () => {
			if (running || document.visibilityState === "hidden") return;
			running = true;
			Promise.resolve(fnRef.current()).finally(() => {
				running = false;
			});
		};
		const stop = () => {
			if (id) window.clearInterval(id);
			id = 0;
		};
		const start = () => {
			stop();
			id = window.setInterval(tick, ms);
		};
		const onVis = () => {
			if (document.visibilityState === "hidden") {
				stop();
				return;
			}
			tick();
			start();
		};
		if (document.visibilityState !== "hidden") {
			if (fireOnStart) tick();
			start();
		}
		document.addEventListener("visibilitychange", onVis);
		return () => {
			stop();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, [
		ms,
		enabled,
		fireOnStart
	]);
}
function OraMark({ className }) {
	const [name, setName] = (0, import_react.useState)("Ora");
	const [logo, setLogo] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		cachedPublicSettings().then((s) => {
			if (s.name) setName(s.name);
			if (s.logoUrl) setLogo(s.logoUrl);
		}).catch(() => {});
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/",
		preload: false,
		className: cn("flex items-center gap-2 text-fg", className),
		children: [logo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: logo,
			alt: "",
			className: "size-8 rounded-sm object-cover"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex size-8 items-center justify-center rounded-sm bg-primary",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-sm text-primary-fg",
				children: name.slice(0, 1)
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-lg tracking-tight",
			children: name
		})]
	});
}
function TimeChip() {
	const { user, isPending } = useCurrentUserState();
	const [me, setMe] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!user) {
			setMe(null);
			return;
		}
		cachedMe().then(setMe).catch(() => setMe(null));
	}, [user]);
	useVisibleInterval(() => {
		if (!user) return;
		cachedMe().then(setMe).catch(() => {});
	}, 2e4, Boolean(user), false);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-9 w-16 animate-pulse rounded-md bg-elevated" });
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/login",
		preload: false,
		className: "inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-fg",
		children: "Sign in"
	});
	const inc = me ? includedSeconds(me.wallet) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/account",
			preload: false,
			className: "inline-flex h-9 items-center rounded-md bg-elevated px-3 text-xs tabular-nums text-muted",
			children: me ? inc > 0 ? formatClock(inc) : `${me.wallet.coins}c` : "…"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})]
	});
}
var TABS = [
	{
		id: "home",
		to: "/",
		label: "Home",
		icon: House
	},
	{
		id: "wallet",
		to: "/account",
		label: "Wallet",
		icon: Coins
	},
	{
		id: "work",
		to: "/advisor",
		label: "Work",
		icon: Briefcase
	},
	{
		id: "you",
		to: "/me",
		label: "You",
		icon: User
	}
];
function AppShell({ children, tab, hideTab = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex min-h-dvh w-full max-w-[430px] flex-col md:shadow-[var(--shadow-border)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-bg/90 px-4 backdrop-blur-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OraMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TimeChip, {})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: cn("flex-1", hideTab ? "" : "pb-20"),
					children
				}),
				hideTab ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "sticky bottom-0 z-40 grid h-16 grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
					children: TABS.map((t) => {
						const Icon = t.icon;
						const on = tab === t.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: t.to,
							preload: false,
							className: cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]", on ? "text-primary" : "text-faint"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-5",
								strokeWidth: on ? 2.2 : 1.8
							}), t.label]
						}, t.id);
					})
				})
			]
		})
	});
}
//#endregion
export { UserButton as a, SignInGate as i, OraMark as n, useCurrentUserState as o, RedirectToSignIn as r, useVisibleInterval as s, AppShell as t };

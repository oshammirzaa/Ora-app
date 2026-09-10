import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { T as includedSeconds, X as updateProfile, Y as toggleFavorite, f as formatClock, g as getCustomer, m as formatWhen } from "./ora-qKRq3G77.mjs";
import { _ as LogOut, b as Heart } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as signOut, t as authClient } from "./client-B1oB1RnN.mjs";
import { o as useCurrentUserState, t as AppShell } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as AdvisorMedia } from "./advisor-media-DGA5XZzZ.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/me-BRQaDJMR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MePage() {
	const { user, isPending } = useCurrentUserState();
	const [data, setData] = (0, import_react.useState)(null);
	const [name, setName] = (0, import_react.useState)("");
	const [currentPw, setCurrentPw] = (0, import_react.useState)("");
	const [newPw, setNewPw] = (0, import_react.useState)("");
	const [out, setOut] = (0, import_react.useState)(false);
	async function load() {
		const next = await getCustomer();
		setData(next);
		setName(next.me.displayName);
	}
	(0, import_react.useEffect)(() => {
		if (!user) return;
		load().catch(() => setData(null));
	}, [user]);
	async function saveName(e) {
		e.preventDefault();
		const next = await updateProfile({ data: { displayName: name } });
		setData((d) => d ? {
			...d,
			me: next
		} : d);
		toast.success("Profile saved.");
	}
	async function savePassword(e) {
		e.preventDefault();
		const client = authClient;
		if (!client.changePassword) {
			toast.error("Password change is not available for this sign-in method.");
			return;
		}
		const { error } = await client.changePassword({
			currentPassword: currentPw,
			newPassword: newPw
		});
		if (error) {
			toast.error(error.message || "Could not update password");
			return;
		}
		setCurrentPw("");
		setNewPw("");
		toast.success("Password updated.");
	}
	async function unsave(id) {
		await toggleFavorite({ data: { advisorId: id } });
		await load();
	}
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "you",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-4 mt-8 h-48 animate-pulse rounded-xl bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "you",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl",
					children: "Account"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Sign in for three free minutes, your wallet, past readings, and saved advisors."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					className: "mt-6 w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						children: "Sign in"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "outline",
					className: "mt-3 w-full",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/signup",
						children: "Create account"
					})
				})
			]
		})
	});
	const me = data?.me;
	const w = me?.wallet;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "you",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-faint uppercase",
					children: "Customer account"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-display text-3xl",
					children: "Account"
				}),
				me?.status === "suspended" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 rounded-xl bg-surface p-4 text-sm text-danger shadow-[var(--shadow-border)]",
					children: "This account is suspended. Readings and purchases are paused."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-faint uppercase",
							children: "Profile"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-display text-2xl",
							children: me?.displayName || user.displayName
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: me?.email || user.primaryEmail || "Email on file after first sign-in"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-faint uppercase",
							children: "Wallet"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 font-display text-3xl tabular-nums",
							children: [w ? w.coins : "—", " coins"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-muted",
							children: [
								"Promo ",
								w ? formatClock(w.bonusSeconds) : "—",
								" · This week ",
								w ? formatClock(w.weeklySeconds) : "—",
								w?.subscribed ? " · subscribed" : ""
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-primary",
							children: ["Included time ", w ? formatClock(includedSeconds(w)) : "—"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							className: "mt-4 w-full",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/account",
								children: "Add funds"
							})
						})
					]
				}),
				w && w.bonusSeconds > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-primary",
							children: "Free promotional minutes"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-muted",
							children: [formatClock(w.bonusSeconds), " left from first login. Use them with any advisor before coins."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							variant: "outline",
							className: "mt-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/",
								children: "Start a reading"
							})
						})
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Previous sessions"
					}), !data?.sessions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "No readings yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2",
						children: data.sessions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/reading/$id",
							params: { id: s.id },
							className: "flex items-center gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-12 overflow-hidden rounded-lg bg-elevated",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorMedia, { photo: s.photoUrl })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate font-display",
										children: s.advisorName
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-muted",
										children: [
											formatWhen(s.startedAt),
											s.endedAt ? ` – ${formatWhen(s.endedAt)}` : "",
											" · ",
											formatClock(s.seconds),
											" · ",
											s.coinsSpent,
											"c ·",
											" ",
											s.rateCoins,
											"c/min"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-faint",
										children: s.status === "ended" ? s.reviewed ? "Reviewed" : "Rate this reading" : "Live"
									})
								]
							})]
						}) }, s.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Transactions"
					}), !data?.ledger.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "No movement yet. Add funds or start a reading."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]",
						children: data.ledger.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-start justify-between gap-3 px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm",
								children: row.note
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-faint",
								children: formatWhen(row.createdAt)
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm tabular-nums text-primary",
								children: row.amountCoins !== 0 ? `${row.amountCoins > 0 ? "+" : ""}${row.amountCoins}c` : formatClock(row.seconds)
							})]
						}, row.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Saved advisors"
					}), !data?.favorites.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Save someone from their profile. They show up here."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2",
						children: data.favorites.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/advisors/$id",
									params: { id: a.slug },
									className: "size-12 overflow-hidden rounded-lg bg-elevated",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorMedia, { photo: a.photoUrl })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/advisors/$id",
									params: { id: a.slug },
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate font-display",
										children: a.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-xs text-muted",
										children: a.specialties
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "flex size-10 items-center justify-center text-primary",
									onClick: () => void unsave(a.id),
									"aria-label": "Remove saved advisor",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-4 fill-primary" })
								})
							]
						}, a.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Account settings"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: (e) => void saveName(e),
							className: "mt-4 space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "dn",
									children: "Display name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "dn",
									value: name,
									onChange: (e) => setName(e.target.value),
									minLength: 2,
									required: true
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								variant: "outline",
								children: "Save name"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: (e) => void savePassword(e),
							className: "mt-6 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs tracking-wide text-faint uppercase",
									children: "Change password"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "cpw",
										children: "Current password"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "cpw",
										type: "password",
										value: currentPw,
										onChange: (e) => setCurrentPw(e.target.value),
										minLength: 8,
										required: true
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "npw",
										children: "New password"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "npw",
										type: "password",
										value: newPw,
										onChange: (e) => setNewPw(e.target.value),
										minLength: 8,
										required: true
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "submit",
									variant: "outline",
									children: "Update password"
								})
							]
						})
					]
				}),
				me?.role === "admin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					className: "mt-4 block rounded-xl bg-surface px-4 py-4 text-sm shadow-[var(--shadow-border)]",
					to: "/admin",
					children: "Owner panel"
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					className: "mt-3 block rounded-xl bg-surface px-4 py-4 text-sm shadow-[var(--shadow-border)]",
					to: "/advisor",
					children: me?.advisorId ? "Advisor desk" : me?.pendingApplication ? "Advisor application status" : "Work as an advisor"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "outline",
					className: "mt-8 w-full",
					disabled: out,
					onClick: () => {
						setOut(true);
						signOut().catch(() => setOut(false));
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4" }), out ? "Signing out…" : "Log out"]
				})
			]
		})
	});
}
//#endregion
export { MePage as component };

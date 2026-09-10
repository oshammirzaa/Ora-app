import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { G as setOnline, V as saveAdvisorProfile, _ as getDesk } from "./ora-qKRq3G77.mjs";
import { l as Star } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as signOut, t as authClient } from "./client-B1oB1RnN.mjs";
import { o as useCurrentUserState, r as RedirectToSignIn } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as AdvisorMedia } from "./advisor-media-DGA5XZzZ.mjs";
import { t as Textarea } from "./textarea-D0gZAkVV.mjs";
import { t as AdvisorShell } from "./advisor-shell-Cqh0aqf3.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
import { t as readImageFile } from "./file-data-BpPDGUIe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-fmxkWYef.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ProfilePage() {
	const { user, isPending } = useCurrentUserState();
	const [desk, setDesk] = (0, import_react.useState)(null);
	const [name, setName] = (0, import_react.useState)("");
	const [bio, setBio] = (0, import_react.useState)("");
	const [experience, setExperience] = (0, import_react.useState)("");
	const [specialties, setSpecialties] = (0, import_react.useState)("");
	const [languages, setLanguages] = (0, import_react.useState)("English");
	const [years, setYears] = (0, import_react.useState)(0);
	const [rate, setRate] = (0, import_react.useState)(20);
	const [photo, setPhoto] = (0, import_react.useState)("");
	const [currentPw, setCurrentPw] = (0, import_react.useState)("");
	const [newPw, setNewPw] = (0, import_react.useState)("");
	const [out, setOut] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		getDesk().then((d) => {
			setDesk(d);
			if (d.advisor) {
				setName(d.advisor.name);
				setBio(d.advisor.bio);
				setExperience(d.advisor.experience);
				setSpecialties(d.advisor.specialties);
				setLanguages(d.advisor.languages);
				setYears(d.advisor.years);
				setRate(d.advisor.rateCoins);
			}
		});
	}, [user]);
	async function save(e) {
		e.preventDefault();
		try {
			await saveAdvisorProfile({ data: {
				name,
				bio,
				experience,
				specialties,
				rateCoins: rate,
				languages,
				years,
				photoUrl: photo || void 0
			} });
			toast.success("Profile saved.");
			setDesk(await getDesk());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not save");
		}
	}
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "profile",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, { to: "/advisor/login" });
	const adv = desk?.advisor;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorShell, {
		tab: "profile",
		online: adv?.online,
		busy: adv?.busy,
		canToggle: adv?.status === "live",
		onToggle: (v) => void setOnline({ data: { online: v } }).then(() => getDesk().then(setDesk)),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl",
					children: "Profile"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: adv ? `${adv.status === "live" ? "Approved" : adv.status} · ${adv.rating.toFixed(1)} from ${adv.reviews} reviews` : desk?.applicationStatus ? `Application ${desk.applicationStatus}` : "No live profile yet."
				}),
				desk?.me.email ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-faint",
					children: desk.me.email
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-4 rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-faint uppercase",
						children: "Verification"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1",
						children: adv?.status === "live" ? "Approved. Toggle Online on the desk to appear Live." : desk?.applicationStatus === "pending" ? "Pending house review. You cannot go online yet." : desk?.applicationStatus === "declined" ? "Declined. Update your application and submit again." : "Submit an application to open a desk."
					})]
				}),
				adv ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: (e) => void save(e),
					className: "mt-6 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "aspect-3/4 overflow-hidden rounded-xl bg-elevated",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorMedia, { photo: photo || adv.photoUrl })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "ph",
								children: "Replace photo"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "ph",
								type: "file",
								accept: "image/*",
								onChange: (e) => {
									const f = e.target.files?.[0];
									if (f) readImageFile(f).then(setPhoto).catch((err) => toast.error(String(err.message)));
								}
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "n",
								children: "Display name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "n",
								value: name,
								onChange: (e) => setName(e.target.value),
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "b",
								children: "Bio"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "b",
								value: bio,
								onChange: (e) => setBio(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "e",
								children: "Experience"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "e",
								value: experience,
								onChange: (e) => setExperience(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "s",
								children: "Specialties"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "s",
								value: specialties,
								onChange: (e) => setSpecialties(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "l",
								children: "Languages"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "l",
								value: languages,
								onChange: (e) => setLanguages(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "y",
									children: "Years"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "y",
									type: "number",
									value: years,
									onChange: (e) => setYears(Number(e.target.value))
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "r",
									children: "Coins / min"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "r",
									type: "number",
									value: rate,
									onChange: (e) => setRate(Number(e.target.value))
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							className: "w-full",
							children: "Save profile"
						})
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Ratings and reviews"
					}), !desk?.reviews.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "No reviews yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-2",
						children: desk.reviews.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "inline-flex items-center gap-1 text-primary",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "size-3 fill-primary" }),
									" ",
									r.rating
								]
							}), r.body ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-muted",
								children: r.body
							}) : null]
						}, r.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Account settings"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: desk?.me.email || user.primaryEmail || "Email on file"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: (e) => {
								e.preventDefault();
								const client = authClient;
								if (!client.changePassword) {
									toast.error("Password change is not available for this sign-in method.");
									return;
								}
								client.changePassword({
									currentPassword: currentPw,
									newPassword: newPw
								}).then(({ error }) => {
									if (error) {
										toast.error(error.message || "Could not update password");
										return;
									}
									setCurrentPw("");
									setNewPw("");
									toast.success("Password updated.");
								});
							},
							className: "mt-4 space-y-3",
							children: [
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
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/me",
							className: "mt-4 block text-sm text-primary",
							children: "Open customer account"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					className: "mt-8 w-full",
					disabled: out,
					onClick: () => {
						setOut(true);
						signOut().catch(() => setOut(false));
					},
					children: out ? "Signing out…" : "Log out"
				})
			]
		})
	});
}
//#endregion
export { ProfilePage as component };

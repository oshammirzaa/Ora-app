import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as applyAdvisor } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as authClient } from "./client-B1oB1RnN.mjs";
import { o as useCurrentUserState } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as Textarea } from "./textarea-D0gZAkVV.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
import { t as readImageFile } from "./file-data-BpPDGUIe.mjs";
import { n as PasswordField, r as SocialSignIn, t as AuthFrame } from "./auth-frame-BSmPV9ng.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/signup-t2wylwAm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdvisorSignup() {
	const { user } = useCurrentUserState();
	const [legalName, setLegalName] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [confirm, setConfirm] = (0, import_react.useState)("");
	const [bio, setBio] = (0, import_react.useState)("");
	const [experience, setExperience] = (0, import_react.useState)("");
	const [specialties, setSpecialties] = (0, import_react.useState)("Tarot, Love");
	const [languages, setLanguages] = (0, import_react.useState)("English");
	const [years, setYears] = (0, import_react.useState)(5);
	const [rate, setRate] = (0, import_react.useState)(20);
	const [photo, setPhoto] = (0, import_react.useState)("");
	const [terms, setTerms] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onPhoto(file) {
		if (!file) return;
		try {
			setPhoto(await readImageFile(file));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Photo failed");
		}
	}
	async function submitApplication() {
		await applyAdvisor({ data: {
			name: name.trim(),
			legalName: legalName.trim(),
			bio,
			experience,
			specialties,
			rateCoins: rate,
			photoUrl: photo,
			languages,
			years
		} });
	}
	async function onSubmit(e) {
		e.preventDefault();
		setError("");
		if (!user) {
			if (password !== confirm) {
				setError("Passwords do not match.");
				return;
			}
		}
		if (!terms) {
			setError("Accept the terms to apply.");
			return;
		}
		if (!photo) {
			setError("Add a profile photo.");
			return;
		}
		setBusy(true);
		try {
			if (!user) {
				const { error: err } = await authClient.signUp.email({
					email,
					password,
					name: legalName.trim() || name.trim(),
					callbackURL: "/advisor"
				});
				if (err) throw new Error(err.message || "Could not create account");
			}
			await submitApplication();
			window.location.assign("/advisor");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Try again");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
		title: "Advisor application",
		subtitle: "Create your desk account. The house reviews you before you can go live.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			user ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SocialSignIn, { callbackURL: "/advisor/signup" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-center text-xs tracking-wide text-faint uppercase",
				children: "or email"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "legal",
							children: "Full name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "legal",
							value: legalName,
							onChange: (e) => setLegalName(e.target.value),
							required: true,
							minLength: 2
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "disp",
							children: "Advisor display name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "disp",
							value: name,
							onChange: (e) => setName(e.target.value),
							required: true,
							minLength: 2
						})]
					}),
					user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Applying with ",
							user.primaryEmail || user.displayName,
							"."
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "email",
								children: "Email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "email",
								type: "email",
								value: email,
								onChange: (e) => setEmail(e.target.value),
								required: true
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordField, {
							id: "pw",
							label: "Password",
							value: password,
							onChange: setPassword,
							autoComplete: "new-password"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordField, {
							id: "pw2",
							label: "Confirm password",
							value: confirm,
							onChange: setConfirm,
							autoComplete: "new-password"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "photo",
								children: "Profile photo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "photo",
								type: "file",
								accept: "image/*",
								onChange: (e) => void onPhoto(e.target.files?.[0])
							}),
							photo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: photo,
								alt: "",
								className: "mt-2 h-28 w-24 rounded-md object-cover"
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "bio",
							children: "Bio / about me"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "bio",
							value: bio,
							onChange: (e) => setBio(e.target.value),
							required: true,
							minLength: 20
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "ex",
							children: "Experience"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "ex",
							value: experience,
							onChange: (e) => setExperience(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "sp",
							children: "Specialties"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "sp",
							value: specialties,
							onChange: (e) => setSpecialties(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "yr",
								children: "Years"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "yr",
								type: "number",
								min: 0,
								max: 60,
								value: years,
								onChange: (e) => setYears(Number(e.target.value))
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "rate",
								children: "Coins / min"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "rate",
								type: "number",
								min: 8,
								max: 80,
								value: rate,
								onChange: (e) => setRate(Number(e.target.value))
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "lang",
							children: "Languages"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "lang",
							value: languages,
							onChange: (e) => setLanguages(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-start gap-3 text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: terms,
							onChange: (e) => setTerms(e.target.checked),
							className: "mt-1 size-4 accent-primary"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"I accept the",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/terms",
								className: "text-primary",
								children: "terms"
							}),
							". The house must approve me before I go online."
						] })]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "w-full",
						disabled: busy,
						children: busy ? "Submitting…" : "Submit application"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					"Already applied?",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/advisor/login",
						className: "text-primary",
						children: "Advisor sign in"
					})
				]
			})
		] })
	});
}
//#endregion
export { AdvisorSignup as component };

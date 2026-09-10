import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as applyAdvisor } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as SignInGate, o as useCurrentUserState, r as RedirectToSignIn, t as AppShell } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as Textarea } from "./textarea-D0gZAkVV.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
import { t as readImageFile } from "./file-data-BpPDGUIe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/apply-64dBe71u.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ApplyPage() {
	const { user, isPending } = useCurrentUserState();
	const [legalName, setLegalName] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	const [bio, setBio] = (0, import_react.useState)("");
	const [experience, setExperience] = (0, import_react.useState)("");
	const [specialties, setSpecialties] = (0, import_react.useState)("Tarot, Love");
	const [languages, setLanguages] = (0, import_react.useState)("English");
	const [years, setYears] = (0, import_react.useState)(5);
	const [rate, setRate] = (0, import_react.useState)(20);
	const [photo, setPhoto] = (0, import_react.useState)("");
	const [video, setVideo] = (0, import_react.useState)("");
	const [sent, setSent] = (0, import_react.useState)(false);
	async function onPhoto(file) {
		if (!file) return;
		try {
			setPhoto(await readImageFile(file));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Photo failed");
		}
	}
	async function submit(e) {
		e.preventDefault();
		try {
			await applyAdvisor({ data: {
				name,
				legalName,
				bio,
				experience,
				specialties,
				rateCoins: rate,
				photoUrl: photo,
				videoUrl: video,
				languages,
				years
			} });
			setSent(true);
			toast.success("Application sent. The panel reviews it.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not send");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "work",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl",
					children: "Advisor application"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Full name, working name, bio, specialties, years, rate, languages, and a photo. The house approves you before you can go Live."
				}),
				isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-8 h-40 animate-pulse rounded-xl bg-elevated" }) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignInGate, {
					fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: "Sign in to apply with this account, or create an advisor desk."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								className: "mt-3 w-full",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/advisor/signup",
									children: "Create advisor account"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								variant: "outline",
								className: "mt-2 w-full",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/login",
									children: "Customer sign in"
								})
							})
						]
					}),
					children: sent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-8 rounded-xl bg-surface p-6 text-ok",
						children: "Received. Watch the advisor desk after you are approved — you cannot go online until then."
					}) : user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: submit,
						className: "mt-8 space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Full name",
								id: "legal",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "legal",
									value: legalName,
									onChange: (e) => setLegalName(e.target.value),
									required: true,
									minLength: 2
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Advisor display name",
								id: "n",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "n",
									value: name,
									onChange: (e) => setName(e.target.value),
									required: true
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Bio / about me",
								id: "b",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
									id: "b",
									value: bio,
									onChange: (e) => setBio(e.target.value),
									required: true,
									minLength: 20,
									placeholder: "What you read, how you sit with people. At least 20 characters."
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Experience",
								id: "e",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
									id: "e",
									value: experience,
									onChange: (e) => setExperience(e.target.value),
									placeholder: "Years, training, rooms you've worked."
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Specialties",
								id: "s",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "s",
									value: specialties,
									onChange: (e) => setSpecialties(e.target.value)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Years",
									id: "yr",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "yr",
										type: "number",
										min: 0,
										max: 60,
										value: years,
										onChange: (e) => setYears(Number(e.target.value))
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Coins / min",
									id: "r",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "r",
										type: "number",
										min: 8,
										max: 80,
										value: rate,
										onChange: (e) => setRate(Number(e.target.value))
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-faint",
								children: "10 coins = $1. 20 coins/min is $2/min."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Languages",
								id: "lang",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "lang",
									value: languages,
									onChange: (e) => setLanguages(e.target.value)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
								label: "Photo",
								id: "p",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "p",
									type: "file",
									accept: "image/*",
									onChange: (e) => void onPhoto(e.target.files?.[0])
								}), photo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: photo,
									alt: "",
									className: "mt-2 h-32 rounded-md object-cover"
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Intro video URL",
								id: "v",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "v",
									value: video,
									onChange: (e) => setVideo(e.target.value),
									placeholder: "YouTube, Vimeo, or a direct .mp4 link"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								children: "Submit application"
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-8 text-sm text-muted",
					children: [
						"Already have a desk?",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/advisor/login",
							className: "text-primary",
							children: "Advisor sign in"
						})
					]
				})
			]
		})
	});
}
function Field({ label, id, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			htmlFor: id,
			children: label
		}), children]
	});
}
//#endregion
export { ApplyPage as component };

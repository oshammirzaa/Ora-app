import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { C as getStudio, H as saveStudio } from "./ora-qKRq3G77.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { o as useCurrentUserState, r as RedirectToSignIn, t as AppShell } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { n as AdvisorVideoEmbed, r as isDirectVideo, t as AdvisorMedia } from "./advisor-media-DGA5XZzZ.mjs";
import { t as Textarea } from "./textarea-D0gZAkVV.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
import { t as readImageFile } from "./file-data-BpPDGUIe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/studio-7hUl29CP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function StudioPage() {
	const { user, isPending } = useCurrentUserState();
	const [adv, setAdv] = (0, import_react.useState)("load");
	const [bio, setBio] = (0, import_react.useState)("");
	const [experience, setExperience] = (0, import_react.useState)("");
	const [specialties, setSpecialties] = (0, import_react.useState)("");
	const [rate, setRate] = (0, import_react.useState)(20);
	const [photo, setPhoto] = (0, import_react.useState)("");
	const [video, setVideo] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (!user) return;
		getStudio().then((a) => {
			setAdv(a);
			if (a) {
				setBio(a.bio);
				setExperience(a.experience);
				setSpecialties(a.specialties);
				setRate(a.rateCoins);
				setVideo(a.videoUrl);
			}
		});
	}, [user]);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "work",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	async function save(e) {
		e.preventDefault();
		await saveStudio({ data: {
			bio,
			experience,
			specialties,
			rateCoins: rate,
			photoUrl: photo || void 0,
			videoUrl: video
		} });
		toast.success("Studio saved.");
		const a = await getStudio();
		setAdv(a);
		if (a) setPhoto("");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		tab: "work",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "px-4 py-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl",
				children: "Studio"
			}), adv === "load" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-8 h-32 animate-pulse rounded-xl bg-elevated" }) : !adv ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-6 text-muted",
				children: [
					"No live profile yet.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/apply",
						className: "text-primary",
						children: "Apply as an advisor"
					}),
					"."
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: save,
				className: "mt-8 space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							adv.name,
							" · ",
							adv.status
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "aspect-3/4 overflow-hidden rounded-xl bg-elevated",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorMedia, {
							photo: photo || adv.photoUrl,
							video: adv.videoUrl,
							alt: ""
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "bio",
							children: "Bio"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "bio",
							value: bio,
							onChange: (e) => setBio(e.target.value)
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
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "rt",
							children: "Coins per minute"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "rt",
							type: "number",
							min: 8,
							max: 80,
							value: rate,
							onChange: (e) => setRate(Number(e.target.value))
						})]
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
							htmlFor: "vid",
							children: "Intro video URL"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "vid",
							value: video,
							onChange: (e) => setVideo(e.target.value)
						})]
					}),
					video && !isDirectVideo(video) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvisorVideoEmbed, { url: video }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						children: "Save profile"
					})
				]
			})]
		})
	});
}
//#endregion
export { StudioPage as component };

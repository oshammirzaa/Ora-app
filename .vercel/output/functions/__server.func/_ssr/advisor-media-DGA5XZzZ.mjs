import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as cn } from "./utils-CT3EiHu6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/advisor-media-DGA5XZzZ.js
var import_jsx_runtime = require_jsx_runtime();
function isDirectVideo(url) {
	if (!url) return false;
	return url.startsWith("/videos/") || /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}
function youtubeId(url) {
	return url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}
function AdvisorMedia({ photo, video, className, alt = "", eager = false }) {
	if (video && isDirectVideo(video)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
		src: video,
		poster: photo || void 0,
		autoPlay: true,
		muted: true,
		loop: true,
		playsInline: true,
		preload: "metadata",
		className: cn("size-full object-cover", className)
	});
	if (!photo) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("size-full bg-elevated", className),
		"aria-hidden": true
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
		src: photo,
		alt,
		loading: eager ? "eager" : "lazy",
		decoding: "async",
		className: cn("size-full object-cover", className)
	});
}
function AdvisorVideoEmbed({ url }) {
	const yt = youtubeId(url);
	if (yt) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
		title: "Intro video",
		src: `https://www.youtube.com/embed/${yt}`,
		className: "aspect-video w-full rounded-lg bg-elevated",
		allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
		allowFullScreen: true
	});
	if (isDirectVideo(url)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
		src: url,
		controls: true,
		playsInline: true,
		preload: "metadata",
		className: "aspect-video w-full rounded-lg bg-elevated"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
		href: url,
		className: "text-sm text-primary",
		target: "_blank",
		rel: "noreferrer",
		children: "Intro video"
	});
}
//#endregion
export { AdvisorVideoEmbed as n, isDirectVideo as r, AdvisorMedia as t };

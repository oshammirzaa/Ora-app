import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as GROK_PROVIDERS } from "./server-D1a15mPm.mjs";
import { C as EyeOff, S as Eye } from "../_libs/lucide-react.mjs";
import { r as signIn } from "./client-B1oB1RnN.mjs";
import { n as OraMark } from "./app-shell-14PMlmJH.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-frame-BSmPV9ng.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AuthFrame({ title, subtitle, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto min-h-dvh max-w-[430px] bg-bg px-4 py-10 text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto w-full max-w-sm space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OraMark, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: subtitle
				})] }),
				children,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "block text-sm text-faint hover:text-fg",
					children: "Back to advisors"
				})
			]
		})
	});
}
function SocialSignIn({ callbackURL = "/me" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			type: "button",
			variant: "outline",
			className: "w-full",
			onClick: () => signIn(p.providerId, { callbackURL }),
			children: ["Continue with ", p.label]
		}, p.providerId))
	});
}
function PasswordField({ id, label, value, onChange, autoComplete }) {
	const [show, setShow] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			htmlFor: id,
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				id,
				type: show ? "text" : "password",
				value,
				onChange: (e) => onChange(e.target.value),
				minLength: 8,
				required: true,
				autoComplete,
				className: "pr-11"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center text-faint hover:text-fg",
				onClick: () => setShow((s) => !s),
				"aria-label": show ? "Hide password" : "Show password",
				children: show ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" })
			})]
		})]
	});
}
//#endregion
export { PasswordField as n, SocialSignIn as r, AuthFrame as t };

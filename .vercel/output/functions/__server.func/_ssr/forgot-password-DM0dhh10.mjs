import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as authClient } from "./client-B1oB1RnN.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
import { t as AuthFrame } from "./auth-frame-BSmPV9ng.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/forgot-password-DM0dhh10.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Forgot() {
	const [email, setEmail] = (0, import_react.useState)("");
	const [sent, setSent] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onSubmit(e) {
		e.preventDefault();
		setBusy(true);
		try {
			const client = authClient;
			const redirectTo = `${window.location.origin}/reset-password`;
			if (client.requestPasswordReset) await client.requestPasswordReset({
				email,
				redirectTo
			});
			else if (client.forgetPassword) await client.forgetPassword({
				email,
				redirectTo
			});
		} catch {} finally {
			setSent(true);
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthFrame, {
		title: "Forgot password",
		subtitle: "Enter the email on your account. If it is on file, we send reset instructions.",
		children: [sent ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "rounded-xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]",
			children: [
				"If an account exists for ",
				email,
				", check that inbox for a reset link. Then",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					className: "text-primary",
					children: "sign in"
				}),
				"."
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit,
			className: "space-y-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "email",
					children: "Email"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "email",
					type: "email",
					value: email,
					onChange: (e) => setEmail(e.target.value),
					autoComplete: "email",
					required: true
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				className: "w-full",
				disabled: busy,
				children: busy ? "Sending…" : "Send reset link"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-muted",
			children: [
				"Remembered it?",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					className: "text-primary hover:text-fg",
					children: "Sign in"
				})
			]
		})]
	});
}
//#endregion
export { Forgot as component };

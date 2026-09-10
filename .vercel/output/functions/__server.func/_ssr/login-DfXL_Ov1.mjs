import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as authClient } from "./client-B1oB1RnN.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
import { t as Label } from "./label-DjjXosJk.mjs";
import { n as PasswordField, r as SocialSignIn, t as AuthFrame } from "./auth-frame-BSmPV9ng.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-DfXL_Ov1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminLogin() {
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onSubmit(e) {
		e.preventDefault();
		setError("");
		setBusy(true);
		try {
			const { error: err } = await authClient.signIn.email({
				email,
				password,
				callbackURL: "/admin"
			});
			if (err) throw new Error(err.message || "Could not sign in");
			window.location.assign("/admin");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Try again");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
		title: "Owner sign in",
		subtitle: "No public signup. The first account on a new marketplace becomes owner. After that, owners are assigned.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SocialSignIn, { callbackURL: "/admin" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-center text-xs tracking-wide text-faint uppercase",
				children: "or email"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: "space-y-3",
				children: [
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
							autoComplete: "email",
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordField, {
						id: "pw",
						label: "Password",
						value: password,
						onChange: setPassword,
						autoComplete: "current-password"
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "w-full",
						disabled: busy,
						children: busy ? "Signing in…" : "Sign in to owner panel"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-faint",
				children: [
					"Customer?",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						className: "text-primary",
						children: "Sign in for a reading"
					})
				]
			})
		] })
	});
}
//#endregion
export { AdminLogin as component };

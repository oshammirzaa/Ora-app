import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as authClient } from "./client-B1oB1RnN.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { n as PasswordField, t as AuthFrame } from "./auth-frame-BSmPV9ng.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reset-password-DtRuh_D2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Reset() {
	const [password, setPassword] = (0, import_react.useState)("");
	const [confirm, setConfirm] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [done, setDone] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function onSubmit(e) {
		e.preventDefault();
		setError("");
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		const token = new URLSearchParams(window.location.search).get("token") || "";
		if (!token) {
			setError("This reset link is missing a token. Request a new one.");
			return;
		}
		setBusy(true);
		try {
			const client = authClient;
			if (!client.resetPassword) throw new Error("Reset is not available. Sign in and change your password in Settings.");
			const { error: err } = await client.resetPassword({
				newPassword: password,
				token
			});
			if (err) throw new Error(err.message || "Could not reset password");
			setDone(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Try again");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
		title: "Reset password",
		subtitle: "Choose a new password for this account.",
		children: done ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-ok",
			children: [
				"Password updated.",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					className: "text-primary",
					children: "Sign in"
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit,
			className: "space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PasswordField, {
					id: "pw",
					label: "New password",
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
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-danger",
					children: error
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "w-full",
					disabled: busy,
					children: busy ? "Saving…" : "Save password"
				})
			]
		})
	});
}
//#endregion
export { Reset as component };

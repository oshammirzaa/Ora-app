import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as AuthFrame } from "./auth-frame-BSmPV9ng.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/terms-TKHetuOO.js
var import_jsx_runtime = require_jsx_runtime();
function Terms() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
		title: "Terms of use",
		subtitle: "Ora is a live reading marketplace. Entertainment only.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3 text-sm text-muted",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "You must be 18 or older. Readings are not medical, legal, or financial advice." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "First login gifts three minutes. A $10 subscription adds three minutes each week. After included time, advisors charge coins at their rate. Ten coins equal one dollar." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "You own your account. Do not share passwords. The owner panel may pause advisors and gift coins." }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/signup",
						className: "text-primary",
						children: "Create account"
					}),
					" · ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						className: "text-primary",
						children: "Sign in"
					})
				] })
			]
		})
	});
}
//#endregion
export { Terms as component };

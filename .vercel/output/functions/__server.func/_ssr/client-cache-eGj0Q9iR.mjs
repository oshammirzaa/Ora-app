import { r as __exportAll } from "../_runtime.mjs";
import { s as __exportAll$1 } from "./ssr.mjs";
import { b as getPublicSettings, y as getMe } from "./ora-qKRq3G77.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/client-cache-eGj0Q9iR.js
var client_cache_eGj0Q9iR_exports = /* @__PURE__ */ __exportAll({
	i: () => rememberMe,
	n: () => cachedPublicSettings,
	r: () => client_cache_exports,
	t: () => cachedMe
});
var client_cache_exports = /* @__PURE__ */ __exportAll$1({
	cachedMe: () => cachedMe,
	cachedPublicSettings: () => cachedPublicSettings,
	forgetMe: () => forgetMe,
	rememberMe: () => rememberMe
});
var settingsAt = 0;
var settingsVal = null;
var meAt = 0;
var meVal = null;
function cachedPublicSettings() {
	if (settingsVal && Date.now() - settingsAt < 6e4) return Promise.resolve(settingsVal);
	return getPublicSettings().then((s) => {
		settingsVal = s;
		settingsAt = Date.now();
		return s;
	});
}
function cachedMe() {
	if (meVal && Date.now() - meAt < 4e3) return Promise.resolve(meVal);
	return getMe().then((m) => {
		meVal = m;
		meAt = Date.now();
		return m;
	});
}
function rememberMe(m) {
	meVal = m;
	meAt = Date.now();
}
function forgetMe() {
	meVal = null;
	meAt = 0;
}
//#endregion
export { rememberMe as i, cachedPublicSettings as n, client_cache_eGj0Q9iR_exports as r, cachedMe as t };

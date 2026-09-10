import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Button } from "./button-ChqN0Nnn.mjs";
import { _ as adminReorderCategory, b as adminSaveCategory, c as adminDeleteCategory, r as adminAllCategories } from "./ora-admin-Uuns6yB9.mjs";
import { t as Input } from "./input-8qbNfKEU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/categories-ot8uFoxT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CategoriesPage() {
	const [rows, setRows] = (0, import_react.useState)([]);
	const [name, setName] = (0, import_react.useState)("");
	const [editId, setEditId] = (0, import_react.useState)("");
	const [editName, setEditName] = (0, import_react.useState)("");
	async function load() {
		setRows(await adminAllCategories({ data: { t: Date.now() } }));
	}
	(0, import_react.useEffect)(() => {
		load().catch(() => setRows([]));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl",
			children: "Categories"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "These chips appear on the customer floor. Advisors match on specialties."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-4 flex gap-2",
			onSubmit: (e) => {
				e.preventDefault();
				adminSaveCategory({ data: { name } }).then((next) => {
					setRows(next);
					setName("");
					toast.success("Category added.");
				}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not add"));
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: name,
				onChange: (e) => setName(e.target.value),
				placeholder: "New category",
				required: true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				children: "Add"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-6 space-y-2",
			children: rows.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
				className: "rounded-xl bg-surface px-4 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2",
					children: [editId === c.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "flex min-w-0 flex-1 gap-2",
						onSubmit: (e) => {
							e.preventDefault();
							adminSaveCategory({ data: {
								id: c.id,
								name: editName,
								active: c.active
							} }).then((next) => {
								setRows(next);
								setEditId("");
								toast.success("Renamed.");
							}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not rename"));
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: editName,
							onChange: (e) => setEditName(e.target.value),
							required: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							type: "submit",
							children: "Save"
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [c.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-2 text-xs text-faint",
						children: c.active ? "on floor" : "hidden"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => void adminReorderCategory({ data: {
									id: c.id,
									dir: "up"
								} }).then(setRows).catch((e) => toast.error(e instanceof Error ? e.message : "Could not move")),
								children: "Up"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => void adminReorderCategory({ data: {
									id: c.id,
									dir: "down"
								} }).then(setRows).catch((e) => toast.error(e instanceof Error ? e.message : "Could not move")),
								children: "Down"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => {
									setEditId(editId === c.id ? "" : c.id);
									setEditName(c.name);
								},
								children: editId === c.id ? "Cancel" : "Rename"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => void adminSaveCategory({ data: {
									id: c.id,
									name: c.name,
									active: !c.active
								} }).then(setRows),
								children: c.active ? "Hide" : "Show"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => void adminDeleteCategory({ data: { id: c.id } }).then(setRows).catch((e) => toast.error(e instanceof Error ? e.message : "Could not remove")),
								children: "Remove"
							})
						]
					})]
				})
			}, c.id))
		})
	] });
}
//#endregion
export { CategoriesPage as component };

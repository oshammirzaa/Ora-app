//#region node_modules/.nitro/vite/services/ssr/assets/file-data-BpPDGUIe.js
function readImageFile(file) {
	return new Promise((resolve, reject) => {
		if (!file.type.startsWith("image/")) {
			reject(/* @__PURE__ */ new Error("Use a photo (jpg or png)."));
			return;
		}
		const img = new Image();
		const url = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(url);
			const scale = Math.min(1, 720 / Math.max(img.width, img.height));
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(img.width * scale);
			canvas.height = Math.round(img.height * scale);
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(/* @__PURE__ */ new Error("Could not read that file."));
				return;
			}
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			let quality = .82;
			let data = canvas.toDataURL("image/jpeg", quality);
			while (data.length > 38e4 && quality > .55) {
				quality -= .08;
				data = canvas.toDataURL("image/jpeg", quality);
			}
			if (data.length > 4e5) {
				reject(/* @__PURE__ */ new Error("Photo is still too large. Try a simpler image."));
				return;
			}
			resolve(data);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(/* @__PURE__ */ new Error("Could not read that file."));
		};
		img.src = url;
	});
}
//#endregion
export { readImageFile as t };

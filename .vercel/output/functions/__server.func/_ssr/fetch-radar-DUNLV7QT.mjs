import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { n as scoreInterest } from "./interest-BclT4m1-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fetch-radar-DUNLV7QT.js
var UA = "EmberHunt/1.0 (public RSS reader)";
var cache = null;
var TTL = 12e4;
async function pull(url) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 9e3);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: {
				"User-Agent": UA,
				Accept: "application/atom+xml, application/rss+xml, application/xml"
			}
		});
		if (!res.ok) return "";
		return await res.text();
	} catch {
		return "";
	} finally {
		clearTimeout(t);
	}
}
function decode(s) {
	return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, "\"").replace(/&#39;/g, "'").replace(/'/g, "'");
}
function strip(html) {
	return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function toHit(title, href, body, source, author, at) {
	if (!href || !title) return null;
	const scored = scoreInterest(`${title}. ${body}`);
	if (scored.band === "skip") return null;
	return {
		id: `${source}-${href}`.slice(0, 180),
		title: title.slice(0, 180),
		body: body.slice(0, 280),
		href,
		author: author.replace(/^\/u\//, ""),
		source,
		at,
		score: scored.score,
		band: scored.band,
		planId: scored.planId,
		reply: scored.reply,
		summary: scored.summary
	};
}
function atomEntries(xml, source) {
	const blocks = xml.match(/<entry[\s\S]*?<\/entry>/g) ?? [];
	const out = [];
	for (const block of blocks) {
		const title = strip(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
		if (/^amazon firetv$/i.test(title)) continue;
		const href = block.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? strip(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
		const author = strip(block.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? "");
		const at = strip(block.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] ?? "");
		const hit = toHit(title, href, strip(block.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? ""), source, author, at);
		if (hit) out.push(hit);
	}
	return out;
}
function rssItems(xml, source) {
	const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
	const out = [];
	for (const block of blocks) {
		const title = strip(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
		const href = strip(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? block.match(/href="([^"]+)"/)?.[1] ?? "");
		const at = strip(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "");
		const hit = toHit(title, href, strip(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? ""), source, "", at);
		if (hit) out.push(hit);
	}
	return out;
}
var FEEDS = [{
	url: "https://www.reddit.com/r/FireTV/.rss",
	source: "Reddit · FireTV"
}, {
	url: "https://news.google.com/rss/search?q=firestick+live+tv+OR+%22fire+tv+stick%22+sports+OR+cricket&hl=en-US&gl=US&ceid=US:en",
	source: "News"
}];
var loadRadar_createServerFn_handler = createServerRpc({
	id: "480c7d4d0691d89a7eaf1b5a1b7fc69e53d1584273c1ba367ca73994cbbd58a3",
	name: "loadRadar",
	filename: "src/lib/fetch-radar.ts"
}, (opts) => loadRadar.__executeServer(opts));
var loadRadar = createServerFn({ method: "GET" }).handler(loadRadar_createServerFn_handler, async () => {
	if (cache && Date.now() - cache.at < TTL) return {
		items: cache.items,
		fetchedAt: cache.at,
		note: cache.note,
		cached: true
	};
	const pages = [];
	for (const feed of FEEDS) pages.push({
		xml: await pull(feed.url),
		source: feed.source
	});
	const collected = [];
	for (const page of pages) if (page.xml.includes("<entry")) collected.push(...atomEntries(page.xml, page.source));
	else if (page.xml.includes("<item")) collected.push(...rssItems(page.xml, page.source));
	const seen = /* @__PURE__ */ new Set();
	const unique = collected.filter((it) => {
		const key = it.title.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	unique.sort((a, b) => b.score - a.score);
	const items = unique.slice(0, 24);
	const note = items.length ? "Public posts from Reddit and Google News. TikTok, Facebook, and Instagram still have to be opened by hand." : "Live feeds were quiet or blocked. Use the social hunts below — those open TikTok, Facebook, and Instagram.";
	cache = {
		at: Date.now(),
		items,
		note
	};
	return {
		items,
		fetchedAt: cache.at,
		note,
		cached: false
	};
});
//#endregion
export { loadRadar_createServerFn_handler };

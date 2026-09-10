//#region node_modules/.nitro/vite/services/ssr/assets/interest-BclT4m1-.js
var RULES = [
	{
		re: /\b(looking for|need|want|anyone know|recommend|suggest|konsa|chahiye|batao)\b/,
		pts: 22,
		label: "Asking",
		why: "They are shopping, not scrolling."
	},
	{
		re: /\b(fire\s?stick|fire\s?tv|android (tv|box)|smart tv)\b/,
		pts: 28,
		label: "Hardware",
		why: "They already have or want the stick."
	},
	{
		re: /\b(live tv|live cricket|live football|subscription|streaming|cord cut|cable)\b/,
		pts: 16,
		label: "Live TV",
		why: "They want TV, not a one-off video."
	},
	{
		re: /\b(cricket|football|match|sports?)\b/,
		pts: 12,
		label: "Sports",
		why: "Sports+ is the easy close.",
		plan: "sports"
	},
	{
		re: /\b(family|kids?|bach)\b/,
		pts: 10,
		label: "Family",
		why: "Family plan language.",
		plan: "family"
	},
	{
		re: /\b(this weekend|tonight|today|abhi|now|urgent)\b/,
		pts: 12,
		label: "Timing",
		why: "They want it soon."
	},
	{
		re: /\b(too expensive|cable bill|price|kitna|rate|affordable|sasta)\b/,
		pts: 10,
		label: "Budget",
		why: "Price is on the table."
	},
	{
		re: /\b(not using|sitting in|drawer|waste)\b/,
		pts: 8,
		label: "Idle stick",
		why: "The hardware is already at home."
	}
];
var COLD = [{
	re: /\b(already have|using netflix|not interested|no thanks|stop)\b/,
	label: "Not buying",
	why: "They declined or already set."
}];
var SKIP = [{
	re: /\b(fully loaded|pirate|cracked|free premium|iptv panel|temp root|jailbreak|downgrade|illegal streams?|iptv)\b/,
	label: "Skip",
	why: "Pirate / loaded-stick talk. Ember does not sell that."
}];
var SAMPLES = [
	{
		id: "hot",
		label: "Hot — cricket this weekend",
		text: "Anyone know a good firestick for live cricket this weekend? Cable bill is too expensive."
	},
	{
		id: "warm",
		label: "Warm — idle stick",
		text: "Got a Fire TV stick last year and it just sits in the drawer. What do people actually use it for?"
	},
	{
		id: "cold",
		label: "Cold — already sorted",
		text: "Netflix is enough for me thanks, not looking for anything else."
	}
];
function scoreInterest(raw) {
	const q = raw.toLowerCase();
	const hits = [];
	let score = 0;
	let planId = "family";
	for (const s of SKIP) if (s.re.test(q)) return {
		score: 0,
		band: "skip",
		hits: [{
			label: s.label,
			why: s.why
		}],
		planId: "starter",
		summary: "Do not pitch Ember here. That post is about unofficial streams.",
		reply: "I only set up licensed live TV on Fire Stick — not loaded boxes. If you want a legal login, I can help; otherwise I’ll leave you to it."
	};
	for (const r of RULES) if (r.re.test(q)) {
		score += r.pts;
		hits.push({
			label: r.label,
			why: r.why
		});
		if (r.plan) planId = r.plan;
	}
	let coldHit;
	for (const c of COLD) if (c.re.test(q)) coldHit = {
		label: c.label,
		why: c.why
	};
	score = Math.min(100, score);
	if (coldHit) score = Math.min(score, 28);
	let band = "cold";
	if (score >= 50) band = "hot";
	else if (score >= 24) band = "warm";
	if (coldHit && band !== "hot") {
		band = "cold";
		hits.push(coldHit);
	}
	return {
		score,
		band,
		hits,
		planId,
		summary: band === "hot" ? "Warm buyer language. Reply once, useful, no pressure." : band === "warm" ? "Curious, not yet asking to buy. Offer a short setup note." : "Low intent. Do not chase.",
		reply: band === "hot" ? planId === "sports" ? "If you want live cricket on the big screen this weekend, Ember Sports+ is on Fire TV Stick the same day — licensed, not a loaded box. Happy to send what’s included if useful." : "If you want live TV on the Fire Stick you already own, Ember is a licensed login we activate the same day. I can send the Family plan (3 screens) if that’s what you need." : band === "warm" ? "Fire Stick is wasted as a dust collector. Ember is live TV + movies on that stick in about ten minutes. Say if you want the short setup." : "All good — I won’t keep writing. If you ever want live TV on a Fire Stick, Ember is there."
	};
}
//#endregion
export { scoreInterest as n, SAMPLES as t };

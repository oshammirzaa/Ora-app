export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "News, entertainment, and a clean Fire TV app.",
    usdMonth: 12.99,
    pkrMonth: 3499,
    usdYear: 119,
    pkrYear: 32999,
    devices: 1,
    features: [
      "Live news & entertainment",
      "On-demand movies & series",
      "1 screen at a time",
      "Works on Fire TV Stick",
      "Email setup in under 10 minutes",
    ],
  },
  {
    id: "family",
    name: "Family",
    tagline: "The one most households keep.",
    usdMonth: 22.99,
    pkrMonth: 5999,
    usdYear: 199,
    pkrYear: 54999,
    devices: 3,
    popular: true,
    features: [
      "Everything in Starter",
      "Kids profiles & parental pin",
      "3 screens at once",
      "HD on Fire TV, phones, tablets",
      "Priority WhatsApp support",
    ],
  },
  {
    id: "sports",
    name: "Sports+",
    tagline: "Match days without hunting for a stream.",
    usdMonth: 34.99,
    pkrMonth: 8999,
    usdYear: 299,
    pkrYear: 79999,
    devices: 4,
    features: [
      "Everything in Family",
      "Live football, cricket, and more",
      "4 screens, including a spare for guests",
      "Match-day alerts",
      "Same-day activation",
    ],
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export const CATEGORIES = [
  { id: "live", title: "Live TV", copy: "News, entertainment, and regional channels in one grid." },
  { id: "sports", title: "Sports", copy: "Football, cricket, and highlights without channel-hopping." },
  { id: "movies", title: "Movies & series", copy: "A nightly watchlist, not a pile of apps." },
  { id: "kids", title: "Kids", copy: "A locked kids profile so the remote stays in one place." },
] as const;

export const DEVICES = [
  { id: "fire", title: "Fire TV Stick", copy: "The fastest path. We send the app + login; you plug in and watch." },
  { id: "android", title: "Android TV", copy: "Sony, TCL, Xiaomi, and most Android boxes." },
  { id: "phone", title: "Phone & tablet", copy: "Watch away from the sofa. Same account." },
  { id: "smart", title: "Smart TV apps", copy: "Where the maker allows sideload or a store listing." },
] as const;

export const STEPS = [
  { n: "01", title: "Pick a plan", copy: "Starter, Family, or Sports+. Monthly or a year up front." },
  { n: "02", title: "Send a request", copy: "Form, WhatsApp, or a message from the Sales Desk." },
  { n: "03", title: "We activate", copy: "Login lands the same day. Stick setup is four screens long." },
  { n: "04", title: "Watch", copy: "Live TV, sports, and on-demand on the screens you already own." },
] as const;

export type Platform =
  | "tiktok"
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "website"
  | "bot"
  | "reddit"
  | "other";
export type LeadStatus = "new" | "contacted" | "interested" | "sold" | "lost";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "website", label: "Website" },
  { id: "bot", label: "Ember bot" },
  { id: "reddit", label: "Reddit" },
  { id: "other", label: "Other" },
];

export const STATUSES: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "sold", label: "Sold" },
  { id: "lost", label: "Lost" },
];

export const SEARCHES = [
  {
    id: "cordcut",
    label: "Cord cutters",
    query: "switching from cable to firestick streaming",
    why: "People already shopping for a living-room app.",
  },
  {
    id: "setup",
    label: "Setup help",
    query: "how to set up fire tv stick for live tv",
    why: "They have the hardware. They need a service.",
  },
  {
    id: "sports",
    label: "Sports fans",
    query: "watch live football cricket on firestick",
    why: "Match-day demand is the easiest close.",
  },
  {
    id: "family",
    label: "Family TV",
    query: "best family streaming on fire tv stick",
    why: "Parents looking for one app instead of five.",
  },
  {
    id: "deal",
    label: "Stick owners",
    query: "fire tv stick not using it much",
    why: "Hardware sitting in a drawer is a warm lead.",
  },
  {
    id: "live",
    label: "Live TV ask",
    query: "looking for live tv subscription smart tv",
    why: "Direct intent. Be useful, not spammy.",
  },
] as const;

export type SearchNet =
  | "tiktok"
  | "facebook"
  | "instagram"
  | "google"
  | "x"
  | "reddit"
  | "youtube"
  | "quora"
  | "indeed"
  | "linkedin";

export function searchUrl(network: SearchNet, query: string) {
  const q = encodeURIComponent(query);
  if (network === "tiktok") return `https://www.tiktok.com/search?q=${q}`;
  if (network === "facebook") return `https://www.facebook.com/search/posts?q=${q}`;
  if (network === "instagram") return `https://www.instagram.com/explore/search/keyword/?q=${q}`;
  if (network === "x") return `https://x.com/search?q=${q}&f=live`;
  if (network === "reddit") return `https://www.reddit.com/search/?q=${q}&sort=new`;
  if (network === "youtube") return `https://www.youtube.com/results?search_query=${q}`;
  if (network === "quora") return `https://www.quora.com/search?q=${q}`;
  if (network === "indeed") return `https://www.indeed.com/jobs?q=${q}`;
  if (network === "linkedin") return `https://www.linkedin.com/jobs/search/?keywords=${q}`;
  return `https://www.google.com/search?q=${q}&tbs=qdr:m`;
}

export const TEMPLATES = [
  {
    id: "intro",
    title: "First hello",
    body: "Hi {name} — saw you were looking at Fire TV / live TV options. I run Ember: licensed live TV + movies on the stick you already own. Happy to walk you through a 10-minute setup if useful. No pressure.",
  },
  {
    id: "sports",
    title: "Match day",
    body: "Hi {name} — if you want live football / cricket on the big screen this weekend, Ember Sports+ is on Fire TV Stick the same day. I can send the app + login after a quick chat. Which match are you after?",
  },
  {
    id: "family",
    title: "Family plan",
    body: "Hi {name} — Ember Family is three screens, a kids profile, and one bill. If you already have a Fire Stick I can activate it today. Want me to send the price and what’s included?",
  },
  {
    id: "follow",
    title: "Polite follow-up",
    body: "Hi {name} — just checking you got my note about Ember on Fire TV. If the timing is off, no worries — reply STOP and I won’t write again.",
  },
] as const;

export const COMPLIANCE =
  "Ember is a storefront for a licensed live-TV and on-demand service. Do not sell pirate IPTV, “fully loaded” sticks, or unofficial streams of pay-TV networks. Do not scrape TikTok, Facebook, or Instagram. Open their public search, talk to people who already asked, and add them here by hand.";

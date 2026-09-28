import { MEMBERSHIP_PLANS, type MembershipPlan } from "./ora-membership-plan.ts";

export const MARKETING_TITLE = "Ora Psychic | Private live readings";
export const MARKETING_DESCRIPTION =
  "See live Ora advisors, their published rates and reviews, and start with 3 free minutes. Readings stay private in your Ora account.";

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/home",
  "/advisors",
  "/membership",
  "/privacy",
  "/terms",
  "/support",
  "/login",
  "/signup",
  "/apply",
  "/psychics",
  "/about",
] as const;

export const ROBOTS_DISALLOW = [
  "/admin",
  "/advisor",
  "/api",
  "/messages",
  "/me",
  "/account",
  "/reading",
  "/wait",
  "/studio",
] as const;

export type MarketingAdvisor = {
  id: string;
  name: string;
  specialties: string;
  rateCoins: number;
  photoUrl: string;
  rating: number;
  reviews: number;
  online: boolean;
  busy: boolean;
  house: boolean;
};

export type MarketingReview = {
  id: string;
  rating: number;
  body: string;
  at: string;
  name: string;
  advisorName: string;
  advisorId: string;
};

export type MarketingPageData = {
  siteName: string;
  supportEmail: string;
  origin: string;
  advisorCount: number;
  advisors: MarketingAdvisor[];
  reviews: MarketingReview[];
};

export type MarketingFaq = { q: string; a: string };

export function emptyMarketingPage(): MarketingPageData {
  return {
    siteName: "Ora",
    supportEmail: "",
    origin: "",
    advisorCount: 0,
    advisors: [],
    reviews: [],
  };
}

export function monthlyPriceLabel(cents: number) {
  const dollars = (Number(cents) || 0) / 100;
  if (!Number.isFinite(dollars) || dollars < 0) return "";
  if (Number.isInteger(dollars)) return `$${dollars}/month`;
  return `$${dollars.toFixed(2)}/month`;
}

export function planMinutesLabel(plan: MembershipPlan) {
  const minutes = Math.max(0, Math.round((Number(plan.seconds) || 0) / 60));
  const unit = minutes === 1 ? "minute" : "minutes";
  return `${minutes} free ${unit} ${plan.refreshLabel}`;
}

export function marketingFaqs(): MarketingFaq[] {
  const mini = MEMBERSHIP_PLANS.mini;
  const full = MEMBERSHIP_PLANS.membership;
  return [
    {
      q: "Who can create an Ora account?",
      a: "Ora is for adults 18 and older. Create an account, then sign in to keep your readings, minutes, and coins on that account.",
    },
    {
      q: "What happens in a reading?",
      a: "You choose an advisor and start a private live chat when they are available. A reading is a conversation for reflection. Ora does not promise a specific outcome.",
    },
    {
      q: "How do coins work?",
      a: "Ten coins equal one dollar. After included minutes, a reading uses coins at the per-minute rate published on that advisor's profile.",
    },
    {
      q: "What is included with Ora Mini?",
      a: `${mini.name} is ${monthlyPriceLabel(mini.amountCents)}. It includes ${planMinutesLabel(mini)} and ${mini.coins} coins monthly. Purchase it with your Ora account.`,
    },
    {
      q: "What is included with Ora Membership?",
      a: `${full.name} is ${monthlyPriceLabel(full.amountCents)}. It includes ${planMinutesLabel(full)} and ${full.coins} coins monthly. Purchase it with your Ora account.`,
    },
    {
      q: "Are the advisors on this page real profiles?",
      a: "Yes. Names, photos, specialties, rates, ratings, and online status come from advisor profiles that are live on Ora. This page does not add sample advisors or invented statistics.",
    },
    {
      q: "How do payments work?",
      a: "Membership purchases use Ora's existing checkout. You can review or manage a plan from the membership page in your account. Ora does not ask you to pay an advisor outside Ora.",
    },
    {
      q: "What can other people see?",
      a: "The public site shows live advisor profiles and reviews that are already eligible to be shown. It does not publish customer emails, private messages, or another person's account details.",
    },
    {
      q: "How do I get help?",
      a: "Sign in and open Support to message Ora staff. You can also use the contact address in the footer when one is published for this site.",
    },
  ];
}

export function publicReviewerName(name: string) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (!clean || /@/.test(clean) || /^client$/i.test(clean)) return "Client";
  const first = clean.split(" ")[0] || "Client";
  if (!first || /@/.test(first) || first.length < 2) return "Client";
  return first.slice(0, 40);
}

export function safePublicPhoto(url: unknown) {
  const value = String(url || "").trim();
  if (!value || value.startsWith("//")) return "";
  // Same stored advisor photos the app already shows, including uploaded data URLs.
  if (value.startsWith("data:image/") && !/^data:image\/svg/i.test(value)) {
    return value.length > 400_000 ? "" : value;
  }
  if (value.startsWith("data:")) return "";
  if (value.startsWith("/")) return value.slice(0, 2_000);
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return parsed.toString().slice(0, 2_000);
  } catch {
    return "";
  }
  return "";
}

export function safeSupportEmail(email: unknown) {
  const value = String(email || "").trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "";
  return value;
}

export function safeOrigin(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (!url.host || url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function marketingHead(origin = "") {
  const site = "https://orapsychic.com";
  const canonical = `${site}/`;
  const image = `${site}/images/ora-logo.png`;
  void origin;
  return {
    meta: [
      { title: MARKETING_TITLE },
      { name: "description", content: MARKETING_DESCRIPTION },
      { property: "og:title", content: MARKETING_TITLE },
      { property: "og:description", content: MARKETING_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ora Psychic" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: MARKETING_TITLE },
      { name: "twitter:description", content: MARKETING_DESCRIPTION },
      { name: "twitter:image", content: image },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  };
}

export function robotsTxt(origin: string) {
  const base = safeOrigin(origin);
  const lines = ["User-agent: *", "Allow: /", ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`)];
  lines.push(`Sitemap: ${base ? `${base}/sitemap.xml` : "/sitemap.xml"}`);
  return `${lines.join("\n")}\n`;
}

export function sitemapXml(origin: string) {
  const base = safeOrigin(origin);
  const urls = PUBLIC_SITEMAP_PATHS.map((path) => {
    const loc = `${base}${path}`;
    return `  <url><loc>${loc}</loc></url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}


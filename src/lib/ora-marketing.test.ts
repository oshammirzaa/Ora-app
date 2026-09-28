import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MEMBERSHIP_PLANS } from "./ora-membership-plan.ts";
import {
  MARKETING_DESCRIPTION,
  marketingFaqs,
  marketingHead,
  monthlyPriceLabel,
  planMinutesLabel,
  publicReviewerName,
  robotsTxt,
  safeOrigin,
  safePublicPhoto,
  safeSupportEmail,
  sitemapXml,
} from "./ora-marketing-copy.ts";
import { appHref, isAppHost, isMarketingHost, rootHomeExperience, toPublicPsychic } from "./ora-domains.ts";
import type { Advisor } from "./ora.ts";

describe("public marketing copy", () => {
  it("prices and minutes match the live membership plans", () => {
    assert.equal(monthlyPriceLabel(MEMBERSHIP_PLANS.mini.amountCents), "$10/month");
    assert.equal(monthlyPriceLabel(MEMBERSHIP_PLANS.membership.amountCents), "$25/month");
    assert.equal(planMinutesLabel(MEMBERSHIP_PLANS.mini), "3 free minutes every 7 days");
    assert.equal(planMinutesLabel(MEMBERSHIP_PLANS.membership), "3 free minutes every 48 hours");
    const text = marketingFaqs().map((item) => item.a).join(" ");
    assert.match(text, /\$10\/month/);
    assert.match(text, /20 coins monthly/);
    assert.match(text, /\$25\/month/);
    assert.match(text, /50 coins monthly/);
    assert.match(text, /3 free minutes every 7 days/);
    assert.match(text, /3 free minutes every 48 hours/);
    assert.doesNotMatch(text, /guarantee|guaranteed|100%/i);
    assert.doesNotMatch(MARKETING_DESCRIPTION, /guarantee/i);
  });

  it("does not invent reviewer names or unsafe media", () => {
    assert.equal(publicReviewerName("Amara Cole"), "Amara");
    assert.equal(publicReviewerName("secret@example.com"), "Client");
    assert.equal(publicReviewerName(""), "Client");
    assert.equal(safePublicPhoto("javascript:alert(1)"), "");
    assert.equal(safePublicPhoto("http://example.com/a.jpg"), "");
    assert.equal(safePublicPhoto("/images/mira.jpg"), "/images/mira.jpg");
    assert.equal(safePublicPhoto("data:image/jpeg;base64,/9j/abc"), "data:image/jpeg;base64,/9j/abc");
    assert.equal(safePublicPhoto("data:image/png;base64,aaaa"), "data:image/png;base64,aaaa");
    assert.equal(safePublicPhoto("data:text/html;base64,abc"), "");
    assert.equal(safePublicPhoto("data:image/svg+xml;base64,abc"), "");
    const uploaded = `data:image/jpeg;base64,${"a".repeat(500)}`;
    assert.equal(safePublicPhoto(uploaded), uploaded);
    assert.equal(safeSupportEmail("not-an-email"), "");
    assert.equal(safeSupportEmail("help@ora.example"), "help@ora.example");
    assert.equal(safeOrigin("https://user:pass@ora.example/path"), "");
    assert.equal(safeOrigin("https://ora.example/welcome"), "https://ora.example");
  });

  it("keeps private app areas out of the public crawl", () => {
    const robots = robotsTxt("https://ora.example/robots.txt");
    assert.match(robots, /Disallow: \/admin/);
    assert.match(robots, /Disallow: \/advisor/);
    assert.match(robots, /Disallow: \/api/);
    assert.match(robots, /Disallow: \/messages/);
    assert.match(robots, /Sitemap: https:\/\/ora\.example\/sitemap\.xml/);
    const xml = sitemapXml("https://ora.example/sitemap.xml");
    assert.match(xml, /https:\/\/ora\.example\/privacy/);
    assert.match(xml, /https:\/\/ora\.example\/home/);
    assert.doesNotMatch(xml, /\/admin/);
    assert.doesNotMatch(xml, /DATABASE_URL|X-Forwarded-For/);
    const privacy = readFileSync(new URL("../routes/privacy.tsx", import.meta.url), "utf8");
    assert.match(privacy, /createFileRoute\("\/privacy"\)/);
    assert.doesNotMatch(privacy, /RedirectToSignIn|authMiddleware/);
    assert.match(privacy, /does not provide medical, legal, or financial advice/);
    assert.match(privacy, /Stripe/);
    assert.match(privacy, /xAI/);
    assert.match(privacy, /ask Ora to delete your account/);
    assert.match(privacy, /18 or older/);
    assert.match(privacy, /PublicFrame/);
    assert.doesNotMatch(privacy, /Resend|SendGrid|Postmark|Firebase|Google Analytics/);
  });

  it("keeps orapsychic.com on the website and orapsychic.xyz on the app", () => {
    assert.equal(isMarketingHost("orapsychic.com"), true);
    assert.equal(isMarketingHost("www.orapsychic.com"), true);
    assert.equal(isMarketingHost("orapsychic.xyz"), false);
    assert.equal(isAppHost("orapsychic.xyz"), true);
    assert.equal(isAppHost("www.orapsychic.xyz"), true);
    assert.equal(isAppHost("orapsychic.com"), false);
    assert.equal(isMarketingHost("localhost"), false);
    assert.equal(rootHomeExperience("orapsychic.com"), "website");
    assert.equal(rootHomeExperience("www.orapsychic.com"), "website");
    assert.equal(rootHomeExperience("orapsychic.xyz"), "app");
    assert.equal(rootHomeExperience("www.orapsychic.xyz"), "app");
    assert.equal(rootHomeExperience("localhost"), "app");
    const index = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
    assert.match(index, /experience === "website"/);
    assert.match(index, /<MarketingSite/);
    assert.match(index, /<CustomerHomeBody/);
    assert.match(index, /rootHomeExperience/);
    assert.doesNotMatch(index, /orapsychic\.xyz/);
    assert.equal(appHref("/login", true), "/login");
    assert.equal(appHref("/signup", true), "/signup");
    assert.equal(appHref("/home", true), "/home");
    assert.equal(appHref("/advisor/login", true), "/advisor/login");
    assert.equal(appHref("/advisor", true), "/advisor");
    assert.equal(appHref("/login", false), "/login");
    assert.equal(appHref("https://orapsychic.xyz/home", true), "/");
    assert.equal(appHref("https://evil.example", true), "/");
    const head = marketingHead("https://preview.example");
    const meta = JSON.stringify(head);
    assert.match(meta, /https:\/\/orapsychic\.com\//);
    assert.match(meta, /og:image/);
    assert.doesNotMatch(meta, /orapsychic\.xyz/);
    const home = readFileSync(new URL("../components/customer-home.tsx", import.meta.url), "utf8");
    assert.match(home, /Trusted Psychics/);
    assert.match(home, /HomeHero/);
    const route = readFileSync(new URL("../routes/home.tsx", import.meta.url), "utf8");
    assert.match(route, /createFileRoute\("\/home"\)/);
    const site = readFileSync(new URL("../components/marketing-site.tsx", import.meta.url), "utf8");
    const banner = readFileSync(new URL("../components/public-banner.tsx", import.meta.url), "utf8");
    assert.match(banner, /3 Minutes/);
    assert.match(site, /Trusted Psychics/);
    assert.match(site, /Recommended Psychics/);
    assert.match(site, /New Psychics/);
    const frame = readFileSync(new URL("../components/public-frame.tsx", import.meta.url), "utf8");
    assert.match(frame, /Sign In/);
    assert.match(frame, /Sign Up/);
    assert.match(frame, /Become an Advisor/);
    assert.match(frame, /Advisor Login/);
    assert.match(frame, /Customer Login/);
    assert.doesNotMatch(frame, /window\.location|redirect\(/);
    assert.doesNotMatch(site, /legalName|payoutCoins|ip-security/);
    const profile = readFileSync(new URL("../routes/psychics/$id.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(profile, /legalName|payoutCoins|userId/);
    const stripped = toPublicPsychic({
      id: "a1",
      userId: "user-secret",
      name: "Mira",
      slug: "mira",
      bio: "Reads",
      experience: "",
      specialties: "Love",
      rateCoins: 22,
      photoUrl: "data:image/jpeg;base64,/9j/mira",
      videoUrl: "",
      status: "live",
      trusted: true,
      isNew: false,
      rating: 4.9,
      reviews: 10,
      legalName: "Secret Name",
      languages: "English",
      years: 4,
      online: true,
      busy: false,
      payoutCoins: 99,
      pendingCoins: 4,
      monthlyRank: 1,
      manualRank: null,
    } satisfies Advisor);
    assert.equal(stripped.name, "Mira");
    assert.equal(stripped.photoUrl, "data:image/jpeg;base64,/9j/mira");
    assert.equal("legalName" in stripped, false);
    assert.equal("payoutCoins" in stripped, false);
    assert.equal("userId" in stripped, false);
  });
});

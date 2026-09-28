import type { Advisor } from "./ora.ts";
import { safePublicPhoto } from "./ora-marketing-copy.ts";

export const ORA_SITE_ORIGIN = "https://orapsychic.com";
export const ORA_APP_ORIGIN = "https://orapsychic.xyz";

/** Public psychic fields. Private account, payout, and legal-name fields stay off the website. */
export type PublicPsychic = {
  id: string;
  name: string;
  slug: string;
  bio: string;
  experience: string;
  specialties: string;
  rateCoins: number;
  photoUrl: string;
  videoUrl: string;
  status: string;
  trusted: boolean;
  isNew: boolean;
  rating: number;
  reviews: number;
  languages: string;
  years: number;
  online: boolean;
  busy: boolean;
  monthlyRank: number | null;
  manualRank: number | null;
  createdAt: string;
};

export function isMarketingHost(hostname: string) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return host === "orapsychic.com" || host === "www.orapsychic.com";
}

export function hostFromHeaders(headers: { get(name: string): string | null }) {
  const host = String(headers.get("host") || "").split(",")[0]?.trim() || "";
  const forwarded = String(headers.get("x-forwarded-host") || "").split(",")[0]?.trim() || "";
  if (/orapsychic\.(com|xyz)$/i.test(host.replace(/:\d+$/, ""))) return host;
  return forwarded || host;
}

export function isAppHost(hostname: string) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return host === "orapsychic.xyz" || host === "www.orapsychic.xyz";
}

/** A path opened on orapsychic.com stays on orapsychic.com. The app host is unchanged. */
export function appHref(path: string, _marketingHost: boolean) {
  const raw = String(path || "").trim();
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export function toPublicPsychic(advisor: Advisor): PublicPsychic {
  const video = String(advisor.videoUrl || "");
  const publicVideo = video.startsWith("/") || video.startsWith("https://") ? video.slice(0, 400) : "";
  return {
    id: advisor.id,
    name: advisor.name,
    slug: advisor.slug || advisor.id,
    bio: advisor.bio,
    experience: advisor.experience,
    specialties: advisor.specialties,
    rateCoins: advisor.rateCoins,
    photoUrl: safePublicPhoto(advisor.photoUrl),
    videoUrl: publicVideo,
    status: advisor.status,
    trusted: Boolean(advisor.trusted),
    isNew: Boolean(advisor.isNew),
    rating: advisor.rating,
    reviews: advisor.reviews,
    languages: advisor.languages,
    years: advisor.years,
    online: Boolean(advisor.online),
    busy: Boolean(advisor.busy),
    monthlyRank: advisor.monthlyRank,
    manualRank: advisor.manualRank,
    createdAt: advisor.createdAt || "",
  };
}

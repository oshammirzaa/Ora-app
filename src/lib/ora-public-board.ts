import { matchesAdvisorCategory } from "@/components/category-pills";
import { newPsychics } from "./ora-new.ts";
import { recommendByReviews } from "./ora-recommend.ts";
import { selectTrustedPsychics } from "./ora-rank.ts";
import type { PublicPsychic } from "./ora-domains.ts";

export type PublicBoard = "trusted" | "recommended" | "new";

function previewFloor(advisors: PublicPsychic[], limit: number, skip = new Set<string>()) {
  return [...advisors]
    .filter((a) => !skip.has(a.id))
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (Number(a.trusted) !== Number(b.trusted)) return a.trusted ? -1 : 1;
      if (b.reviews !== a.reviews) return b.reviews - a.reviews;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .slice(0, limit);
}

export function filterPublicPsychics(advisors: PublicPsychic[], filter: string) {
  const rows = Array.isArray(advisors) ? advisors : [];
  if (!filter || filter === "All") return rows;
  return rows.filter((advisor) => matchesAdvisorCategory(advisor.specialties, filter));
}

export function trustedPublicPsychics(advisors: PublicPsychic[], previewLayout: boolean) {
  const selected = selectTrustedPsychics(advisors);
  if (selected.length) return selected;
  if (!previewLayout) return [];
  return previewFloor(advisors, 10);
}

export function recommendedPublicPsychics(advisors: PublicPsychic[], previewLayout: boolean, limit = 40) {
  const scored = recommendByReviews(advisors, limit);
  if (scored.length) return scored;
  if (!previewLayout) return [];
  return previewFloor(advisors, limit);
}

export function newPublicPsychics(advisors: PublicPsychic[]) {
  return newPsychics(advisors);
}

export function publicDirectory(advisors: PublicPsychic[], board: PublicBoard | undefined, previewLayout: boolean) {
  if (board === "trusted") return trustedPublicPsychics(advisors, previewLayout);
  if (board === "recommended") return recommendedPublicPsychics(advisors, previewLayout, 80);
  if (board === "new") return newPublicPsychics(advisors);
  return [...advisors].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    if (b.reviews !== a.reviews) return b.reviews - a.reviews;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

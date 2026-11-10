import { newPsychics } from "./ora-new.ts";
import { sortByAvailability } from "./ora-presence.ts";
import { recommendByReviews } from "./ora-recommend.ts";
import { advisorMatchesPublicCategory, assignedCategoryDecision } from "./ora-reading-listings.ts";
import { selectTrustedPsychics } from "./ora-rank.ts";
import { publicCategoryById } from "./ora-public-categories.ts";
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
  const category = publicCategoryById(filter);
  return rows.filter((advisor) => {
    if (category) return advisorMatchesPublicCategory(advisor, category);
    const assigned = assignedCategoryDecision(advisor.listingCategories, filter);
    if (assigned !== null) return assigned;
    return String(advisor.specialties || "").toLowerCase().includes(filter.toLowerCase());
  });
}

export function trustedPublicPsychics(advisors: PublicPsychic[], previewLayout: boolean) {
  const selected = selectTrustedPsychics(advisors);
  const rows = selected.length ? selected : previewLayout ? previewFloor(advisors, 10) : [];
  return sortByAvailability(rows);
}

export function recommendedPublicPsychics(advisors: PublicPsychic[], previewLayout: boolean, limit = 40) {
  const scored = recommendByReviews(advisors, limit);
  const rows = scored.length ? scored : previewLayout ? previewFloor(advisors, limit) : [];
  return sortByAvailability(rows);
}

export function newPublicPsychics(advisors: PublicPsychic[]) {
  return sortByAvailability(newPsychics(advisors));
}

export function publicDirectory(advisors: PublicPsychic[], board: PublicBoard | undefined, previewLayout: boolean) {
  if (board === "trusted") return trustedPublicPsychics(advisors, previewLayout);
  if (board === "recommended") return recommendedPublicPsychics(advisors, previewLayout, 80);
  if (board === "new") return newPublicPsychics(advisors);
  return sortByAvailability(
    [...advisors].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (b.reviews !== a.reviews) return b.reviews - a.reviews;
      return String(a.name || "").localeCompare(String(b.name || ""));
    }),
  );
}

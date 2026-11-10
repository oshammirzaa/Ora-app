import { advisorMatchesCategory, type PublicCategory } from "./ora-public-categories.ts";

export const READING_LISTINGS = [
  { id: "soulmate", label: "Soulmate" },
  { id: "love", label: "Love & Relationships" },
  { id: "career", label: "Career" },
  { id: "tarot", label: "Tarot Card Readings" },
] as const;

export type ReadingListingId = (typeof READING_LISTINGS)[number]["id"];

const IDS = new Set<string>(READING_LISTINGS.map((item) => item.id));
const ORDER = READING_LISTINGS.map((item) => item.id);

export function isReadingListingId(value: string): value is ReadingListingId {
  return IDS.has(value);
}

function rawTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
  return String(value ?? "")
    .split(/[,\n|/]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/** Valid stored listings, in the public category order. Unknown ids are dropped. */
export function parseReadingListings(value: unknown): ReadingListingId[] {
  const seen = new Set<ReadingListingId>();
  for (const token of rawTokens(value)) {
    if (isReadingListingId(token)) seen.add(token);
  }
  return ORDER.filter((id) => seen.has(id));
}

export function serializeReadingListings(value: unknown): string {
  return parseReadingListings(value).join(",");
}

export function readingListingLabels(value: unknown): string[] {
  const labels = new Map(READING_LISTINGS.map((item) => [item.id, item.label]));
  return parseReadingListings(value).map((id) => labels.get(id) || id);
}

export function requireReadingListings(value: unknown): ReadingListingId[] {
  const tokens = rawTokens(value);
  const ids = parseReadingListings(value);
  if (tokens.length !== ids.length || ids.length !== 2) {
    throw new Error("Choose exactly two reading listings.");
  }
  return ids;
}

/** Empty keeps the legacy specialty match. Any other count is rejected. */
export function readingListingsForAdmin(value: unknown): ReadingListingId[] | undefined {
  if (value === undefined || value === null) return undefined;
  const tokens = rawTokens(value);
  const ids = parseReadingListings(value);
  if (tokens.length !== ids.length) throw new Error("Choose reading listings from Soulmate, Love & Relationships, Career, or Tarot Card Readings.");
  if (ids.length !== 0 && ids.length !== 2) {
    throw new Error("Choose exactly two reading listings, or leave both empty until they are reviewed.");
  }
  return ids;
}

/**
 * null: this advisor has no assigned listings, so the caller keeps specialty matching.
 * true/false: assigned advisors appear only in the two selected category ids.
 */
export function assignedCategoryDecision(listings: unknown, categoryOrLabel: string): boolean | null {
  const ids = parseReadingListings(listings);
  if (!ids.length) return null;
  const id = readingListingIdFromText(categoryOrLabel);
  if (!id) return false;
  return ids.includes(id);
}

export function readingListingIdFromText(value: string): ReadingListingId | null {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "all") return null;
  if (text === "soulmate" || text.includes("soulmate")) return "soulmate";
  if (text === "tarot" || text.includes("tarot")) return "tarot";
  if (text === "career" || text.includes("career") || text.includes("work")) return "career";
  if (text === "love" || text.includes("love") || text.includes("relationship")) return "love";
  return null;
}

export function advisorMatchesPublicCategory(
  advisor: { specialties?: string; listingCategories?: unknown },
  category: PublicCategory,
): boolean {
  if (category.board === "new" || !category.pattern) return false;
  const assigned = assignedCategoryDecision(advisor.listingCategories, category.id);
  if (assigned !== null) return assigned;
  return advisorMatchesCategory(String(advisor.specialties || ""), category);
}

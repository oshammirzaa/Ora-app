import { publicCategoryById } from "./ora-public-categories.ts";
import type { PublicPsychic } from "./ora-domains.ts";
import { newPsychics } from "./ora-new.ts";
import { presenceState, sortByAvailability, type PresenceState } from "./ora-presence.ts";
import { recommendByReviews } from "./ora-recommend.ts";
import { advisorMatchesPublicCategory, assignedCategoryDecision } from "./ora-reading-listings.ts";
import { selectTrustedPsychics } from "./ora-rank.ts";

export type PublicBoard = "trusted" | "recommended" | "new";
export type DirectorySort = "recommended" | "top-rated" | "experienced" | "new";
export type DirectoryAvailability = "online" | "busy" | "offline";

/** Live chat is the only customer connection mode on Ora. */
export type DirectoryConnect = "chat";

export type PsychicSearch = {
  board?: PublicBoard;
  category?: string;
  q?: string;
  availability?: DirectoryAvailability;
  connect?: DirectoryConnect;
  sort?: DirectorySort;
};

const TEXT_RE = /^[\p{L}\p{N}][\p{L}\p{N}&+'./ -]{0,79}$/u;

export const DIRECTORY_PAGE_SIZE = 12;

export function parsePsychicSearch(search: Record<string, unknown>): PsychicSearch {
  const out: PsychicSearch = {};
  const board = search.board;
  if (board === "trusted" || board === "recommended" || board === "new") out.board = board;
  const category = cleanText(search.category, 48);
  if (category) out.category = category;
  const q = cleanText(search.q, 80);
  if (q) out.q = q;
  const availability = search.availability;
  if (availability === "online" || availability === "busy" || availability === "offline") out.availability = availability;
  if (search.connect === "chat") out.connect = "chat";
  const sort = search.sort;
  if (sort === "recommended" || sort === "top-rated" || sort === "experienced" || sort === "new") out.sort = sort;
  return out;
}

function cleanText(value: unknown, max: number) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  if (!text || !TEXT_RE.test(text)) return "";
  return text;
}

export function queryPublicDirectory<T extends PublicPsychic>(
  advisors: readonly T[] | null | undefined,
  query: PsychicSearch,
  previewLayout = false,
): T[] {
  const list = Array.isArray(advisors) ? advisors.filter((row) => !!row && typeof row === "object") : [];
  let rows = list.filter((row) => !row.status || row.status === "live");
  const categoryName = String(query.category || "").trim();
  const category = categoryName ? publicCategoryById(categoryName) : null;
  if (category?.board === "new") {
    rows = newPsychics(rows);
  } else if (category) {
    rows = rows.filter((row) => advisorMatchesPublicCategory(row, category));
  } else if (categoryName && categoryName.toLowerCase() !== "all") {
    rows = rows.filter((row) => {
      const assigned = assignedCategoryDecision(row.listingCategories, categoryName);
      if (assigned !== null) return assigned;
      return looseCategoryMatch(row.specialties, categoryName);
    });
  }

  const q = String(query.q || "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) => `${row.name || ""} ${row.specialties || ""} ${row.bio || ""}`.toLowerCase().includes(q));
  }
  if (query.availability) {
    const availability: PresenceState = query.availability;
    rows = rows.filter((row) => presenceState(row) === availability);
  }
  if (query.connect && query.connect !== "chat") return [];

  if (query.board === "trusted") return sortByAvailability(trustedRows(rows, previewLayout));
  if (query.board === "recommended") return sortByAvailability(recommendedRows(rows, previewLayout, 80));
  if (query.board === "new") return sortByAvailability(newPsychics(rows));
  return sortByAvailability(sortDirectory(rows, query.sort || "recommended", previewLayout));
}

function sortDirectory<T extends PublicPsychic>(rows: T[], sort: DirectorySort, previewLayout: boolean): T[] {
  if (sort === "top-rated") {
    return [...rows].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews || a.name.localeCompare(b.name));
  }
  if (sort === "experienced") {
    return [...rows].sort((a, b) => (b.years || 0) - (a.years || 0) || b.reviews - a.reviews || a.name.localeCompare(b.name));
  }
  if (sort === "new") {
    return [...rows].sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      const delta = (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0);
      if (delta) return delta;
      return a.name.localeCompare(b.name);
    });
  }
  const picked = recommendedRows(rows, previewLayout, rows.length || 0);
  const seen = new Set(picked.map((row) => row.id));
  const rest = rows
    .filter((row) => !seen.has(row.id))
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.name.localeCompare(b.name);
    });
  return [...picked, ...rest];
}

function looseCategoryMatch(specialties: string, filter: string) {
  const text = String(specialties || "").toLowerCase();
  const name = String(filter || "").toLowerCase();
  if (!name || name === "all") return true;
  if (text.includes(name)) return true;
  if (name === "love") return /love|relationship|romance/.test(text);
  if (name === "career") return /career|work|job/.test(text);
  if (name === "psychic readings") return /psychic|clairvoyant|tarot/.test(text);
  if (name === "dream analysis") return /dream/.test(text);
  if (name === "spirituality") return /spirit/.test(text);
  return false;
}

function previewFloor<T extends PublicPsychic>(advisors: T[], limit: number) {
  return [...advisors]
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (Number(a.trusted) !== Number(b.trusted)) return a.trusted ? -1 : 1;
      if (b.reviews !== a.reviews) return b.reviews - a.reviews;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .slice(0, limit);
}

function trustedRows<T extends PublicPsychic>(advisors: T[], previewLayout: boolean) {
  const selected = selectTrustedPsychics(advisors);
  if (selected.length) return selected;
  if (!previewLayout) return [];
  return previewFloor(advisors, 10);
}

function recommendedRows<T extends PublicPsychic>(advisors: T[], previewLayout: boolean, limit: number) {
  const scored = recommendByReviews(advisors, limit);
  if (scored.length) return scored;
  if (!previewLayout) return [];
  return previewFloor(advisors, limit);
}

export function pageDirectory<T>(rows: readonly T[], pages: number, size = DIRECTORY_PAGE_SIZE) {
  const total = rows.length;
  const count = Math.max(1, Math.floor(pages) || 1) * size;
  return {
    items: rows.slice(0, count),
    total,
    hasMore: total > count,
  };
}

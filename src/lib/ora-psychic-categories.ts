/** Admin-assigned psychic status categories for homepage sections and badges. */

export const PSYCHIC_CATEGORIES = [
  { id: "trusted", label: "Trusted Psychics", icon: "ShieldCheck", color: "#16a34a", bg: "#f0fdf4" },
  { id: "elite", label: "Elite Psychics", icon: "Crown", color: "#c4a35a", bg: "#fbf6ea" },
  { id: "master", label: "Master Psychics", icon: "Diamond", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "top-rated", label: "Top Rated Psychics", icon: "Star", color: "#eab308", bg: "#fefce8" },
  { id: "rising", label: "Rising Stars", icon: "Flame", color: "#f97316", bg: "#fff7ed" },
  { id: "premium", label: "Premium Advisors", icon: "BadgeCheck", color: "#6d3054", bg: "#f8eef3" },
  { id: "favorites", label: "Client Favorites", icon: "Heart", color: "#ec4899", bg: "#fdf2f8" },
] as const;

export type PsychicCategoryId = (typeof PSYCHIC_CATEGORIES)[number]["id"];

const IDS = new Set<string>(PSYCHIC_CATEGORIES.map((c) => c.id));

export function parsePsychicCategories(value: unknown): PsychicCategoryId[] {
  const tokens = String(value ?? "")
    .split(/[,\n|/]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<PsychicCategoryId>();
  for (const token of tokens) {
    if (IDS.has(token)) seen.add(token as PsychicCategoryId);
  }
  return PSYCHIC_CATEGORIES.map((c) => c.id).filter((id) => seen.has(id));
}

export function serializePsychicCategories(value: unknown): string {
  return parsePsychicCategories(value).join(",");
}

export function psychicCategoryById(id: string) {
  return PSYCHIC_CATEGORIES.find((c) => c.id === id);
}

/** Customer-site categories. Matching uses specialties already stored on advisor profiles. */

export type PublicCategory = {
  id: string;
  label: string;
  short: string;
  /** Null categories are not specialty filters. */
  pattern: RegExp | null;
  board?: "new";
};

export const PUBLIC_CATEGORIES: readonly PublicCategory[] = [
  { id: "psychic-readings", label: "Psychic Readings", short: "Psychic Readings", pattern: /psychic|clairvoyant|intuitive/i },
  { id: "soulmate", label: "Soulmate", short: "Soulmate", pattern: /soulmate/i },
  { id: "love", label: "Love & Relationships", short: "Love Psychics", pattern: /love|relationship|romance|soulmate/i },
  { id: "life-path", label: "Life Path & Advice", short: "Life Path", pattern: /life path|life purpose|destiny/i },
  { id: "mediums", label: "Psychic Mediums", short: "Psychic Mediums", pattern: /medium/i },
  { id: "spiritual", label: "Spiritual Readings", short: "Spiritual", pattern: /spirit/i },
  { id: "tarot", label: "Tarot Card Readings", short: "Tarot", pattern: /tarot/i },
  { id: "new", label: "Rising Stars", short: "Rising Stars", pattern: null, board: "new" },
  { id: "astrology", label: "Astrology Readings", short: "Astrology", pattern: /astrolog|zodiac|horoscope|birth chart/i },
  { id: "dreams", label: "Dream Interpretation", short: "Dream Interpretation", pattern: /dream/i },
  { id: "finance", label: "Financial Guidance", short: "Finances", pattern: /financ|money|wealth|prosper/i },
  { id: "cartomancy", label: "Cartomancy Readings", short: "Cartomancy", pattern: /cartomancy/i },
  { id: "angels", label: "Angel Readings", short: "Angel Readings", pattern: /angel/i },
  { id: "aura", label: "Aura Cleansing", short: "Aura Cleansing", pattern: /aura/i },
  { id: "numerology", label: "Numerology", short: "Numerology", pattern: /numerolog/i },
  { id: "palm", label: "Palm Readings", short: "Palm Reading", pattern: /palm/i },
  { id: "fortune", label: "Fortune Telling", short: "Fortune Telling", pattern: /fortune/i },
  { id: "career", label: "Career & Work", short: "Career Guidance", pattern: /career|work|job/i },
  { id: "family", label: "Family & Friends", short: "Family & Friends", pattern: /family|friend/i },
];

export const SERVICE_CARD_IDS = [
  "psychic-readings",
  "astrology",
  "numerology",
  "tarot",
  "dreams",
  "palm",
  "soulmate",
  "love",
  "fortune",
  "career",
  "mediums",
] as const;

export const TOPIC_FILTERS = [
  { id: "love", label: "Love & Relationships" },
  { id: "finance", label: "Finances" },
  { id: "life-path", label: "Life Path" },
  { id: "family", label: "Family & Friends" },
  { id: "career", label: "Career & Work" },
] as const;

const BY_ID = new Map(PUBLIC_CATEGORIES.map((category) => [category.id, category]));

export function publicCategoryById(id: string) {
  return BY_ID.get(String(id || "").trim()) || null;
}

export function serviceCards() {
  return SERVICE_CARD_IDS.map((id) => publicCategoryById(id)).filter((category): category is PublicCategory => Boolean(category));
}

export function advisorMatchesCategory(specialties: string, category: PublicCategory) {
  if (category.board === "new" || !category.pattern) return false;
  const text = String(specialties || "");
  if (category.pattern.test(text)) return true;
  return text.toLowerCase().includes(category.label.toLowerCase());
}

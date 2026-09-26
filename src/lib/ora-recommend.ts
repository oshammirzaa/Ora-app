/** Advisors with no genuine reviews stay out of Recommended Psychics. */
export const MIN_RECOMMEND_REVIEWS = 1;

export type ReviewAdvisor = {
  id: string;
  name: string;
  rating: number;
  reviews: number;
};

/**
 * Recommended Psychics score: volume of genuine reviews × average rating.
 * A 5.0 from a handful of reviews cannot outrank a strong average with many reviews.
 * Conversion / monthly rank is intentionally unused here.
 */
export function reviewRecommendScore(rating: number, reviews: number): number {
  const r = Number(rating);
  const n = Math.floor(Number(reviews));
  if (!Number.isFinite(r) || r <= 0) return 0;
  if (!Number.isFinite(n) || n < MIN_RECOMMEND_REVIEWS) return 0;
  return r * Math.log10(1 + n);
}

export function recommendByReviews<T extends ReviewAdvisor>(advisors: T[], limit = 8): T[] {
  return [...advisors]
    .filter((a) => reviewRecommendScore(a.rating, a.reviews) > 0)
    .sort((a, b) => {
      const ds = reviewRecommendScore(b.rating, b.reviews) - reviewRecommendScore(a.rating, a.reviews);
      if (ds) return ds;
      if (b.reviews !== a.reviews) return b.reviews - a.reviews;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .slice(0, Math.max(0, limit));
}

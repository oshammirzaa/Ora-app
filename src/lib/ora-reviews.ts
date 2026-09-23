import { advisorUtcDayKey } from "./ora-advisor-desk-stats.ts";

export const REVIEW_ALREADY_TODAY = "You've already left a review for this advisor today.";
export const REVIEW_ALREADY_READING = "You've already reviewed this reading.";

export function reviewDayKey(now = new Date()) {
  return advisorUtcDayKey(now);
}

export function reviewDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { day: reviewDayKey(now), start: start.toISOString(), end: end.toISOString() };
}

export function reviewDeniedReason(input: { alreadyToday?: boolean; alreadyForReading?: boolean }) {
  if (input.alreadyToday) return REVIEW_ALREADY_TODAY;
  if (input.alreadyForReading) return REVIEW_ALREADY_READING;
  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

export function formatReviewDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function reviewAverage(ratings: number[]) {
  const clean = ratings.map((n) => Math.floor(Number(n) || 0)).filter((n) => n >= 1 && n <= 5);
  if (!clean.length) return { rating: 0, count: 0 };
  const sum = clean.reduce((total, n) => total + n, 0);
  return { rating: Math.round((sum / clean.length) * 10) / 10, count: clean.length };
}

export type SimulatedReview = {
  clientId: string;
  advisorId: string;
  readingId: string;
  day: string;
  rating: number;
  body: string;
};

export type SimulatedReviewState = {
  reviews: SimulatedReview[];
  lastReject: string;
};

export function emptyReviewState(): SimulatedReviewState {
  return { reviews: [], lastReject: "" };
}

/** One review per client, advisor, and UTC day. A rejected attempt does not change older reviews. */
export function applySimulatedReview(
  state: SimulatedReviewState,
  input: {
    clientId: string;
    advisorId: string;
    readingId: string;
    day: string;
    rating: number;
    body?: string;
    eligible?: boolean;
  },
): SimulatedReviewState {
  if (input.eligible === false) return { ...state, lastReject: "Rate the sitting after it ends." };
  const alreadyToday = state.reviews.some(
    (review) => review.clientId === input.clientId && review.advisorId === input.advisorId && review.day === input.day,
  );
  const alreadyForReading = state.reviews.some((review) => review.readingId === input.readingId);
  const denied = reviewDeniedReason({ alreadyToday, alreadyForReading });
  if (denied) return { ...state, lastReject: denied };
  const rating = Math.min(5, Math.max(1, Math.floor(Number(input.rating) || 0)));
  if (!rating) return { ...state, lastReject: "Choose a rating." };
  return {
    reviews: [
      ...state.reviews,
      {
        clientId: input.clientId,
        advisorId: input.advisorId,
        readingId: input.readingId,
        day: input.day,
        rating,
        body: String(input.body ?? "").slice(0, 300),
      },
    ],
    lastReject: "",
  };
}

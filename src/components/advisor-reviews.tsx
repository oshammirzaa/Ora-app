import { Star } from "lucide-react";
import { formatReviewDate } from "@/lib/ora-reviews";
import { cn } from "@/lib/utils";

export type PublicReview = {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  body: string;
  at: string;
};

function GoldStars({ value, className }: { value: number; className?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-hidden>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn("size-3.5", index < filled ? "fill-gold text-gold" : "fill-transparent text-gold/40")}
          strokeWidth={1.6}
        />
      ))}
    </span>
  );
}

export function AdvisorReviews({
  advisorName,
  rating,
  count,
  reviews,
  alreadyToday,
}: {
  advisorName: string;
  rating: number;
  count: number;
  reviews: PublicReview[];
  alreadyToday?: boolean;
}) {
  const name = advisorName.trim() || "this advisor";
  return (
    <section className="mt-8 rounded-[1.4rem] border border-[#eadff3] bg-white/80 p-3.5 shadow-[var(--shadow-border)]" aria-label="Client reviews">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-xl text-fg">
            <Star className="size-4 fill-gold text-gold" />
            Client Reviews
          </h2>
          <p className="mt-0.5 text-xs text-muted">Real experiences from valued clients</p>
        </div>
        {count > 0 ? (
          <div className="text-right">
            <p className="font-display text-2xl leading-none text-fg">{rating.toFixed(1)}</p>
            <GoldStars value={rating} className="mt-1 justify-end" />
            <p className="mt-0.5 text-[11px] text-muted">{count === 1 ? "1 review" : `${count} reviews`}</p>
          </div>
        ) : null}
      </div>
      {reviews.length ? (
        <ul className="mt-3 space-y-2">
          {reviews.map((review) => {
            const initial = (review.name || "C").trim().slice(0, 1).toUpperCase();
            return (
              <li key={review.id} className="rounded-2xl border border-[#f0e7f6] bg-[#fffcff] px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  {review.photo ? (
                    <img src={review.photo} alt="" className="size-9 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3e7fb] font-display text-sm text-primary">
                      {initial}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{review.name}</p>
                        <p className="text-[11px] text-muted">{formatReviewDate(review.at)}</p>
                      </div>
                      <GoldStars value={review.rating} />
                    </div>
                    {review.body ? <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-fg">{review.body}</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No reviews yet.</p>
      )}
      {alreadyToday ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#f6effb] px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-[#5c4d6e]">
            You can leave one review per advisor per day.
            <span className="mt-0.5 block">You have already left a review for {name} today.</span>
          </p>
          <span className="shrink-0 rounded-full bg-[#e7e0ea] px-3 py-2 text-[11px] text-muted">Write a Review</span>
        </div>
      ) : null}
    </section>
  );
}

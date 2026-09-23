import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Star, X } from "lucide-react";
import { OraBrandMark } from "@/components/ora-brand";
import { cn } from "@/lib/utils";

const STAR_LABELS = ["Poor", "Fair", "Good", "Great", "Amazing"] as const;
const MAX_REVIEW = 300;

export function ReadingFeedbackModal({
  open,
  advisorName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  advisorName: string;
  onClose: () => void;
  onSubmit: (rating: number, body: string) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const name = advisorName.trim() || "your advisor";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setRating(0);
      setBody("");
      setBusy(false);
    }
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2a2430]/50 p-3 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ora-review-title"
    >
      <div className="relative max-h-[calc(100dvh-1.25rem)] w-full max-w-[22.75rem] overflow-y-auto rounded-[1.7rem] border border-[#d4b57a] bg-[#fffaf6] px-4 pt-3.5 pb-4 shadow-[0_18px_50px_-24px_rgba(42,36,48,0.55)]">
        <button
          type="button"
          aria-label="Close"
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="flex items-center gap-2">
            <OraBrandMark className="size-11" />
            <div className="leading-none">
              <p className="font-display text-[1.85rem] text-primary">Ora</p>
              <p className="mt-1 text-[8px] tracking-[0.16em] text-muted uppercase">Psychic Readings</p>
            </div>
          </div>
          <p className="pt-1 text-right text-[8px] leading-[1.35] tracking-[0.14em] text-faint uppercase">
            Real people
            <br />
            Real guidance
            <br />
            A brighter you
          </p>
        </div>

        <svg viewBox="0 0 70 150" className="pointer-events-none absolute top-24 left-1 h-28 w-10 text-[#d4b57a]" aria-hidden>
          <path d="M34 8c8 16 6 28-2 40 12-2 20 6 24 16-14 2-24-4-30-16-2 18 4 34 16 48-16-6-28-20-30-38 8 2 14-2 18-10-10 22-6 42 8 58" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M28 36c6-8 10-8 16-2" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M22 62c8-6 14-4 18 2" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>

        <div className="relative px-2 pt-3 text-center">
          <h2 id="ora-review-title" className="font-[family-name:var(--font-script)] text-[2.7rem] leading-none font-normal text-primary">
            Thank You
          </h2>
          <p className="mt-1 text-sm text-[#c4a35a]" aria-hidden>
            ♥
          </p>
          <p className="mt-1 font-display text-[1.55rem] leading-tight text-fg">
            How was your reading with {name}?
          </p>
          <p className="mx-auto mt-2 max-w-[18rem] text-[13px] leading-snug text-muted">
            your feedback helps us support our trusted psychics and keep the Ora community strong
          </p>
        </div>

        <div className="relative mt-4 grid grid-cols-5 gap-1">
          {STAR_LABELS.map((label, index) => {
            const value = index + 1;
            const on = value <= rating;
            return (
              <button
                key={label}
                type="button"
                className="flex flex-col items-center gap-1"
                aria-label={`${value} ${label}`}
                aria-pressed={rating === value}
                onClick={() => setRating(value)}
              >
                <Star className={cn("size-8", on ? "fill-[#c4a35a] text-[#c4a35a]" : "fill-transparent text-[#c4a35a]")} strokeWidth={1.4} />
                <span className="text-[11px] text-muted">{value}</span>
                <span className="text-[10px] tracking-wide text-faint lowercase">{label}</span>
              </button>
            );
          })}
        </div>

        <label className="relative mt-4 block">
          <textarea
            value={body}
            maxLength={MAX_REVIEW}
            onChange={(event) => setBody(event.target.value.slice(0, MAX_REVIEW))}
            placeholder="Share a few words (optional)..."
            className="min-h-24 w-full resize-none rounded-2xl border border-[#eadfce] bg-white px-3.5 py-3 text-sm text-fg placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          />
          <span className="absolute right-3 bottom-2 text-[11px] text-faint">
            {body.length}/{MAX_REVIEW}
          </span>
        </label>

        <div className="mt-3 grid grid-cols-[0.85fr_1.15fr] gap-2">
          <button
            type="button"
            className="h-11 rounded-full border border-[#d9c7b4] bg-white text-sm text-fg"
            onClick={onClose}
          >
            Maybe Later
          </button>
          <button
            type="button"
            disabled={!rating || busy}
            className="h-11 rounded-full bg-primary text-sm text-primary-fg disabled:opacity-40"
            onClick={() => {
              if (!rating || busy) return;
              setBusy(true);
              void onSubmit(rating, body.trim())
                .catch(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Submit Review →"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[9px] tracking-[0.16em] text-faint uppercase">
          <span>Guidance today</span>
          <span className="text-[#c4a35a]">☽</span>
          <span>A brighter tomorrow</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

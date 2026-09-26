import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FavoriteHeart, NotifySwitch } from "@/components/advisor-cards";
import { AdvisorMedia } from "@/components/advisor-media";
import { ChatPhoto } from "@/components/chat-photo";
import { RecalledMessageLine, SentMessageBubble } from "@/components/message-recall";
import { ChatNow, PresenceBadge } from "@/components/chat-now";
import { ReadingFeedbackModal } from "@/components/reading-feedback-modal";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { setFavoriteId } from "@/lib/favorite-store";
import {
  formatClock,
  formatWhen,
  isFavorite,
  leaveReview,
  listMessages,
  type Advisor,
  type ChatMsg,
} from "@/lib/ora";
import { setFavoriteNotify } from "@/lib/ora-favorites";
import { myAdvisorReviewToday } from "@/lib/ora-reviews-api";
import { REVIEW_ALREADY_TODAY } from "@/lib/ora-reviews";
import { applyLocalRecalls, recallReadingMessage } from "@/lib/ora-message-recall";
import { cn } from "@/lib/utils";

export function ReadingHistoryView({
  readingId,
  advisor,
  seconds,
  coinsSpent,
  rate,
  reviewed: initialReviewed,
  startedAt,
  endedAt,
}: {
  readingId: string;
  advisor: Advisor;
  seconds: number;
  coinsSpent: number;
  rate: number;
  reviewed?: boolean;
  startedAt?: string;
  endedAt?: string | null;
}) {
  const { user } = useCurrentUserState();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [notify, setNotify] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [reviewed, setReviewed] = useState(Boolean(initialReviewed));
  const [reviewedToday, setReviewedToday] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const recalledIds = useRef(new Set<string>());
  const live = advisor.online && !advisor.busy;

  useEffect(() => {
    void listMessages({ data: { id: readingId } })
      .then((next) => setMsgs(applyLocalRecalls(next, recalledIds.current)))
      .catch(() => setMsgs([]));
  }, [readingId]);

  useEffect(() => {
    if (!user) return;
    void isFavorite({ data: { advisorId: advisor.id } })
      .then((r) => {
        setNotify(Boolean(r.notify));
        setFavoriteId(advisor.id, r.saved);
      })
      .catch(() => setNotify(false));
  }, [user, advisor.id]);

  useEffect(() => {
    if (reviewed || !advisor?.id || !user) return;
    void myAdvisorReviewToday({ data: { advisorId: advisor.id } })
      .then((result) => setReviewedToday(Boolean(result.alreadyToday)))
      .catch(() => setReviewedToday(false));
  }, [advisor?.id, reviewed, user]);

  return (
    <main className="px-4 py-6">
      <p className="text-xs tracking-wide text-faint uppercase">Reading history</p>
      <div className="mt-3 flex items-start gap-3">
        <Link
          to="/advisors/$id"
          params={{ id: advisor.slug }}
          preload={false}
          className="relative size-16 shrink-0 overflow-hidden rounded-full bg-elevated"
        >
          <AdvisorMedia photo={advisor.photoUrl} className="outline-none" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false}>
                <h1 className="truncate font-display text-2xl text-fg">{advisor.name}</h1>
              </Link>
              <p className="truncate text-xs text-muted">{advisor.specialties || "Live text chat"}</p>
              <PresenceBadge advisor={advisor} className="mt-1" />
            </div>
            <FavoriteHeart advisorId={advisor.id} />
          </div>
        </div>
      </div>

      <section className="mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="text-sm text-fg">
          {startedAt ? formatWhen(startedAt) : ""}
          {endedAt ? ` – ${formatWhen(endedAt)}` : ""}
        </p>
        <p className="mt-1 text-sm text-muted">
          Live text chat · {formatClock(seconds)} · {coinsSpent}c charged
          {rate ? ` · ${rate}c/min` : ""}
        </p>
        <p className="mt-1 text-xs text-primary">Completed</p>
      </section>

      <section className="mt-4 space-y-3">
        <h2 className="font-display text-xl text-fg">Conversation</h2>
        {!msgs.length ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">
            No messages were saved for this sitting.
          </p>
        ) : (
          msgs.map((m) =>
            m.recalled ? (
              <RecalledMessageLine key={m.id} mine={m.role === "client"} />
            ) : (
            <div key={m.id} className={cn("flex", m.role === "client" ? "justify-end" : "justify-start")}>
              <SentMessageBubble
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                  m.role === "client" ? "bg-primary text-primary-fg" : "bg-lilac text-fg",
                )}
                onRecall={
                  m.role === "client" && !m.tipGift
                    ? async () => {
                        await recallReadingMessage({ data: { messageId: m.id } });
                        recalledIds.current.add(m.id);
                        const next = await listMessages({ data: { id: readingId } });
                        setMsgs(applyLocalRecalls(next, recalledIds.current));
                      }
                    : undefined
                }
              >
                {m.image ? <ChatPhoto src={m.image} light={m.role === "client"} /> : null}
                {m.body ? <p className={m.image ? "mt-1.5" : ""}>{m.body}</p> : null}
              </SentMessageBubble>
            </div>
            ),
          )
        )}
      </section>

      <div className="mt-5 space-y-2">
        {live ? (
          <ChatNow advisor={advisor} label="Chat Again" className="h-11 w-full rounded-full" />
        ) : (
          <NotifySwitch
            className="rounded-2xl bg-surface px-3 py-2.5 shadow-[var(--shadow-border)]"
            checked={notify}
            disabled={notifyBusy}
            onChange={(next) => {
              setNotifyBusy(true);
              void setFavoriteNotify({ data: { advisorId: advisor.id, notify: next } })
                .then((r) => {
                  setNotify(r.notify);
                  if (r.saved) setFavoriteId(advisor.id, true);
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update alert"))
                .finally(() => setNotifyBusy(false));
            }}
          />
        )}
        <Button asChild variant="outline" className="w-full rounded-full">
          <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false}>
            View Profile
          </Link>
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {reviewed ? (
          <p className="text-sm text-ok">Review saved.</p>
        ) : reviewedToday ? (
          <p className="text-sm text-muted">{REVIEW_ALREADY_TODAY}</p>
        ) : (
          <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => setReviewOpen(true)}>
            Leave a review
          </Button>
        )}
      </div>
      <ReadingFeedbackModal
        open={reviewOpen && !reviewed && !reviewedToday}
        advisorName={advisor.name || "your advisor"}
        onClose={() => setReviewOpen(false)}
        onSubmit={async (rating, body) => {
          try {
            await leaveReview({ data: { readingId, rating, body } });
            setReviewed(true);
            setReviewOpen(false);
            toast.success("Review saved.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save");
            throw err;
          }
        }}
      />
    </main>
  );
}

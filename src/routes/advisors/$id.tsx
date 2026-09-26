import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatUsdPerMin, NotifySwitch } from "@/components/advisor-cards";
import { AdvisorMedia, AdvisorVideoEmbed } from "@/components/advisor-media";
import { AppShell } from "@/components/app-shell";
import { ChatNow, PresenceBadge } from "@/components/chat-now";
import { BlockConfirmDialog, SafetyReportDialog } from "@/components/safety-dialogs";
import { Button } from "@/components/ui/button";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AdvisorReviews, type PublicReview } from "@/components/advisor-reviews";
import { advisorProfileReviews, myAdvisorReviewToday } from "@/lib/ora-reviews-api";
import { formatWhen, getAdvisor, isFavorite, toggleFavorite } from "@/lib/ora";
import { advisorShowsTrustedBadge } from "@/lib/ora-rank";
import { getPairSafety, setCustomerBlock } from "@/lib/ora-safety-api";
import { lastReadingWithAdvisor, setFavoriteNotify } from "@/lib/ora-favorites";
import { setFavoriteId } from "@/lib/favorite-store";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { isDirectVideo } from "@/lib/video";

export const Route = createFileRoute("/advisors/$id")({
  staleTime: 30_000,
  loader: async ({ params }) => getAdvisor({ data: { id: params.id } }),
  component: AdvisorPage,
});

function AdvisorPage() {
  const loaded = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [advisor, setAdvisor] = useState(loaded);
  const [saved, setSaved] = useState(false);
  const [notify, setNotify] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [lastReadingAt, setLastReadingAt] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [pairBlocked, setPairBlocked] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewedToday, setReviewedToday] = useState(false);

  useEffect(() => {
    setAdvisor(loaded);
  }, [loaded]);

  useVisibleInterval(
    () => {
      if (!advisor) return;
      void getAdvisor({ data: { id: advisor.id } }).then((next) => {
        if (next) setAdvisor(next);
      });
    },
    20_000,
    Boolean(advisor),
    false,
  );

  useEffect(() => {
    if (!user || !advisor) {
      setLastReadingAt("");
      setFollowUp("");
      if (!user) {
        setSaved(false);
        setNotify(false);
      }
      if (!user || !advisor) return;
    }
    void isFavorite({ data: { advisorId: advisor.id } })
      .then((r) => {
        setSaved(r.saved);
        setNotify(Boolean(r.notify));
        setFavoriteId(advisor.id, r.saved);
      })
      .catch(() => {
        setSaved(false);
        setNotify(false);
      });
    void lastReadingWithAdvisor({ data: { advisorId: advisor.id } })
      .then((r) => {
        setLastReadingAt(r.at);
        setFollowUp(r.followUp);
      })
      .catch(() => {
        setLastReadingAt("");
        setFollowUp("");
      });
    void getPairSafety({ data: { advisorId: advisor.id } })
      .then((r) => {
        setBlockedByMe(Boolean(r.blockedByMe));
        setPairBlocked(Boolean(r.blocked));
      })
      .catch(() => {
        setBlockedByMe(false);
        setPairBlocked(false);
      });
  }, [user, advisor]);

  useEffect(() => {
    if (!advisor) return;
    void advisorProfileReviews({ data: { advisorId: advisor.id } })
      .then((result) => {
        setReviews(result.reviews);
        setReviewRating(result.rating);
        setReviewCount(result.count);
      })
      .catch(() => {
        setReviews([]);
        setReviewRating(0);
        setReviewCount(0);
      });
  }, [advisor]);

  useEffect(() => {
    if (!user || !advisor) {
      setReviewedToday(false);
      return;
    }
    void myAdvisorReviewToday({ data: { advisorId: advisor.id } })
      .then((result) => setReviewedToday(Boolean(result.alreadyToday)))
      .catch(() => setReviewedToday(false));
  }, [user, advisor]);

  if (!advisor) {
    return (
      <AppShell tab="home">
        <p className="px-4 py-20 text-center text-muted">That advisor is not on the floor.</p>
      </AppShell>
    );
  }

  return (
    <AppShell tab="home">
      <main className="px-4 pt-2 pb-8">
        <div className="relative overflow-hidden rounded-2xl bg-elevated shadow-[var(--shadow-border)]">
          <div className="aspect-4/5">
            <AdvisorMedia photo={advisor.photoUrl} video={advisor.videoUrl} alt="" eager />
          </div>
          <PresenceBadge advisor={advisor} className="absolute top-3 left-3 bg-surface/90" />
        </div>
        <div className="pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {advisorShowsTrustedBadge(advisor) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="size-3" />
                Top trusted
              </span>
            ) : null}
            {advisor.isNew ? (
              <span className="rounded-full bg-elevated px-2 py-1 text-xs text-muted">New on the floor</span>
            ) : null}
          </div>
          <p className="mt-3 text-xs tracking-wide text-muted uppercase">{advisor.specialties}</p>
          <h1 className="mt-1 font-display text-3xl text-fg">{advisor.name}</h1>
          {lastReadingAt ? (
            <p className="mt-1 text-xs text-faint">Last reading with you · {formatWhen(lastReadingAt)}</p>
          ) : null}
          {followUp ? (
            <div className="mt-3 rounded-2xl bg-elevated/80 p-3">
              <p className="text-[10px] tracking-wide text-muted uppercase">Message from {advisor.name}</p>
              <p className="mt-1 text-sm text-fg">{followUp}</p>
            </div>
          ) : null}
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-fg">
            <Star className="size-3.5 fill-gold text-gold" />
            {Number.isFinite(Number(advisor.rating)) ? Number(advisor.rating).toFixed(1) : "—"} · {advisor.reviews} readings
          </p>
          <p className="mt-1 text-sm text-fg">
            {formatUsdPerMin(advisor.rateCoins)} after included time
          </p>
          <p className="mt-1 text-sm text-muted">
            {advisor.years ? `${advisor.years} years · ` : ""}
            {advisor.languages || "English"}
          </p>
          {user ? (
            <div className="mt-3">
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                onClick={() => {
                  void toggleFavorite({ data: { advisorId: advisor.id } })
                    .then((r) => {
                      setSaved(r.saved);
                      setFavoriteId(advisor.id, r.saved);
                      if (!r.saved) setNotify(false);
                      toast.success(r.saved ? "Saved to your favorites." : "Removed from favorites.");
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Sign in first."));
                }}
              >
                <Heart className={saved ? "size-4 fill-primary text-primary" : "size-4"} />
                {saved ? "Saved" : "Save advisor"}
              </button>
              {saved ? (
                <NotifySwitch
                  className="mt-2 rounded-2xl bg-elevated/80 px-3 py-2.5"
                  checked={notify}
                  disabled={notifyBusy}
                  onChange={(next) => {
                    setNotifyBusy(true);
                    void setFavoriteNotify({ data: { advisorId: advisor.id, notify: next } })
                      .then((r) => setNotify(r.notify))
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update alert"))
                      .finally(() => setNotifyBusy(false));
                  }}
                />
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="text-xs text-muted" onClick={() => setBlockOpen(true)}>
                  {blockedByMe ? "Unblock advisor" : "Block advisor"}
                </button>
                <button type="button" className="text-xs text-muted" onClick={() => setReportOpen(true)}>
                  Report
                </button>
              </div>
            </div>
          ) : null}
          <p className="mt-4 text-sm text-muted">{advisor.bio}</p>
          <h2 className="mt-6 font-display text-xl text-fg">Experience</h2>
          <p className="mt-2 text-sm text-muted">{advisor.experience}</p>
          {advisor.videoUrl && !isDirectVideo(advisor.videoUrl) ? (
            <div className="mt-4">
              <AdvisorVideoEmbed url={advisor.videoUrl} />
            </div>
          ) : null}
          <div className="sticky bottom-20 mt-6 bg-bg/90 py-3 backdrop-blur-md">
            <SignInGate
              fallback={
                <Button asChild className="w-full rounded-full">
                  <Link to="/login">Sign in to chat</Link>
                </Button>
              }
            >
              <>
                {pairBlocked ? (
                  <p className="mb-2 text-center text-sm text-muted">
                    {blockedByMe
                      ? "You blocked this advisor. Unblock to start a new chat."
                      : "New chats with this advisor are unavailable."}
                  </p>
                ) : (
                  <ChatNow advisor={advisor} className="w-full rounded-full" />
                )}
                {pairBlocked ? null : (
                  <Link
                    to="/messages/$id"
                    params={{ id: advisor.slug }}
                    preload={false}
                    className="mt-2 block text-center text-sm text-primary"
                  >
                    Send a message
                  </Link>
                )}
              </>
            </SignInGate>
          </div>
          <AdvisorReviews
            advisorName={advisor.name}
            rating={reviewRating}
            count={reviewCount}
            reviews={reviews}
            alreadyToday={reviewedToday}
          />
        </div>
      </main>
      <BlockConfirmDialog
        open={blockOpen}
        name={advisor.name}
        blocking={!blockedByMe}
        onConfirm={async () => {
          await setCustomerBlock({ data: { advisorId: advisor.id, blocked: !blockedByMe } });
          const next = await getPairSafety({ data: { advisorId: advisor.id } });
          setBlockedByMe(Boolean(next.blockedByMe));
          setPairBlocked(Boolean(next.blocked));
          toast.success(blockedByMe ? "Advisor unblocked." : "Advisor blocked.");
        }}
        onOpenChange={setBlockOpen}
      />
      <SafetyReportDialog
        open={reportOpen}
        name={advisor.name}
        advisorId={advisor.id}
        onOpenChange={setReportOpen}
      />
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdvisorMedia, AdvisorVideoEmbed } from "@/components/advisor-media";
import { AppShell } from "@/components/app-shell";
import { ChatNow, PresenceBadge } from "@/components/chat-now";
import { Button } from "@/components/ui/button";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAdvisor, isFavorite, toggleFavorite } from "@/lib/ora";
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
    if (!user || !advisor) return;
    void isFavorite({ data: { advisorId: advisor.id } })
      .then((r) => setSaved(r.saved))
      .catch(() => setSaved(false));
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
      <main className="pb-8">
        <div className="relative aspect-3/4 overflow-hidden bg-elevated">
          <AdvisorMedia photo={advisor.photoUrl} video={advisor.videoUrl} alt="" eager />
          <PresenceBadge advisor={advisor} className="absolute top-4 left-4" />
        </div>
        <div className="px-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {advisor.trusted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="size-3" />
                Top trusted
              </span>
            ) : null}
            {advisor.isNew ? (
              <span className="rounded-full bg-elevated px-2 py-1 text-xs text-muted">New on the floor</span>
            ) : null}
          </div>
          <p className="mt-3 text-xs tracking-wide text-faint uppercase">{advisor.specialties}</p>
          <h1 className="mt-1 font-display text-3xl">{advisor.name}</h1>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-primary">
            <Star className="size-3.5 fill-primary text-primary" />
            {advisor.rating.toFixed(1)} · {advisor.reviews} readings
          </p>
          <p className="mt-1 text-primary">{advisor.rateCoins}c / min after included time</p>
          <p className="mt-1 text-sm text-muted">
            {advisor.years ? `${advisor.years} years · ` : ""}
            {advisor.languages || "English"}
          </p>
          {user ? (
            <button
              type="button"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
              onClick={() => {
                void toggleFavorite({ data: { advisorId: advisor.id } })
                  .then((r) => {
                    setSaved(r.saved);
                    toast.success(r.saved ? "Saved to your account." : "Removed from saved.");
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Sign in first."));
              }}
            >
              <Heart className={saved ? "size-4 fill-primary" : "size-4"} />
              {saved ? "Saved" : "Save advisor"}
            </button>
          ) : null}
          <p className="mt-4 text-sm text-muted">{advisor.bio}</p>
          <h2 className="mt-6 font-display text-xl">Experience</h2>
          <p className="mt-2 text-sm text-muted">{advisor.experience}</p>
          {advisor.videoUrl && !isDirectVideo(advisor.videoUrl) ? (
            <div className="mt-4">
              <AdvisorVideoEmbed url={advisor.videoUrl} />
            </div>
          ) : null}
          <div className="sticky bottom-20 mt-6 bg-bg/90 py-3 backdrop-blur-md">
            <SignInGate
              fallback={
                <Button asChild className="w-full">
                  <Link to="/login">Sign in to chat</Link>
                </Button>
              }
            >
              <ChatNow advisor={advisor} className="w-full" />
            </SignInGate>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

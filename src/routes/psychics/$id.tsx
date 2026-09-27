import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, ShieldCheck, Star } from "lucide-react";
import { AdvisorMedia } from "@/components/advisor-media";
import { AdvisorReviews } from "@/components/advisor-reviews";
import { formatUsdPerMin } from "@/components/advisor-cards";
import { PresenceBadge } from "@/components/chat-now";
import { PublicFrame } from "@/components/public-frame";
import { getAdvisor } from "@/lib/ora";
import { appHref, toPublicPsychic } from "@/lib/ora-domains";
import { emptyMarketingPage, publicReviewerName } from "@/lib/ora-marketing-copy";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";
import { advisorShowsTrustedBadge } from "@/lib/ora-rank";
import { advisorProfileReviews } from "@/lib/ora-reviews-api";
import { presenceState } from "@/lib/ora-presence";

export const Route = createFileRoute("/psychics/$id")({
  loader: async ({ params }) => {
    const [advisor, host, marketing] = await Promise.all([
      getAdvisor({ data: { id: params.id } }),
      loadMarketingHost().catch(() => ({ marketingHost: false })),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
    ]);
    const reviews = advisor
      ? await advisorProfileReviews({ data: { advisorId: advisor.id } }).catch(() => ({
          rating: advisor.rating,
          count: advisor.reviews,
          reviews: [],
        }))
      : { rating: 0, count: 0, reviews: [] };
    return {
      advisor: advisor && advisor.status === "live" ? toPublicPsychic(advisor) : null,
      marketingHost: host.marketingHost,
      supportEmail: marketing.supportEmail,
      reviews: {
        rating: reviews.rating,
        count: reviews.count,
        reviews: reviews.reviews.map((review) => ({
          id: review.id,
          name: publicReviewerName(review.name),
          photo: "",
          rating: review.rating,
          body: review.body,
          at: review.at,
        })),
      },
    };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.advisor?.name || "Advisor";
    const specialty = loaderData?.advisor?.specialties || "Live psychic reading";
    const slug = loaderData?.advisor?.slug || "";
    const description = `${name} on Ora. ${specialty}. See the published rate, rating, and reviews.`;
    const url = `https://orapsychic.com/psychics/${slug}`;
    const photo = loaderData?.advisor?.photoUrl || "";
    const image = photo.startsWith("https://") ? photo : "https://orapsychic.com/images/ora-logo.png";
    return {
      meta: [
        { title: `${name} | Ora Psychic` },
        { name: "description", content: description.slice(0, 180) },
        { property: "og:title", content: `${name} | Ora Psychic` },
        { property: "og:description", content: description.slice(0, 180) },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PublicProfile,
});

function PublicProfile() {
  const data = Route.useLoaderData();
  const advisor = data.advisor;
  if (!advisor) {
    return (
      <PublicFrame marketingHost={data.marketingHost} supportEmail={data.supportEmail}>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="font-display text-4xl text-fg">Advisor unavailable</h1>
          <p className="mt-3 text-sm text-muted">This profile is not live on Ora.</p>
          <Link to="/psychics" className="mt-6 inline-flex text-sm text-primary">
            Browse advisors
          </Link>
        </main>
      </PublicFrame>
    );
  }
  const state = presenceState(advisor);
  const blocked = state === "offline" || state === "busy";
  const chat = appHref(`/advisors/${advisor.slug || advisor.id}`, data.marketingHost);
  return (
    <PublicFrame marketingHost={data.marketingHost} supportEmail={data.supportEmail}>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[18rem_1fr] md:py-10">
        <div className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)]">
          <div className="aspect-[4/5] bg-elevated">
            <AdvisorMedia photo={advisor.photoUrl} video={advisor.videoUrl} alt="" eager />
          </div>
        </div>
        <div>
          <Link to="/psychics" className="text-sm text-primary">
            All advisors
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PresenceBadge advisor={advisor} />
            {advisorShowsTrustedBadge(advisor) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="size-3" />
                Trusted
              </span>
            ) : null}
            {advisor.isNew ? <span className="rounded-full bg-elevated px-2 py-1 text-xs text-muted">New</span> : null}
          </div>
          <p className="mt-3 text-xs tracking-wide text-muted uppercase">{advisor.specialties || "Specialties on file"}</p>
          <h1 className="mt-1 font-display text-4xl text-fg">{advisor.name}</h1>
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-fg">
            <Star className="size-3.5 fill-gold text-gold" />
            {Number.isFinite(advisor.rating) ? advisor.rating.toFixed(1) : "—"} · {advisor.reviews} reviews
          </p>
          <p className="mt-1 text-sm text-fg">
            {advisor.rateCoins > 0 ? `${formatUsdPerMin(advisor.rateCoins)} after included time` : "Rate published on the profile"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {advisor.years ? `${advisor.years} years · ` : ""}
            {advisor.languages || "English"}
          </p>
          {advisor.bio ? <p className="mt-4 text-sm leading-relaxed text-muted">{advisor.bio}</p> : null}
          {advisor.experience ? (
            <>
              <h2 className="mt-6 font-display text-xl text-fg">Experience</h2>
              <p className="mt-2 text-sm text-muted">{advisor.experience}</p>
            </>
          ) : null}
          <div className="mt-6">
            {blocked ? (
              <span className="inline-flex h-11 w-full items-center justify-center rounded-full bg-elevated text-sm text-faint md:w-auto md:px-8">
                {state === "busy" ? "In Session" : "Offline"}
              </span>
            ) : (
              <a
                href={chat}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-fg md:w-auto md:px-8"
              >
                <MessageCircle className="size-4" />
                Chat Now
              </a>
            )}
          </div>
          {data.reviews.reviews.length ? (
            <AdvisorReviews
              advisorName={advisor.name}
              rating={data.reviews.rating || advisor.rating}
              count={data.reviews.count}
              reviews={data.reviews.reviews}
            />
          ) : null}
        </div>
      </main>
    </PublicFrame>
  );
}

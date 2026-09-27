import { createFileRoute } from "@tanstack/react-router";
import { PublicFrame } from "@/components/public-frame";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";
import { emptyMarketingPage } from "@/lib/ora-marketing-copy";

export const Route = createFileRoute("/about")({
  loader: async () => {
    const [host, marketing] = await Promise.all([
      loadMarketingHost().catch(() => ({ marketingHost: false })),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
    ]);
    return { marketingHost: host.marketingHost, supportEmail: marketing.supportEmail };
  },
  head: () => ({
    meta: [
      { title: "About Ora | Ora Psychic" },
      {
        name: "description",
        content: "Ora is a private place for live psychic readings. See real advisor profiles, then continue in the Ora app.",
      },
      { property: "og:title", content: "About Ora | Ora Psychic" },
      { property: "og:url", content: "https://orapsychic.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://orapsychic.com/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const data = Route.useLoaderData();
  return (
    <PublicFrame marketingHost={data.marketingHost} supportEmail={data.supportEmail}>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs tracking-[0.2em] text-primary uppercase">Ora Psychic</p>
        <h1 className="mt-2 font-display text-4xl text-fg md:text-5xl">About Ora</h1>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted md:text-base">
          <p>
            Ora is a calm place to look for clarity. The public website shows live advisor profiles: the photo, name, specialty, rate, rating, and online status already published on Ora.
          </p>
          <p>
            Your first 3 minutes are free. When you choose Chat Now, Sign In, or Sign Up, you continue in the Ora app, where readings, minutes, and coins stay on your account.
          </p>
          <p>Entertainment only. Ora does not give medical, legal, or financial advice, and it does not promise a specific outcome.</p>
        </div>
      </main>
    </PublicFrame>
  );
}

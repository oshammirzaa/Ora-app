import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicDirectory } from "@/components/public-directory";
import { PublicFrame } from "@/components/public-frame";
import { isPreviewLayout, listAdvisors, listCategories, listFloor } from "@/lib/ora";
import { toPublicPsychic } from "@/lib/ora-domains";
import { emptyMarketingPage } from "@/lib/ora-marketing-copy";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";
import { FLOOR_POLL_MS, mergeFloor } from "@/lib/ora-presence";
import { parsePsychicSearch, type PsychicSearch } from "@/lib/ora-public-directory";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/psychics/")({
  staleTime: 60_000,
  validateSearch: (search: Record<string, unknown>): PsychicSearch => parsePsychicSearch(search),
  loader: async () => {
    const [advisors, categories, previewLayout, host, marketing] = await Promise.all([
      listAdvisors(),
      listCategories(),
      isPreviewLayout(),
      loadMarketingHost().catch(() => ({ marketingHost: false })),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
    ]);
    return {
      advisors: advisors.map((advisor) => toPublicPsychic(advisor)),
      categories,
      previewLayout,
      marketingHost: host.marketingHost,
      supportEmail: marketing.supportEmail,
    };
  },
  head: () => ({
    meta: [
      { title: "Psychic Advisors | Ora Psychic" },
      {
        name: "description",
        content: "Browse live Ora advisors. See photos, specialties, ratings, and per-minute rates before you start a reading.",
      },
      { property: "og:title", content: "Psychic Advisors | Ora Psychic" },
      { property: "og:url", content: "https://orapsychic.com/psychics" },
    ],
    links: [{ rel: "canonical", href: "https://orapsychic.com/psychics" }],
  }),
  component: PsychicDirectory,
});

function PsychicDirectory() {
  const initial = Route.useLoaderData();
  const search = Route.useSearch();
  const [advisors, setAdvisors] = useState(initial.advisors);

  useEffect(() => {
    setAdvisors(initial.advisors);
  }, [initial.advisors]);

  useVisibleInterval(
    () => {
      void listFloor()
        .then((floor) => setAdvisors((current) => mergeFloor(current, Array.isArray(floor) ? floor : [])))
        .catch(() => undefined);
    },
    FLOOR_POLL_MS,
    true,
    true,
  );

  return (
    <PublicFrame marketingHost={initial.marketingHost} supportEmail={initial.supportEmail}>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <PublicDirectory
          advisors={advisors}
          categories={initial.categories}
          search={search}
          marketingHost={initial.marketingHost}
          previewLayout={initial.previewLayout}
        />
      </main>
    </PublicFrame>
  );
}

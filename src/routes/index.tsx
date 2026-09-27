import { createFileRoute } from "@tanstack/react-router";
import { MarketingSite } from "@/components/marketing-site";
import { isPreviewLayout, listAdvisors, listCategories } from "@/lib/ora";
import { toPublicPsychic } from "@/lib/ora-domains";
import { emptyMarketingPage, marketingHead } from "@/lib/ora-marketing-copy";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";

export const Route = createFileRoute("/")({
  staleTime: 60_000,
  loader: async () => {
    const [advisors, categories, previewLayout, marketing, host] = await Promise.all([
      listAdvisors(),
      listCategories(),
      isPreviewLayout(),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
      loadMarketingHost().catch(() => ({ marketingHost: false })),
    ]);
    return {
      advisors: advisors.map((advisor) => toPublicPsychic(advisor)),
      categories,
      previewLayout,
      marketingHost: host.marketingHost,
      supportEmail: marketing.supportEmail,
    };
  },
  head: () => marketingHead("https://orapsychic.com"),
  component: PublicHome,
});

function PublicHome() {
  const data = Route.useLoaderData();
  return (
    <MarketingSite
      advisors={data.advisors}
      categories={data.categories}
      previewLayout={data.previewLayout}
      marketingHost={data.marketingHost}
      supportEmail={data.supportEmail}
    />
  );
}

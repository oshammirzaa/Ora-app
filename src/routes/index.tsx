import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CustomerHomeBody } from "@/components/customer-home";
import { MarketingSite } from "@/components/marketing-site";
import { rememberAdvisors } from "@/lib/client-cache";
import { isPreviewLayout, listAdvisors, listCategories, type Advisor, type Category } from "@/lib/ora";
import { rootHomeExperience, toPublicPsychic } from "@/lib/ora-domains";
import { emptyMarketingPage, marketingHead } from "@/lib/ora-marketing-copy";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";
import { useMarketingWebsite } from "@/lib/use-account-home";

async function requestIsWebsite() {
  if (typeof window !== "undefined") return rootHomeExperience(window.location.hostname) === "website";
  try {
    return (await loadMarketingHost()).marketingHost;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/")({
  staleTime: 60_000,
  loader: async () => {
    const website = await requestIsWebsite();
    if (!website) {
      const [advisors, categories, previewLayout] = await Promise.all([
        listAdvisors(),
        listCategories(),
        isPreviewLayout(),
      ]);
      rememberAdvisors(advisors);
      return { experience: "app" as const, advisors, categories, previewLayout };
    }
    const [advisors, categories, previewLayout, marketing] = await Promise.all([
      listAdvisors(),
      listCategories(),
      isPreviewLayout(),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
    ]);
    return {
      experience: "website" as const,
      advisors: advisors.map((advisor) => toPublicPsychic(advisor)),
      categories,
      previewLayout,
      supportEmail: marketing.supportEmail,
    };
  },
  head: ({ loaderData }) =>
    loaderData?.experience === "website"
      ? marketingHead("https://orapsychic.com")
      : {
          meta: [
            { title: "Ora" },
            {
              name: "description",
              content: "Psychic readings. Three free minutes on first login. $10 a week for three more. Then coins.",
            },
          ],
        },
  component: DomainHome,
});

function DomainHome() {
  const data = Route.useLoaderData();
  const website = useMarketingWebsite();
  if (data.experience === "website" && website) {
    return (
      <MarketingSite
        advisors={data.advisors}
        categories={data.categories}
        previewLayout={data.previewLayout}
        marketingHost
        supportEmail={data.supportEmail}
      />
    );
  }
  if (data.experience === "app") {
    return (
      <AppShell tab="home">
        <CustomerHomeBody
          advisors={data.advisors}
          categories={data.categories}
          previewLayout={data.previewLayout}
        />
      </AppShell>
    );
  }
  return <AppHomeFallback />;
}

/** App host received a website payload. Never paint the desktop site on .xyz. */
function AppHomeFallback() {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [previewLayout, setPreviewLayout] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([listAdvisors(), listCategories(), isPreviewLayout()])
      .then(([nextAdvisors, nextCategories, nextPreview]) => {
        if (!alive) return;
        setAdvisors(nextAdvisors);
        setCategories(nextCategories);
        setPreviewLayout(nextPreview);
        rememberAdvisors(nextAdvisors);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <AppShell tab="home">
      <CustomerHomeBody advisors={advisors} categories={categories} previewLayout={previewLayout} />
    </AppShell>
  );
}

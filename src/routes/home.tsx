import { createFileRoute, isRedirect, redirect, useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CustomerHomeBody } from "@/components/customer-home";
import { rememberAdvisors } from "@/lib/client-cache";
import { getMe, isPreviewLayout, listAdvisors, listCategories } from "@/lib/ora";
import { isMarketingHost } from "@/lib/ora-domains";
import { customerHomeGuardDecision } from "@/lib/ora-home-route";
import { loadMarketingHost } from "@/lib/ora-marketing";
import { useAccountRole, useMarketingWebsite } from "@/lib/use-account-home";

async function redirectAdvisorFromCustomerHome() {
  const marketingHost =
    typeof window !== "undefined"
      ? isMarketingHost(window.location.hostname)
      : (await loadMarketingHost().catch(() => ({ marketingHost: false }))).marketingHost;
  if (!marketingHost) return;
  let role = "";
  try {
    role = (await getMe()).role;
  } catch (err) {
    if (isRedirect(err)) throw err;
    return;
  }
  if (customerHomeGuardDecision({ marketingHost: true, role }).action === "redirect") {
    throw redirect({ to: "/advisor", replace: true });
  }
}

export const Route = createFileRoute("/home")({
  staleTime: 120_000,
  beforeLoad: () => redirectAdvisorFromCustomerHome(),
  loader: async () => {
    const [advisors, categories, previewLayout] = await Promise.all([
      listAdvisors(),
      listCategories(),
      isPreviewLayout(),
    ]);
    rememberAdvisors(advisors);
    return { advisors, categories, previewLayout };
  },
  component: Home,
});

function AdvisorCustomerHomeGate({ children }: { children: ReactNode }) {
  const website = useMarketingWebsite();
  const role = useAccountRole();
  const navigate = useNavigate();
  const block = customerHomeGuardDecision({ marketingHost: website, role }).action === "redirect";

  useLayoutEffect(() => {
    if (!block) return;
    void navigate({ to: "/advisor", replace: true });
  }, [block, navigate]);

  if (block) return null;
  return <>{children}</>;
}

function Home() {
  const initial = Route.useLoaderData();
  return (
    <AdvisorCustomerHomeGate>
      <AppShell tab="home">
        <CustomerHomeBody
          advisors={initial.advisors}
          categories={initial.categories}
          previewLayout={initial.previewLayout}
        />
      </AppShell>
    </AdvisorCustomerHomeGate>
  );
}

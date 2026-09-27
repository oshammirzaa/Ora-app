import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CustomerHomeBody } from "@/components/customer-home";
import { rememberAdvisors } from "@/lib/client-cache";
import { isPreviewLayout, listAdvisors, listCategories } from "@/lib/ora";

export const Route = createFileRoute("/home")({
  staleTime: 120_000,
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

function Home() {
  const initial = Route.useLoaderData();
  return (
    <AppShell tab="home">
      <CustomerHomeBody
        advisors={initial.advisors}
        categories={initial.categories}
        previewLayout={initial.previewLayout}
      />
    </AppShell>
  );
}

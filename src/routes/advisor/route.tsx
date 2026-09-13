import { createFileRoute } from "@tanstack/react-router";
import { AdvisorLayout } from "@/components/advisor-shell";

export const Route = createFileRoute("/advisor")({
  component: AdvisorLayout,
  errorComponent: ({ error }) => (
    <main className="mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
      <h1 className="font-display text-3xl">Advisor page error</h1>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <a href="/advisor/signup" className="mt-6 inline-block text-primary">
        Apply as Advisor
      </a>
    </main>
  ),
});

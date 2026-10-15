import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PremiumHub } from "@/components/premium-tools";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/spirit/")({ component: SpiritHome });

function SpiritHome() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell tab="you">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-3xl bg-elevated" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <AppShell tab="you">
      <PremiumHub />
    </AppShell>
  );
}

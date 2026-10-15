import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import {
  AffirmTool,
  BadgeTool,
  LoveTool,
  MoodTool,
  MoonTool,
  PickTool,
  QueueTool,
  TarotTool,
  TimelineTool,
  VaultTool,
} from "@/components/premium-tools";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const TOOLS = ["love", "tarot", "pick", "moon", "affirm", "timeline", "mood", "badges", "vault", "queue"] as const;

export const Route = createFileRoute("/spirit/$tool")({
  validateSearch: (search: Record<string, unknown>) => ({
    advisor: typeof search.advisor === "string" ? search.advisor.slice(0, 80) : "",
  }),
  component: SpiritToolPage,
});

function SpiritToolPage() {
  const { tool } = Route.useParams();
  const { advisor } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell tab="you">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-3xl bg-elevated" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!TOOLS.includes(tool as (typeof TOOLS)[number])) {
    return (
      <AppShell tab="you">
        <p className="px-4 py-16 text-sm text-muted">That tool is not on Ora.</p>
      </AppShell>
    );
  }
  return (
    <AppShell tab="you">
      {tool === "love" ? <LoveTool /> : null}
      {tool === "tarot" ? <TarotTool /> : null}
      {tool === "pick" ? <PickTool /> : null}
      {tool === "moon" ? <MoonTool /> : null}
      {tool === "affirm" ? <AffirmTool /> : null}
      {tool === "timeline" ? <TimelineTool /> : null}
      {tool === "mood" ? <MoodTool /> : null}
      {tool === "badges" ? <BadgeTool /> : null}
      {tool === "vault" ? <VaultTool /> : null}
      {tool === "queue" ? <QueueTool advisor={advisor} /> : null}
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { AdvisorPageHeader } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/advisor/inbox")({ component: InboxPage });

function InboxPage() {
  return (
    <main>
      <AdvisorPageHeader
        title="Inbox"
        description="Client outreach and follow-up messages will live here in a later phase."
      />
      <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="text-sm text-muted">Inbox outreach is not enabled yet. Incoming paid chats are in Live Text Readings.</p>
        <Button asChild className="mt-4">
          <Link to="/advisor/readings" preload={false}>
            Open live readings
          </Link>
        </Button>
      </div>
    </main>
  );
}

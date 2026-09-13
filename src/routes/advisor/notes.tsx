import { createFileRoute } from "@tanstack/react-router";
import { AdvisorPageHeader } from "@/components/advisor-shell";

export const Route = createFileRoute("/advisor/notes")({ component: NotesPage });

function NotesPage() {
  return (
    <main>
      <AdvisorPageHeader
        title="Private Notes"
        description="Private client notes will be added in a later phase. Nothing here is visible to customers."
      />
      <div className="rounded-xl bg-surface p-5 text-sm text-muted shadow-[var(--shadow-border)]">
        Note-taking is not enabled yet.
      </div>
    </main>
  );
}

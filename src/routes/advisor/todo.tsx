import { createFileRoute } from "@tanstack/react-router";
import { AdvisorPageHeader } from "@/components/advisor-shell";

export const Route = createFileRoute("/advisor/todo")({ component: TodoPage });

function TodoPage() {
  return (
    <main>
      <AdvisorPageHeader
        title="Things To Do"
        description="Reminders and follow-ups will appear here in a later phase."
      />
      <div className="rounded-2xl bg-surface p-5 text-sm text-muted shadow-[var(--shadow-border)]">
        Tasks are not enabled yet.
      </div>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { AdvisorPageHeader } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/advisor/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <main>
      <AdvisorPageHeader
        title="Settings"
        description="Desk preferences will expand here later. Profile photo, rate, and bio stay on Profile."
      />
      <div className="space-y-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="text-sm text-muted">Use Profile to edit your public advisor listing. Use the header toggle to go online or offline.</p>
        <Button asChild>
          <Link to="/advisor/profile" preload={false}>
            Open profile
          </Link>
        </Button>
      </div>
    </main>
  );
}

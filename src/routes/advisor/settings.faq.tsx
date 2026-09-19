import { createFileRoute, Link } from "@tanstack/react-router";
import { ADVISOR_FAQ } from "@/lib/ora-advisor-desk-stats";

export const Route = createFileRoute("/advisor/settings/faq")({ component: FaqPage });

function FaqPage() {
  return (
    <main className="space-y-4">
      <Link to="/advisor/settings" preload={false} className="text-sm text-primary">
        Back to Settings
      </Link>
      <ul className="space-y-2">
        {ADVISOR_FAQ.map((item) => (
          <li key={item.q} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="font-medium">{item.q}</p>
            <p className="mt-2 text-sm text-muted">{item.a}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

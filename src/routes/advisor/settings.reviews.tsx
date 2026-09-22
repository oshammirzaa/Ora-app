import { createFileRoute, Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/advisor-desk";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listAdvisorReviews } from "@/lib/ora-advisor-desk";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/settings/reviews")({ component: ReviewsPage });

function ReviewsPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdvisorReviews>>["reviews"]>([]);

  useEffect(() => {
    if (!user) return;
    void listAdvisorReviews()
      .then((d) => setRows(d.reviews))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load reviews"));
  }, [user]);

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  return (
    <main className="space-y-4">
      <Link to="/advisor/settings" preload={false} className="text-sm text-primary">
        Back to Settings
      </Link>
      <p className="text-sm text-muted">Ratings from completed live text chats. Hidden reviews are not shown.</p>
      {!rows.length ? (
        <EmptyState title="No reviews yet" body="When a client rates a finished reading, it will appear here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row: any) => (
            <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="inline-flex items-center gap-1 text-sm text-primary">
                <Star className="size-3.5 fill-primary" />
                {row.rating.toFixed(1)}
                <span className="text-xs text-faint">· {formatWhen(row.at)}</span>
              </p>
              <p className="mt-2 text-sm text-muted">{row.body || "No written comment."}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

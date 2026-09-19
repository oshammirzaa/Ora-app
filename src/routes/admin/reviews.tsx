import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Stat, EmptyNote } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/ora";
import { adminModerateReview, adminReviews } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/reviews")({ component: ReviewsPage });

function ReviewsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminReviews>> | null>(null);

  async function load() {
    setData(await adminReviews({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setData({ reviews: [], stats: { total: 0, visible: 0, hidden: 0, average: 0 } }));
  }, []);

  const rows = data?.reviews ?? [];
  const stats = data?.stats;

  return (
    <main>
      <PageHeader
        title="Reviews"
        description="Genuine customer ratings. Recommended Psychics uses review performance. Trusted Psychics conversion ranking is separate."
      />
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Reviews" value={String(stats.total)} tone="primary" />
          <Stat label="Visible" value={String(stats.visible)} tone="ok" />
          <Stat label="Hidden" value={String(stats.hidden)} tone="warn" />
          <Stat label="Average" value={stats.visible ? stats.average.toFixed(2) : "—"} tone="gold" />
        </div>
      ) : null}
      <ul className="mt-6 space-y-2">
        {!rows.length ? (
          <li>
            <EmptyNote>No ratings yet.</EmptyNote>
          </li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="text-sm">
                {r.rating}/5 · {r.advisor} · {r.client}
                {r.hidden ? " · hidden" : ""}
              </p>
              {r.body ? <p className="mt-1 text-sm text-muted">{r.body}</p> : null}
              <p className="mt-1 text-xs text-faint">{formatWhen(r.createdAt)}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  void adminModerateReview({ data: { id: r.id, hidden: !r.hidden } })
                    .then(() => {
                      toast.success(r.hidden ? "Restored." : "Hidden.");
                      return load();
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Could not moderate"))
                }
              >
                {r.hidden ? "Restore" : "Hide"}
              </Button>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

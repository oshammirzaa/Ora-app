import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/ora";
import { adminModerateReview, adminReviews } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/reviews")({ component: ReviewsPage });

function ReviewsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminReviews>>>([]);

  async function load() {
    setRows(await adminReviews({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, []);

  return (
    <main>
      <h1 className="font-display text-3xl">Reviews</h1>
      <p className="mt-1 text-sm text-muted">Hide a rating from the advisor profile. Hidden reviews drop out of the average.</p>
      <ul className="mt-6 space-y-2">
        {!rows.length ? (
          <li className="text-sm text-muted">No ratings yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
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

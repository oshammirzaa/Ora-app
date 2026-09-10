import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cancelRequest, getRequest } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/wait/$id")({ component: WaitPage });

function WaitPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");

  useVisibleInterval(
    () =>
      getRequest({ data: { id } }).then((r) => {
        setStatus(r.status);
        if (r.status === "accepted" && r.readingId) {
          void navigate({ to: "/reading/$id", params: { id: r.readingId } });
        }
      }),
    2500,
    Boolean(user),
  );

  if (isPending) {
    return (
      <AppShell tab="home">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const waiting = status === "pending";

  return (
    <AppShell tab="home">
      <main className="px-4 py-16 text-center">
        <p className="text-xs tracking-wide text-faint uppercase">Waiting</p>
        <h1 className="mt-2 font-display text-3xl">
          {status === "declined" || status === "expired" || status === "missing"
            ? "They could not take this one"
            : "Advisor is reviewing your request"}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {waiting ? "Stay here. Billing starts only when they accept." : "Choose another advisor on the floor."}
        </p>
        {waiting ? (
          <>
            <p className="mt-8 text-sm text-faint">Usually under a minute.</p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                void cancelRequest({ data: { id } })
                  .then(() => navigate({ to: "/" }))
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Could not cancel"));
              }}
            >
              Cancel request
            </Button>
          </>
        ) : (
          <Button asChild className="mt-8">
            <Link to="/" preload={false}>
              Back to advisors
            </Link>
          </Button>
        )}
      </main>
    </AppShell>
  );
}

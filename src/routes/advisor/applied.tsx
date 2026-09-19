import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OraMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorEntryState } from "@/lib/ora-advisor";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/applied")({ component: AppliedPage });

function AppliedPage() {
  const { user, isPending } = useCurrentUserState();
  const [entry, setEntry] = useState<Awaited<ReturnType<typeof advisorEntryState>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void advisorEntryState()
      .then((next) => {
        if (!alive) return;
        setEntry(next);
        setError("");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load application status.");
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (isPending) {
    return (
      <div className="ora-canvas min-h-dvh bg-bg p-8 text-fg">
        <div className="h-40 animate-pulse rounded-xl bg-elevated" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn to="/advisor/signup" />;

  const app = entry?.application;
  const pending = entry?.kind === "pending";
  const live = entry?.kind === "live";

  return (
    <main className="ora-canvas mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
      <OraMark />
      <h1 className="mt-8 font-display text-3xl">
        {live ? "You are approved" : pending ? "Application received" : "Advisor application"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {error
          ? error
          : live
            ? "Your desk is ready. Sign in to the advisor panel to go online."
            : pending
              ? "Saved as pending. The owner reviews applications before anyone can go live."
              : entry
                ? "Submit an application to be reviewed by the owner."
                : "Loading application status…"}
      </p>
      {app ? (
        <div className="mt-6 rounded-2xl bg-surface p-5 text-sm shadow-[var(--shadow-border)]">
          <p className="font-medium">{app.legalName || app.name}</p>
          <p className="mt-1 text-muted">
            {app.email} · {app.phone} · {app.country}
          </p>
          <p className="mt-1 text-muted">
            {app.specialties} · {app.years} yrs · {app.rateCoins}c/min
          </p>
          <p className="mt-1 text-faint">
            {app.availability}
            {app.createdAt ? ` · sent ${formatWhen(app.createdAt)}` : ""}
          </p>
          <p className="mt-3 text-xs tracking-wide text-primary uppercase">{app.status}</p>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-6 space-y-3">
        {live ? (
          <Button asChild className="w-full">
            <Link to="/advisor">Open advisor desk</Link>
          </Button>
        ) : null}
        {!pending && !live ? (
          <Button asChild className="w-full">
            <Link to="/advisor/signup">Apply as Advisor</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link to="/">Back to readings</Link>
        </Button>
      </div>
    </main>
  );
}

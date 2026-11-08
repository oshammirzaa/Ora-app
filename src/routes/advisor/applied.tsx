import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { OraMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  emptyIdentityDraft,
  GovernmentIdentityFields,
  identityPayload,
  type IdentityDraft,
} from "@/components/government-identity-fields";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorEntryState } from "@/lib/ora-advisor";
import { formatWhen } from "@/lib/ora";
import { idNeedsBack, identityFormError, idTypeLabel } from "@/lib/ora-identity";
import { uploadIdentityDocuments } from "@/lib/ora-identity-file";
import { applicantIdentityState, submitApplicantIdentity } from "@/lib/ora-identity-store";
import { useAccountHomeLink, useMarketingWebsite } from "@/lib/use-account-home";

export const Route = createFileRoute("/advisor/applied")({ component: AppliedPage });

function AppliedPage() {
  const website = useMarketingWebsite();
  const { user, isPending } = useCurrentUserState();
  const home = useAccountHomeLink();
  const [entry, setEntry] = useState<Awaited<ReturnType<typeof advisorEntryState>> | null>(null);
  const [identity, setIdentity] = useState<Awaited<ReturnType<typeof applicantIdentityState>> | undefined>(undefined);
  const [draft, setDraft] = useState<IdentityDraft>(emptyIdentityDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([advisorEntryState(), applicantIdentityState()])
      .then(([next, idState]) => {
        if (!alive) return;
        setEntry(next);
        setIdentity(idState);
        setDraft((current) => ({
          ...current,
          country: current.country || "",
        }));
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
  const idLabel = identity?.status === "verified" ? "Verified" : identity?.status === "rejected" ? "Rejected" : identity?.status === "pending" ? "Pending Verification" : "Not submitted";
  const needsId = !live && (identity === null || identity?.status === "rejected" || (identity?.status === "pending" && !identity.complete));

  async function sendIdentity() {
    const idError = identityFormError({
      legalName: app?.legalName || "",
      country: draft.country,
      idType: draft.idType,
      consent: draft.consent,
      front: draft.front,
      back: idNeedsBack(draft.idType) ? draft.back : null,
      selfie: draft.selfie,
      holding: draft.holding,
    });
    if (idError) {
      setError(idError);
      toast.error(idError);
      return;
    }
    setBusy(true);
    try {
      let checkId = identity && identity.status === "pending" && !identity.complete ? identity.id : "";
      if (!checkId) {
        const opened = await submitApplicantIdentity({ data: identityPayload(draft, app?.legalName || "") });
        checkId = opened.id;
      }
      await uploadIdentityDocuments(checkId, {
        front: draft.front,
        back: idNeedsBack(draft.idType) ? draft.back : null,
        selfie: draft.selfie,
        holding: draft.holding,
      });
      setIdentity(await applicantIdentityState());
      toast.success("Identity documents sent for review.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send identity documents.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ora-canvas mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
      <OraMark lockup />
      <h1 className="mt-8 font-display text-3xl">
        {live ? "You are approved" : pending ? "Application received" : "Advisor application"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {error
          ? error
          : live
            ? "Your desk is ready. Sign in to the advisor panel to go online."
            : pending
              ? "Saved as Pending Verification. The profile stays private until an admin approves the application and the government ID."
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
          <p className="mt-3 text-xs tracking-wide text-primary uppercase">{pending ? "Pending Verification" : app.status}</p>
          <p className="mt-2 text-xs text-muted">
            Government ID: {idLabel}
            {identity?.idType ? ` · ${idTypeLabel(identity.idType)}` : ""}
            {identity?.status === "rejected" && identity.rejectionReason ? ` · ${identity.rejectionReason}` : ""}
          </p>
        </div>
      ) : null}
      {needsId && (pending || app) ? (
        <div className="mt-4 space-y-3">
          <GovernmentIdentityFields draft={draft} onChange={setDraft} onFileError={(message) => setError(message)} />
          <Button className="w-full" disabled={busy} onClick={() => void sendIdentity()}>
            {busy ? "Sending…" : "Submit identity documents"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-6 space-y-3">
        {live ? (
          <Button asChild className="w-full">
            <Link to="/advisor">Open advisor desk</Link>
          </Button>
        ) : null}
        {website && !pending && !live ? (
          <Button asChild className="w-full">
            <Link to="/advisor/signup">Apply as Advisor</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link to={home.to} onClick={home.onClick}>Back to readings</Link>
        </Button>
      </div>
    </main>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen } from "@/lib/ora";
import { adminAdvisors } from "@/lib/ora-admin";
import { idSideLabel, idTypeLabel } from "@/lib/ora-identity";
import { adminDeleteIdentityFile, adminIdentityFile, adminReviewIdentity } from "@/lib/ora-identity-store";
import { applicationBucket } from "@/lib/ora-advisor-auth";
import { readingListingLabels } from "@/lib/ora-reading-listings";
import { cn } from "@/lib/utils";

type AppRow = Awaited<ReturnType<typeof adminAdvisors>>["applications"][number];

function IdentityReview({
  identity,
  onReload,
}: {
  identity: AppRow["identity"];
  onReload: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [doc, setDoc] = useState<{ title: string; mime: string; url: string } | null>(null);
  const [busy, setBusy] = useState("");
  if (!identity) {
    return <p className="mt-2 text-xs text-faint">No identity record. Profiles approved before ID collection are not held.</p>;
  }
  const record = identity;
  const statusLabel = identity.status === "verified" ? "Verified" : identity.status === "rejected" ? "Rejected" : "Pending Verification";

  async function viewFile(fileId: string, title: string) {
    setBusy(fileId);
    try {
      const file = await adminIdentityFile({ data: { fileId } });
      setDoc({ title, mime: file.mime, url: `data:${file.mime};base64,${file.base64}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open that document.");
    } finally {
      setBusy("");
    }
  }

  async function review(decision: "verified" | "rejected") {
    if (decision === "rejected" && !reason.trim()) {
      toast.error("Enter a rejection reason.");
      return;
    }
    setBusy(decision);
    try {
      await adminReviewIdentity({ data: { checkId: record.id, decision, reason } });
      toast.success(decision === "verified" ? "Identity marked verified." : "Identity rejected. The advisor was notified.");
      setReason("");
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update identity.");
    } finally {
      setBusy("");
    }
  }

  async function removeFile(fileId: string) {
    setBusy(fileId);
    try {
      await adminDeleteIdentityFile({ data: { fileId } });
      toast.success("Stored identity file deleted.");
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete that file.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-bg p-3">
      <p className="text-xs tracking-wide text-faint uppercase">Advisor Identity Verification</p>
      <p className="mt-1 text-sm">
        {identity.legalName || "—"} · {identity.country || "—"} · {idTypeLabel(identity.idType) || identity.idType}
      </p>
      <p
        className={cn(
          "mt-1 text-xs font-medium",
          identity.status === "verified" && "text-ok",
          identity.status === "rejected" && "text-danger",
          identity.status === "pending" && "text-warn",
        )}
      >
        {statusLabel}
      </p>
      {identity.rejectionReason ? <p className="mt-1 text-xs text-danger">{identity.rejectionReason}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {identity.files.map((file) => (
          <span key={file.id} className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy === file.id} onClick={() => void viewFile(file.id, idSideLabel(file.side))}>
              View {idSideLabel(file.side)}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy === file.id} onClick={() => void removeFile(file.id)}>
              Delete {file.side}
            </Button>
          </span>
        ))}
        {!identity.files.length ? <p className="text-xs text-faint">No document is stored.</p> : null}
      </div>
      {identity.status !== "verified" ? (
        <div className="mt-3 space-y-2">
          <Label htmlFor={`reason-${identity.id}`}>Rejection reason</Label>
          <Textarea id={`reason-${identity.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required if you reject" />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy === "verified"} onClick={() => void review("verified")}>
              Verify identity
            </Button>
            <Button size="sm" variant="outline" disabled={busy === "rejected"} onClick={() => void review("rejected")}>
              Reject identity
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Label htmlFor={`reason-${identity.id}`}>Rejection reason</Label>
          <Textarea id={`reason-${identity.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required to revoke verification" />
          <Button size="sm" variant="outline" disabled={busy === "rejected"} onClick={() => void review("rejected")}>
            Reject identity
          </Button>
        </div>
      )}
      <Dialog open={Boolean(doc)} onOpenChange={(open) => { if (!open) setDoc(null); }}>
        <DialogContent className="w-[min(100%-1.5rem,40rem)]">
          <DialogHeader>
            <DialogTitle>Government ID · {doc?.title}</DialogTitle>
            <DialogDescription>Visible only to authorized admins. This file is not public.</DialogDescription>
          </DialogHeader>
          {doc?.mime === "application/pdf" ? (
            <iframe title="Government ID" src={doc.url} className="mt-3 h-[70vh] w-full rounded-md bg-white" />
          ) : doc ? (
            <img src={doc.url} alt="" className="mt-3 max-h-[70vh] w-full rounded-md object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ApplicationList({
  apps,
  empty,
  onDecide,
  onReload,
}: {
  apps: AppRow[];
  empty: string;
  onDecide?: (id: string, decision: "approved" | "rejected", reason: string) => void;
  onReload: () => Promise<void>;
}) {
  if (!apps.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {apps.map((a) => (
        <li key={a.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex gap-3">
            {a.photo_url ? <img src={a.photo_url} alt="" className="size-16 rounded-md object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {a.legal_name || a.name}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    applicationBucket(a.status) === "pending" && "bg-warn/15 text-warn",
                    applicationBucket(a.status) === "approved" && "bg-ok/15 text-ok",
                    applicationBucket(a.status) === "rejected" && "bg-danger/15 text-danger",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      applicationBucket(a.status) === "pending" && "bg-warn",
                      applicationBucket(a.status) === "approved" && "bg-ok",
                      applicationBucket(a.status) === "rejected" && "bg-danger",
                    )}
                  />
                  {applicationBucket(a.status) === "pending" ? "Pending Verification" : a.status}
                </span>
              </p>
              <p className="text-xs text-faint">
                Submitted {formatWhen(a.created_at)}
                {a.decided_at ? ` · decided ${formatWhen(a.decided_at)}` : ""}
                {a.email ? ` · ${a.email}` : ""}
                {a.phone ? ` · ${a.phone}` : ""}
                {a.country ? ` · ${a.country}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">
                Specialties: {a.specialties || "—"} · {a.languages || "English"} · requested {a.rate_coins}c/min · {a.years} yrs
              </p>
              <p className="mt-1 text-sm text-muted">
                Reading listings: {readingListingLabels(a.listing_categories).join(" · ") || "Not assigned yet"}
              </p>
              <p className="mt-1 text-sm text-muted">{a.experience || a.bio}</p>
              {a.availability ? <p className="mt-1 text-xs text-faint">Availability: {a.availability}</p> : null}
              <IdentityReview identity={a.identity} onReload={onReload} />
              {a.status === "pending" && onDecide ? (
                <RejectActions id={a.id} onDecide={onDecide} />
              ) : a.decision_note ? (
                <p className="mt-2 text-xs text-muted">Internal note: {a.decision_note}</p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RejectActions({
  id,
  onDecide,
}: {
  id: string;
  onDecide: (id: string, decision: "approved" | "rejected", reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 space-y-2">
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional internal rejection note" />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void Promise.resolve(onDecide(id, "approved", "")).finally(() => setBusy(false));
          }}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void Promise.resolve(onDecide(id, "rejected", reason.trim())).finally(() => setBusy(false));
          }}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

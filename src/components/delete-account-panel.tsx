import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/auth/client";
import { deleteMyAccount } from "@/lib/ora-account-deletion-api";
import {
  ACCOUNT_DELETION_PHRASE,
  DELETION_REMOVED,
  DELETION_RETAINED,
  PAYMENT_RETENTION,
  SAFETY_RETENTION,
} from "@/lib/ora-account-deletion";

export function DeleteAccountDisclosure() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted">
      <p>Deleting your Ora Psychic customer account is permanent. You will be signed out, and this account cannot be used again.</p>
      <div>
        <p className="font-medium text-fg">Removed when the request completes</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {DELETION_REMOVED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-fg">Kept, and for how long</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {DELETION_RETAINED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-2">
          Payment records are kept for {PAYMENT_RETENTION}. Safety records are kept for {SAFETY_RETENTION}. Nothing here is deleted immediately if it is in that list.
        </p>
      </div>
      <p>Ora readings are entertainment only. They are not medical, legal, or financial advice.</p>
    </div>
  );
}

/** Two steps. The first only opens the final confirmation. Nothing is deleted on one tap. */
export function DeleteAccountPanel({ embedded = false }: { embedded?: boolean }) {
  const [step, setStep] = useState<0 | 1 | 2>(embedded ? 1 : 0);
  const [phrase, setPhrase] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || step !== 2 || !ack || phrase.trim() !== ACCOUNT_DELETION_PHRASE) return;
    setBusy(true);
    try {
      await deleteMyAccount({ data: { acknowledged: true, confirmation: phrase.trim() } });
      toast.success("Account deleted.");
      try {
        await signOut("/");
      } catch {
        window.location.href = "/";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete this account");
      setBusy(false);
    }
  }

  if (step === 0) {
    return (
      <div className="mt-8 border-t border-border pt-6">
        <h2 className="font-display text-xl text-fg">Delete account</h2>
        <p className="mt-1 text-sm text-muted">Permanently close this customer account and sign out everywhere.</p>
        <Button type="button" variant="outline" className="mt-3 text-danger" onClick={() => setStep(1)}>
          Delete account
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h2 className="font-display text-xl text-fg">Delete account</h2>
      <div className="mt-3">{embedded ? null : <DeleteAccountDisclosure />}</div>
      {step === 1 ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setStep(0)}>
            Cancel
          </Button>
          <Button type="button" className="text-primary-fg" onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
          <p className="text-sm text-fg">Confirm again. This submits the deletion.</p>
          <label className="flex items-start gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="mt-1"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>I understand this is permanent and I want to delete my Ora account.</span>
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="delete-phrase">Type DELETE</Label>
            <Input
              id="delete-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Type DELETE to confirm"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              type="submit"
              disabled={busy || !ack || phrase.trim() !== ACCOUNT_DELETION_PHRASE}
              className="bg-danger text-primary-fg hover:bg-danger/90"
            >
              {busy ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

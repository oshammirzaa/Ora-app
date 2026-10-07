import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/auth/client";
import { adminViewAsStatus } from "@/lib/ora-admin-advisor-ops";
import { ACCOUNT_DELETION_PHRASE } from "@/lib/ora-account-deletion";
import { deleteMyAdvisorAccount } from "@/lib/ora-advisor-deletion-api";

/** Two confirmations. Nothing is deleted until DELETE is typed and the server accepts it. */
export function AdvisorDeleteAccount() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    void adminViewAsStatus()
      .then((state) => setViewing(state.active))
      .catch(() => setViewing(false));
  }, []);

  function close() {
    if (busy) return;
    setOpen(false);
    setStep(1);
    setPhrase("");
  }

  async function remove() {
    if (busy || phrase.trim() !== ACCOUNT_DELETION_PHRASE) return;
    setBusy(true);
    try {
      await deleteMyAdvisorAccount({ data: { acknowledged: true, confirmation: phrase.trim() } });
      toast.success("Advisor account deleted.");
      try {
        await signOut("/advisor/login");
      } catch {
        window.location.href = "/advisor/login";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete this account");
      setBusy(false);
    }
  }

  if (viewing) return null;

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="font-display text-xl text-fg">Delete Account</h2>
      <p className="mt-1 text-sm text-muted">Permanently close this advisor account. Readings and payout records stay for accounting.</p>
      <Button type="button" variant="outline" className="mt-3 text-danger" onClick={() => setOpen(true)}>
        Delete Account
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent>
          {step === 1 ? (
            <>
              <DialogTitle>Delete your advisor account?</DialogTitle>
              <DialogDescription>
                This action will permanently close your advisor account. You will no longer be able to access your advisor profile.
              </DialogDescription>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle>Type DELETE to confirm</DialogTitle>
              <DialogDescription>This closes the account and signs you out. It cannot be undone.</DialogDescription>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="advisor-delete-phrase">Confirmation</Label>
                <Input
                  id="advisor-delete-phrase"
                  value={phrase}
                  autoComplete="off"
                  onChange={(event) => setPhrase(event.target.value)}
                  placeholder="DELETE"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-danger text-white hover:bg-danger/90"
                  disabled={busy || phrase.trim() !== ACCOUNT_DELETION_PHRASE}
                  onClick={() => void remove()}
                >
                  {busy ? "Deleting…" : "Delete Account Permanently"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

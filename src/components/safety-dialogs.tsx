import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reportAdvisorClient } from "@/lib/ora-advisor-desk";
import { reportCustomerAdvisor } from "@/lib/ora-safety-api";
import { SAFETY_REPORT_REASONS, type SafetyReportReason } from "@/lib/ora-safety";
import { cn } from "@/lib/utils";

export function BlockConfirmDialog({
  open,
  name,
  blocking,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  blocking: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{blocking ? `Block ${name}?` : `Unblock ${name}?`}</DialogTitle>
        <p className="mt-2 text-sm text-muted">
          {blocking
            ? "Blocked users cannot start new messages or live readings with each other. Past chats, notes, and payments stay in history."
            : "They will be able to start new messages and live readings with you again."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void go()}>
            {busy ? "Saving…" : blocking ? "Block" : "Unblock"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SafetyReportDialog({
  open,
  name,
  advisorId,
  customerId,
  readingId,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  advisorId?: string;
  customerId?: string;
  readingId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<SafetyReportReason>("harassment");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("harassment");
    setBody("");
  }, [open, advisorId, customerId]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      if (customerId) {
        await reportAdvisorClient({ data: { customerId, kind: "report", reason, body, readingId: readingId || "" } });
      } else if (advisorId) {
        await reportCustomerAdvisor({ data: { advisorId, reason, body, readingId: readingId || "" } });
      } else {
        throw new Error("Choose who to report.");
      }
      toast.success("Report sent to Ora admin. They will not see that you reported them.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Report · {name}</DialogTitle>
        <p className="text-xs text-faint">Private to Ora admin. The other person will not see this report.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAFETY_REPORT_REASONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setReason(item.id)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3 text-sm",
                reason === item.id ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Textarea
          className="mt-3"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional description"
        />
        <Button className="mt-3 w-full" disabled={saving} onClick={() => void save()}>
          {saving ? "Sending…" : "Send report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

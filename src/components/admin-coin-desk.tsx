import { Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewCoinChange, type CoinDirection } from "@/lib/ora-admin-coins";
import { adminCoinHistory, adminManageCoins } from "@/lib/ora-admin-wallet-api";
import { formatWhen } from "@/lib/ora";
import { cn } from "@/lib/utils";

function requestId() {
  return `req_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function ManageCoinsDialog({
  userId,
  name,
  balance,
  open,
  onOpenChange,
  onChanged,
}: {
  userId: string;
  name: string;
  balance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [direction, setDirection] = useState<CoinDirection>("add");
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof adminCoinHistory>>>([]);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(requestId);

  useEffect(() => {
    if (!open || !userId) return;
    setKey(requestId());
    void adminCoinHistory({ data: { userId, t: Date.now() } })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [open, userId]);

  const preview = (() => {
    try {
      return { ok: true as const, plan: previewCoinChange(balance, direction, Number(amount)) };
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : "Check the amount." };
    }
  })();
  const reasonOk = reason.trim().length >= 4;

  async function submit() {
    if (busy || !preview.ok || !reasonOk) return;
    setBusy(true);
    try {
      const saved = await adminManageCoins({
        data: { userId, direction, amount: Number(amount), reason: reason.trim(), requestId: key },
      });
      toast.success(saved.duplicate ? "This adjustment was already saved." : `Balance is now ${saved.next} coins.`);
      setReason("");
      setKey(requestId());
      const next = await adminCoinHistory({ data: { userId, t: Date.now() } });
      setHistory(next);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(100%-1.5rem,44rem)] w-[min(100%-1.5rem,36rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage coins</DialogTitle>
          <DialogDescription>
            {name || "Customer"}. Current balance {balance} coins. The wallet updates only after you confirm.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex gap-2">
            {(["add", "deduct"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setDirection(id)}
                className={cn(
                  "inline-flex min-h-11 flex-1 items-center justify-center rounded-full text-sm capitalize",
                  direction === id ? "bg-dash-violet font-semibold text-primary" : "border border-dash-note-line bg-white text-muted",
                )}
              >
                {id}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="coin-amount">Coins</Label>
            <Input id="coin-amount" type="number" min={1} max={5000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="coin-reason">Reason</Label>
            <Input id="coin-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this balance is changing" required />
          </div>
          <div className="rounded-2xl border border-dash-violet-line bg-dash-violet px-3.5 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-primary uppercase">
              <Coins className="size-3.5" />
              Resulting balance
            </p>
            {preview.ok ? (
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {preview.plan.previous} → {preview.plan.next}
                <span className="ml-2 text-sm font-medium text-muted">
                  {preview.plan.delta > 0 ? "+" : ""}
                  {preview.plan.delta} coins
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-danger">{preview.message}</p>
            )}
          </div>
          <Button type="submit" disabled={busy || !preview.ok || !reasonOk}>
            {busy ? "Saving…" : direction === "add" ? "Confirm add" : "Confirm deduct"}
          </Button>
        </form>
        <h3 className="mt-5 font-display text-lg">Adjustment history</h3>
        <ul className="mt-2 divide-y divide-border">
          {!history.length ? (
            <li className="py-2 text-sm text-muted">No manual adjustments yet.</li>
          ) : (
            history.map((row) => (
              <li key={row.id} className="py-2 text-sm">
                <p className="font-medium capitalize">
                  {row.direction || "adjust"} · {row.coins} coins
                  {row.previous != null && row.next != null ? ` · ${row.previous} → ${row.next}` : ""}
                </p>
                <p className="text-xs text-muted">{row.reason || "No reason recorded"}</p>
                <p className="text-xs text-faint">
                  {formatWhen(row.at)}
                  {row.actorId ? ` · admin ${row.actorId}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

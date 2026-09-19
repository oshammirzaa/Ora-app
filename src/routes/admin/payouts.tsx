import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, EmptyNote } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/ora";
import { adminDecidePayout, adminPayouts } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/payouts")({ component: PayoutsPage });

function PayoutsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminPayouts>>>([]);
  const [busyId, setBusyId] = useState("");

  async function load() {
    setRows(await adminPayouts({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, []);

  async function decide(id: string, accept: boolean) {
    if (busyId) return;
    setBusyId(id);
    try {
      await adminDecidePayout({ data: { id, accept, note: accept ? "" : "Rejected" } });
      toast.success(accept ? "Marked paid." : "Rejected. Coins returned.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : accept ? "Could not pay" : "Could not reject");
    } finally {
      setBusyId("");
    }
  }

  const pending = rows.filter((r) => r.status === "requested");

  return (
    <main>
      <PageHeader
        title="Payouts"
        description="Approve or reject advisor withdrawals. Rejected coins return to the desk."
      />

      <h2 className="mt-8 font-display text-xl">Requested</h2>
      {!pending.length ? (
        <EmptyNote>None waiting.</EmptyNote>
      ) : (
        <ul className="mt-3 space-y-2">
          {pending.map((p) => (
            <li key={p.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="font-medium">
                {p.name} · {p.coins}c · ${p.usd.toFixed(2)}
              </p>
              <p className="text-xs text-faint">
                {p.id} · {formatWhen(p.createdAt)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={Boolean(busyId)} onClick={() => void decide(p.id, true)}>
                  {busyId === p.id ? "Saving…" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busyId)}
                  onClick={() => void decide(p.id, false)}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-display text-xl">History</h2>
      <ul className="mt-3 ora-rows">
        {!rows.length ? (
          <li className="px-4 py-6 text-center text-sm text-muted">No withdrawal requests yet.</li>
        ) : (
          rows.map((p) => (
            <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
              <span>
                {p.name} · {p.coins}c · ${p.usd.toFixed(2)}
                {p.note ? ` · ${p.note}` : ""}
                <span className="mt-0.5 block text-xs text-faint">
                  {p.id} · {formatWhen(p.createdAt)}
                </span>
              </span>
              <span
                className={
                  p.status === "paid"
                    ? "text-ok"
                    : p.status === "requested"
                      ? "text-warn"
                      : p.status === "rejected"
                        ? "text-danger"
                        : "text-muted"
                }
              >
                {p.status}
              </span>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

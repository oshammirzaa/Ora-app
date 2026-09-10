import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatClock, formatWhen } from "@/lib/ora";
import { adminCustomerActivity, adminCustomers, adminSetCustomer, adminAdjust } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/customers")({ component: CustomersPage });

function CustomersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);
  const [open, setOpen] = useState("");
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof adminCustomerActivity>>>([]);
  const [coins, setCoins] = useState("10");

  async function load(query = q) {
    setRows(await adminCustomers({ data: { q: query, t: Date.now() } }));
  }

  useEffect(() => {
    void load("").catch(() => setRows([]));
  }, []);

  async function openUser(id: string) {
    setOpen(id);
    setLedger(await adminCustomerActivity({ data: { userId: id, t: Date.now() } }));
  }

  return (
    <main>
      <PageHeader
        title="Customers"
        description="Search, suspend, assign owner, and inspect wallet activity."
      />
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.userId} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.email || "No email"} · {r.role} · {r.status} · {r.coins}c · promo {formatClock(r.bonusSeconds)}
                  {r.subscribed ? " · sub" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void openUser(r.userId)}>
                  Wallet
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminSetCustomer({
                      data: { userId: r.userId, status: r.status === "suspended" ? "active" : "suspended" },
                    })
                      .then(() => {
                        toast.success(r.status === "suspended" ? "Reactivated." : "Suspended.");
                        return load();
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update"))
                  }
                >
                  {r.status === "suspended" ? "Reactivate" : "Suspend"}
                </Button>
                {r.role !== "admin" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void adminSetCustomer({ data: { userId: r.userId, role: "admin" } })
                        .then(() => {
                          toast.success("Assigned as owner.");
                          return load();
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not assign"))
                    }
                  >
                    Make owner
                  </Button>
                ) : null}
              </div>
            </div>
            {open === r.userId ? (
              <div className="mt-4 border-t border-border pt-3">
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void adminAdjust({
                      data: {
                        userId: r.userId,
                        coins: Number(coins),
                        kind: "adjustment",
                        note: "Owner wallet adjustment",
                      },
                    })
                      .then(() => {
                        toast.success("Wallet updated.");
                        return Promise.all([load(), openUser(r.userId)]);
                      })
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not adjust"));
                  }}
                >
                  <Input className="w-24" type="number" value={coins} onChange={(e) => setCoins(e.target.value)} />
                  <Button size="sm" type="submit">
                    Adjust coins
                  </Button>
                </form>
                <ul className="mt-3 divide-y divide-border">
                  {!ledger.length ? (
                    <li className="py-2 text-sm text-muted">No wallet movement.</li>
                  ) : (
                    ledger.map((l) => (
                      <li key={l.id} className="flex justify-between py-2 text-sm">
                        <span>
                          {l.note}
                          <span className="mt-0.5 block text-xs text-faint">{formatWhen(l.createdAt)}</span>
                        </span>
                        <span className="tabular-nums text-primary">
                          {l.coins ? `${l.coins > 0 ? "+" : ""}${l.coins}c` : formatClock(l.seconds)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

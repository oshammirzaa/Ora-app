import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatClock, formatWhen } from "@/lib/ora";
import {
  adminAdjust,
  adminAdjustMinutes,
  adminCustomerDesk,
  adminCustomers,
  adminSetCustomer,
} from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/customers")({ component: CustomersPage });

function CustomersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);
  const [open, setOpen] = useState("");
  const [desk, setDesk] = useState<Awaited<ReturnType<typeof adminCustomerDesk>> | null>(null);
  const [coins, setCoins] = useState("10");
  const [minutes, setMinutes] = useState("3");
  const [reason, setReason] = useState("");

  async function load(query = q) {
    setRows(await adminCustomers({ data: { q: query, t: Date.now() } }));
  }

  useEffect(() => {
    void load("").catch(() => setRows([]));
  }, []);

  async function openUser(id: string) {
    setOpen(id);
    setDesk(await adminCustomerDesk({ data: { userId: id, t: Date.now() } }));
  }

  return (
    <main>
      <PageHeader
        title="Customers"
        description="Search accounts, review wallet and included minutes, inspect sittings and support, and make audited adjustments."
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
                  {r.email || "No email"} · {r.role} · {r.status} · {r.coins}c · included{" "}
                  {formatClock(r.bonusSeconds + r.weeklySeconds)}
                  {r.subscribed ? " · weekly plan" : ""}
                </p>
                <p className="mt-0.5 text-xs text-faint">Signed up {formatWhen(r.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void openUser(r.userId)}>
                  Open
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
            {open === r.userId && desk ? (
              <div className="mt-4 space-y-4 border-t border-border pt-3">
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void adminAdjust({
                      data: {
                        userId: r.userId,
                        coins: Number(coins),
                        kind: "adjustment",
                        note: reason,
                      },
                    })
                      .then(() => {
                        toast.success("Wallet updated.");
                        setReason("");
                        return Promise.all([load(), openUser(r.userId)]);
                      })
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not adjust"));
                  }}
                >
                  <Input className="w-24" type="number" value={coins} onChange={(e) => setCoins(e.target.value)} />
                  <Input
                    className="min-w-40 flex-1"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (required)"
                    required
                  />
                  <Button size="sm" type="submit">
                    Adjust coins
                  </Button>
                </form>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const secs = Math.round(Number(minutes) * 60);
                    void adminAdjustMinutes({
                      data: { userId: r.userId, seconds: secs, note: reason },
                    })
                      .then(() => {
                        toast.success("Included minutes updated.");
                        setReason("");
                        return Promise.all([load(), openUser(r.userId)]);
                      })
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not adjust"));
                  }}
                >
                  <Input
                    className="w-24"
                    type="number"
                    step="0.5"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                  <Button size="sm" type="submit" variant="outline">
                    Adjust included minutes
                  </Button>
                </form>
                <p className="text-xs text-faint">Every coin or minute change is written to the audit log with your account and timestamp.</p>

                <h3 className="font-display text-lg">Wallet</h3>
                <ul className="divide-y divide-border">
                  {!desk.ledger.length ? (
                    <li className="py-2 text-sm text-muted">No wallet movement.</li>
                  ) : (
                    desk.ledger.map((l) => (
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

                <h3 className="font-display text-lg">Sessions</h3>
                <ul className="divide-y divide-border">
                  {!desk.sessions.length ? (
                    <li className="py-2 text-sm text-muted">No sittings yet.</li>
                  ) : (
                    desk.sessions.map((s) => (
                      <li key={s.id} className="py-2 text-sm">
                        {s.status} · {s.advisor} · {formatClock(s.seconds)} · {s.coinsSpent}c
                        <span className="mt-0.5 block text-xs text-faint">{formatWhen(s.startedAt)}</span>
                      </li>
                    ))
                  )}
                </ul>

                <h3 className="font-display text-lg">Support</h3>
                <ul className="divide-y divide-border">
                  {!desk.tickets.length ? (
                    <li className="py-2 text-sm text-muted">No tickets.</li>
                  ) : (
                    desk.tickets.map((t) => (
                      <li key={t.id} className="py-2 text-sm">
                        <Link to="/admin/support/$id" params={{ id: t.id }} className="text-primary">
                          {t.ticketNo}
                        </Link>{" "}
                        · {t.status} · {t.reason}
                        <span className="mt-0.5 block text-xs text-faint">{formatWhen(t.createdAt)}</span>
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

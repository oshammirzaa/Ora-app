import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, Crown, UserRound, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ManageCoinsDialog } from "@/components/admin-coin-desk";
import { InfoNote, PageHeader, Stat, EmptyNote } from "@/components/admin-shell";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatClock, formatMoney, formatWhen } from "@/lib/ora";
import { adminAdjustMinutes, adminCustomerDesk, adminCustomers, adminSetCustomer } from "@/lib/ora-admin";
import { loyaltyLabel } from "@/lib/ora-loyalty";

export const Route = createFileRoute("/admin/customers")({ component: CustomersPage });

function CustomersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);
  const [open, setOpen] = useState("");
  const [desk, setDesk] = useState<Awaited<ReturnType<typeof adminCustomerDesk>> | null>(null);
  const [coinsFor, setCoinsFor] = useState<{ userId: string; name: string } | null>(null);
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

  const coinRow = rows.find((row) => row.userId === coinsFor?.userId);

  return (
    <main>
      <PageHeader
        icon={UserRound}
        title="Customers"
        description="Profiles, account status, wallets, memberships, and audited coin adjustments."
      />
      <InfoNote>
        Wallet and membership figures are the accounts currently loaded. Manage Coins writes the wallet and an audit row together.
      </InfoNote>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In this list" value={String(rows.length)} hint="Latest matching accounts" icon={UserRound} tone="violet" />
        <Stat
          label="Active"
          value={String(rows.filter((r) => r.status !== "suspended").length)}
          hint="Not suspended"
          tone="mint"
        />
        <Stat
          label="Suspended"
          value={String(rows.filter((r) => r.status === "suspended").length)}
          hint="Blocked accounts"
          icon={UserX}
          tone="rose"
        />
        <Stat
          label="Memberships"
          value={String(rows.filter((r) => r.subscribed).length)}
          hint="Subscribed wallets"
          icon={Crown}
          tone="sand"
        />
        <Stat
          label="Wallet coins"
          value={`${rows.reduce((sum, r) => sum + r.coins, 0)}c`}
          hint="Sum of loaded balances"
          icon={Coins}
          tone="sky"
        />
      </div>
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
        {!rows.length ? (
          <li>
            <EmptyNote>No customers match this search.</EmptyNote>
          </li>
        ) : (
          rows.map((r) => (
          <li key={r.userId} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-start gap-3">
                <Link
                  to="/admin/customer/$userId"
                  params={{ userId: r.userId }}
                  className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-dash-sand text-sm font-medium text-primary"
                  aria-label={`Open ${r.name || "customer"}`}
                >
                  {r.image ? <img src={r.image} alt="" className="size-11 object-cover" /> : (r.name || "?").trim().charAt(0).toUpperCase() || "?"}
                </Link>
                <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Link to="/admin/customer/$userId" params={{ userId: r.userId }} className="hover:text-primary">
                    <ClientNameWithBadge name={r.name || "Unnamed client"} tier={r.loyaltyTier} className="font-medium" />
                  </Link>
                  <span
                    className={
                      r.status === "suspended"
                        ? "inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger"
                        : "inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-medium text-ok"
                    }
                  >
                    <span className={r.status === "suspended" ? "size-1.5 rounded-full bg-danger" : "size-1.5 rounded-full bg-ok"} />
                    {r.status}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  {r.email || "No email"} · {r.role} · {r.coins}c · included{" "}
                  {formatClock(r.bonusSeconds + r.weeklySeconds)}
                  {r.subscribed ? " · weekly plan" : ""}
                  {r.spendCents > 0 ? ` · lifetime ${formatMoney(r.spendCents)}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-faint">Signed up {formatWhen(r.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setCoinsFor({ userId: r.userId, name: r.name })}>
                  <Coins className="size-3.5" />
                  Manage Coins
                </Button>
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
                <p className="text-sm text-muted">
                  Badge {loyaltyLabel(desk.loyaltyTier)}
                  {desk.spendCents > 0 ? ` · lifetime spend ${formatMoney(desk.spendCents)}` : " · no captured spend yet"}
                </p>
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
                    className="min-w-40 flex-1"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for included minutes"
                    required
                  />
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
                <p className="text-xs text-faint">Coin changes use Manage Coins. Included minutes stay a separate audited adjustment.</p>

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
        ))
        )}
      </ul>
      <ManageCoinsDialog
        userId={coinsFor?.userId || ""}
        name={coinsFor?.name || ""}
        balance={coinRow?.coins ?? 0}
        open={Boolean(coinsFor)}
        onOpenChange={(next) => {
          if (!next) setCoinsFor(null);
        }}
        onChanged={async () => {
          await load();
          if (coinsFor && open === coinsFor.userId) await openUser(coinsFor.userId);
        }}
      />
    </main>
  );
}

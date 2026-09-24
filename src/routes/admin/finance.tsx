import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyNote, PageHeader, Panel, Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatWhen } from "@/lib/ora";
import { adminAdjust, adminCustomers, adminFinanceBoard, adminRefundPayment } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/finance")({ component: FinancePage });

type Board = Awaited<ReturnType<typeof adminFinanceBoard>>;
type Txn = Board["transactions"][number];
type Filters = {
  range: "today" | "7d" | "30d" | "month" | "custom" | "all";
  from: string;
  to: string;
  type: string;
  customer: string;
  advisor: string;
  status: string;
};

const RANGES: { id: Filters["range"]; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
];

const TYPES = [
  "all",
  "coin purchase",
  "ora mini membership",
  "ora membership",
  "live reading",
  "paid message",
  "tip/gift",
  "advisor payout",
  "refund",
];

const STATUSES = ["all", "succeeded", "refunded", "paid", "pending", "processing", "rejected", "failed", "incomplete"];

function money(cents: number, currency: string) {
  return formatMoney(cents, currency);
}

function statusClass(status: string) {
  if (status === "succeeded" || status === "paid") return "text-ok";
  if (status === "pending" || status === "processing" || status === "incomplete") return "text-warn";
  if (status === "refunded" || status === "rejected" || status === "failed") return "text-danger";
  return "text-muted";
}

function titleCase(value: string) {
  if (!value || value === "all") return "All";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function canRefund(row: Txn) {
  return (
    row.status === "succeeded" &&
    (row.type === "coin purchase" || row.type === "ora mini membership" || row.type === "ora membership")
  );
}

function FinancePage() {
  const [filters, setFilters] = useState<Filters>({
    range: "30d",
    from: "",
    to: "",
    type: "all",
    customer: "",
    advisor: "",
    status: "all",
  });
  const [customer, setCustomer] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [people, setPeople] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Txn | null>(null);
  const [userId, setUserId] = useState("");
  const [coins, setCoins] = useState("10");
  const [kind, setKind] = useState("refund");
  const [note, setNote] = useState("");
  const [readingId, setReadingId] = useState("");

  async function load(next = filters) {
    const data = await adminFinanceBoard({ data: { ...next, t: Date.now() } });
    setBoard(data);
    setErr("");
    return data;
  }

  useEffect(() => {
    void load(filters).catch((error) => {
      setErr(error instanceof Error ? error.message : "Could not load finance");
    });
  }, [filters]);

  useEffect(() => {
    void adminCustomers({ data: { q: "", t: Date.now() } })
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);

  const summary = board?.summary;
  const currency = board?.currency || "USD";
  const mix = summary
    ? [
        { label: "Live readings", cents: summary.readingGrossCents },
        { label: "Paid messages", cents: summary.messageGrossCents },
        { label: "Tips & gifts", cents: summary.tipGrossCents },
        { label: "Coin purchases", cents: summary.coinPurchaseCents },
        { label: "Ora Mini", cents: summary.miniCents },
        { label: "Ora Membership", cents: summary.fullMembershipCents },
      ]
    : [];
  const maxMix = Math.max(1, ...mix.map((item) => item.cents));

  return (
    <main>
      <PageHeader
        title="Finance"
        description="Succeeded payments, stored earnings, and payouts. Failed checkouts are left out of sales."
      />
      {err ? <p className="mb-4 text-sm text-danger">{err}</p> : null}
      {!summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Today's gross sales" value={money(summary.grossTodayCents, currency)} hint="Succeeded payments · UTC" tone="gold" />
            <Stat label="This month's sales" value={money(summary.grossMonthCents, currency)} hint="Succeeded payments · UTC" tone="gold" />
            <Stat label="Lifetime gross sales" value={money(summary.grossLifetimeCents, currency)} hint="Succeeded payments" tone="gold" />
            <Stat label="Ora revenue" value={money(summary.oraRevenueCents, currency)} hint="Stored house share + memberships" tone="lotus" />
            <Stat label="Advisor earnings" value={money(summary.advisorEarningsCents, currency)} hint="Stored advisor share" tone="primary" />
            <Stat label="Pending payouts" value={money(summary.pendingPayoutCents, currency)} hint="Requested or processing" tone="warn" />
            <Stat label="Completed payouts" value={money(summary.completedPayoutCents, currency)} hint="Paid out · not new revenue" tone="ok" />
            <Stat label="Coin purchases" value={money(summary.coinPurchaseCents, currency)} hint="Succeeded packs" tone="blush" />
            <Stat label="Membership revenue" value={money(summary.membershipCents, currency)} hint="Mini and Ora Membership" tone="lotus" />
            <Stat label="Live reading revenue" value={money(summary.readingGrossCents, currency)} hint="Completed, not refunded" tone="primary" />
            <Stat label="Paid message revenue" value={money(summary.messageGrossCents, currency)} hint="Credited messages" tone="blush" />
            <Stat label="Tips & gifts revenue" value={money(summary.tipGrossCents, currency)} hint="Charged gifts" tone="gold" />
          </div>
          <p className="mt-3 max-w-3xl text-xs text-muted">
            Gross sales are cash collected. Readings, messages, and tips show those coins being used, so they are not added to sales again. Amounts are the stored figures. 10 coins = $1.
          </p>
        </>
      )}

      <Panel title="Revenue mix">
        {!summary ? null : mix.every((item) => item.cents === 0) ? (
          <EmptyNote>No succeeded sales or coin use yet.</EmptyNote>
        ) : (
          <ul className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            {mix.map((item) => (
              <li key={item.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted">{item.label}</span>
                  <span className="tabular-nums text-fg">{money(item.cents, currency)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((item.cents / maxMix) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Revenue breakdown">
        {!summary ? null : (
          <div className="space-y-2">
            <SplitRow
              title="Live readings"
              gross={summary.readingGrossCents}
              ora={summary.readingOraCents}
              advisor={summary.readingAdvisorCents}
              currency={currency}
              split
            />
            <SplitRow
              title="Paid messages"
              gross={summary.messageGrossCents}
              ora={summary.messageOraCents}
              advisor={summary.messageAdvisorCents}
              currency={currency}
              split
            />
            <SplitRow
              title="Tips & gifts"
              gross={summary.tipGrossCents}
              ora={summary.tipOraCents}
              advisor={summary.tipAdvisorCents}
              currency={currency}
              split
            />
            <SplitRow
              title="Coin purchases"
              gross={summary.coinPurchaseCents}
              ora={0}
              advisor={0}
              currency={currency}
              note="Cash collected. Not an advisor split, and not counted again when the coins are used."
            />
            <SplitRow
              title="Ora Mini"
              gross={summary.miniCents}
              ora={summary.miniCents}
              advisor={0}
              currency={currency}
              split
              note="Membership cash stays with Ora."
            />
            <SplitRow
              title="Ora Membership"
              gross={summary.fullMembershipCents}
              ora={summary.fullMembershipCents}
              advisor={0}
              currency={currency}
              split
              note="Membership cash stays with Ora."
            />
            <div className="rounded-2xl bg-surface px-4 py-3 text-xs text-muted shadow-[var(--shadow-border)]">
              <p>
                Cash {money(summary.grossLifetimeCents, currency)} = purchases {money(summary.coinPurchaseCents, currency)} + Mini{" "}
                {money(summary.miniCents, currency)} + Membership {money(summary.fullMembershipCents, currency)}.
              </p>
              <p className="mt-1">
                Coin use {money(summary.activityGrossCents, currency)} = Ora share {money(summary.activityOraCents, currency)} + advisor share{" "}
                {money(summary.activityAdvisorCents, currency)}.
              </p>
              <p className="mt-1">
                Ora revenue {money(summary.oraRevenueCents, currency)} = coin-use house share + membership cash. Refunds{" "}
                {money(summary.refundCents, currency)} are excluded from sales. Payouts are excluded from revenue.
              </p>
              {summary.shareGapCents !== 0 ? (
                <p className="mt-1 text-warn">
                  Stored shares differ from coin-use gross by {money(Math.abs(summary.shareGapCents), currency)}. Historical rows were not changed.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Transactions">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((range) => (
            <Button
              key={range.id}
              size="sm"
              variant={filters.range === range.id ? "default" : "outline"}
              onClick={() => setFilters((current) => ({ ...current, range: range.id }))}
            >
              {range.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filters.range === "custom" ? (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted">From</span>
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((current) => ({ ...current, from: e.target.value }))}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted">To</span>
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters((current) => ({ ...current, to: e.target.value }))}
                />
              </label>
            </>
          ) : null}
          <label className="space-y-1.5 text-sm">
            <span className="text-muted">Type</span>
            <select
              className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              value={filters.type}
              onChange={(e) => setFilters((current) => ({ ...current, type: e.target.value }))}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted">Status</span>
            <select
              className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              value={filters.status}
              onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted">Customer</span>
            <Input
              value={customer}
              placeholder="Name, email, or id"
              onChange={(e) => setCustomer(e.target.value)}
              onBlur={() => setFilters((current) => ({ ...current, customer }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilters((current) => ({ ...current, customer, advisor }));
              }}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-muted">Advisor</span>
            <Input
              value={advisor}
              placeholder="Name or id"
              onChange={(e) => setAdvisor(e.target.value)}
              onBlur={() => setFilters((current) => ({ ...current, advisor }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilters((current) => ({ ...current, customer, advisor }));
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-faint">
          {board ? `${board.matchCount} matching` : "Loading…"}
          {board && board.matchCount > board.transactions.length ? ` · showing the latest ${board.transactions.length}` : ""}
        </p>
        {!board ? (
          <div className="mt-3 h-40 animate-pulse rounded-2xl bg-elevated" />
        ) : !board.transactions.length ? (
          <EmptyNote>No transactions in this view.</EmptyNote>
        ) : (
          <ul className="mt-3 space-y-2">
            {board.transactions.map((row) => (
              <li key={`${row.type}-${row.id}`} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{titleCase(row.type)}</p>
                  <p className={`text-sm ${statusClass(row.status)}`}>{titleCase(row.status)}</p>
                </div>
                <p className="mt-1 break-all text-xs text-faint">{row.id}</p>
                <p className="mt-1 text-xs text-muted">{formatWhen(row.at)}</p>
                <p className="text-xs text-muted">
                  {row.customer || "—"}
                  {row.advisor ? ` · ${row.advisor}` : ""}
                </p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <Field label="Gross" value={money(row.grossCents, row.currency || currency)} />
                  <Field label="Ora" value={money(row.oraCents, row.currency || currency)} />
                  <Field label="Advisor" value={money(row.advisorCents, row.currency || currency)} />
                </dl>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => setOpen(row)}>
                  Details
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Refund or adjustment">
        <form
          className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            void adminAdjust({
              data: { userId, coins: Number(coins), kind, note, readingId },
            })
              .then(() => {
                toast.success("Posted.");
                setNote("");
                return load();
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "Could not post"));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="uid">Customer</Label>
              <select
                id="uid"
                className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              >
                <option value="">Choose</option>
                {people.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.name} {person.email ? `· ${person.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c">Coins (negative to debit)</Label>
              <Input id="c" type="number" value={coins} onChange={(e) => setCoins(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <select
                className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="refund">Refund</option>
                <option value="adjustment">Adjustment</option>
                <option value="gift">Gift</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rid">Reading id (optional)</Label>
              <Input id="rid" value={readingId} onChange={(e) => setReadingId(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n">Note</Label>
            <Input id="n" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit">Post</Button>
        </form>
      </Panel>

      <Panel title="Refunds and adjustments">
        <ul className="ora-rows">
          {!board?.adjustments.length ? (
            <li className="px-4 py-3 text-sm text-muted">None posted yet.</li>
          ) : (
            board.adjustments.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  {row.kind} · {row.name || row.userId}
                  {row.note ? ` · ${row.note}` : ""}
                  <span className="mt-0.5 block text-xs text-faint">{formatWhen(row.createdAt)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-primary">
                  {row.coins > 0 ? "+" : ""}
                  {row.coins}c
                </span>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent>
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle>{titleCase(open.type)}</DialogTitle>
                <DialogDescription>{titleCase(open.status)} · {formatWhen(open.at)}</DialogDescription>
              </DialogHeader>
              <dl className="space-y-2 text-sm">
                <Detail label="Transaction id" value={open.id} />
                <Detail label="Customer" value={open.customer || "—"} />
                {open.customerEmail ? <Detail label="Email" value={open.customerEmail} /> : null}
                <Detail label="Advisor" value={open.advisor || "—"} />
                <Detail label="Gross" value={money(open.grossCents, open.currency || currency)} />
                <Detail label="Ora revenue" value={money(open.oraCents, open.currency || currency)} />
                <Detail label="Advisor earning" value={money(open.advisorCents, open.currency || currency)} />
                <Detail label="Status" value={titleCase(open.status)} />
                {open.note ? <Detail label="Note" value={open.note} /> : null}
                {!open.cash && !open.activity ? (
                  <p className="text-xs text-muted">This row is not included in gross sales or Ora revenue.</p>
                ) : null}
              </dl>
              {canRefund(open) ? (
                <Button
                  className="mt-4"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminRefundPayment({ data: { id: open.id } })
                      .then((result) => {
                        toast.success(result.already ? "Already refunded." : "Payment refunded.");
                        setOpen(null);
                        return load();
                      })
                      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not refund"))
                  }
                >
                  Refund payment
                </Button>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-wide text-faint uppercase">{label}</dt>
      <dd className="break-words tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right break-all text-fg">{value}</dd>
    </div>
  );
}

function SplitRow({
  title,
  gross,
  ora,
  advisor,
  currency,
  split,
  note,
}: {
  title: string;
  gross: number;
  ora: number;
  advisor: number;
  currency: string;
  split?: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="font-medium">{title}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Field label="Gross" value={money(gross, currency)} />
        {split ? <Field label="Ora share" value={money(ora, currency)} /> : null}
        {split ? <Field label="Advisor share" value={money(advisor, currency)} /> : null}
      </dl>
      {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

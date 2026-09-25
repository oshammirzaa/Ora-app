import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyNote, PageHeader, Panel, Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen } from "@/lib/ora";
import { adminAdvisorEarningsBoard, adminAdvisorEarningsDetail, adminPayAdvisorEarnings } from "@/lib/ora-admin-earnings-api";
import { filterEarningsList, type EarningsCohort, type EarningsPeriod } from "@/lib/ora-admin-earnings";
import { formatUsdFromCents } from "@/lib/ora-paid-messages";

export const Route = createFileRoute("/admin/earnings")({ component: AdvisorEarningsPage });

type Board = Awaited<ReturnType<typeof adminAdvisorEarningsBoard>>;
type ListRow = Board["listed"][number];
type Detail = Awaited<ReturnType<typeof adminAdvisorEarningsDetail>>;

const METHODS = ["Bank transfer", "PayPal", "Wise", "Cash", "Other"] as const;
const COHORTS: { id: EarningsCohort; label: string }[] = [
  { id: "ready", label: "Ready for payout" },
  { id: "below", label: "Below $50" },
  { id: "paid", label: "Paid" },
  { id: "processing", label: "Processing" },
  { id: "held", label: "Held/Failed" },
];
const PERIODS: { id: EarningsPeriod; label: string }[] = [
  { id: "none", label: "All dates" },
  { id: "month", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "custom", label: "Custom range" },
];

function usd(cents: number) {
  const negative = cents < 0;
  const text = formatUsdFromCents(Math.abs(Math.floor(cents) || 0));
  return negative ? `-${text}` : text;
}

function centsFromDollars(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  return Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
}

function dollarInput(cents: number) {
  const amount = Math.max(0, Math.floor(cents) || 0);
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}

function statusLabel(status: ListRow["paymentStatus"]) {
  if (status === "ready") return "Ready";
  if (status === "below") return "Below $50";
  if (status === "paid") return "Paid";
  if (status === "processing") return "Processing";
  return "Held";
}

function requestKey() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function periodHeading(period: EarningsPeriod) {
  if (period === "last") return "Last month";
  if (period === "custom") return "Selected period";
  return "This month";
}

function AdvisorEarningsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [query, setQuery] = useState("");
  const [cohort, setCohort] = useState<EarningsCohort>("ready");
  const [period, setPeriod] = useState<EarningsPeriod>("none");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setError("");
    const next = await adminAdvisorEarningsBoard({ data: { t: Date.now() } });
    setBoard(next);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Could not load advisor earnings."));
  }, []);

  const rows = board ? filterEarningsList(board.listed, { query, cohort, period, from, to }) : [];

  return (
    <main>
      <PageHeader
        title="Advisor Earnings"
        description="Advisors whose unpaid share is at least $50. Figures are the advisor’s payable share, not customer spend or Ora revenue."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!board ? (
          Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-elevated" />)
        ) : (
          <>
            <Stat label="Advisor earnings this month" value={usd(board.summary.monthEarningsCents)} hint="Payable share earned this month" tone="gold" />
            <Stat label="Total unpaid advisor earnings" value={usd(board.summary.unpaidCents)} hint="Earned share minus completed payouts" tone="warn" />
            <Stat label="Advisors ready for payout" value={String(board.summary.readyCount)} hint="Unpaid balance of $50 or more" tone="primary" />
            <Stat label="Paid to advisors this month" value={usd(board.summary.paidThisMonthCents)} hint="Completed payouts this month" tone="ok" />
          </>
        )}
      </div>
      <Panel title={cohort === "below" ? "Below $50" : cohort === "ready" ? "Ready for payout" : "Advisor earnings"}>
        <div className="mb-3 flex flex-wrap gap-2">
          {COHORTS.map((item) => (
            <Button key={item.id} size="sm" variant={cohort === item.id ? "default" : "outline"} onClick={() => setCohort(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {PERIODS.map((item) => (
            <Button key={item.id} size="sm" variant={period === item.id ? "default" : "outline"} onClick={() => setPeriod(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>
        {period === "custom" ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-muted">From</span>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted">To</span>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
        ) : null}
        <Input className="mb-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, advisor ID, or email" />
        {!board ? (
          <div className="h-40 animate-pulse rounded-2xl bg-elevated" />
        ) : rows.length === 0 ? (
          <EmptyNote>
            {cohort === "ready"
              ? "No advisor has an unpaid balance of $50 or more."
              : cohort === "below"
                ? "No advisor with earnings is currently under $50."
                : "No advisors match this filter."}
          </EmptyNote>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-faint uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Advisor name</th>
                  <th className="px-3 py-3 font-medium">Advisor ID</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">{periodHeading(period)}</th>
                  <th className="px-3 py-3 font-medium">Lifetime earnings</th>
                  <th className="px-3 py-3 font-medium">Lifetime paid</th>
                  <th className="px-3 py-3 font-medium">Current unpaid</th>
                  <th className="px-3 py-3 font-medium">Ready since</th>
                  <th className="px-3 py-3 font-medium">Last payment</th>
                  <th className="px-3 py-3 font-medium">Payment status</th>
                  <th className="px-3 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/70">
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        {row.photoUrl ? <img src={row.photoUrl} alt="" className="size-9 rounded-md object-cover" /> : null}
                        <span className="font-medium">{row.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 break-all text-xs text-muted">{row.id}</td>
                    <td className="px-3 py-3 break-all text-muted">{row.email || "—"}</td>
                    <td className="px-3 py-3 tabular-nums">{usd(row.periodEarningsCents)}</td>
                    <td className="px-3 py-3 tabular-nums">{usd(row.lifetimeCents)}</td>
                    <td className="px-3 py-3 tabular-nums">{usd(row.paidCents)}</td>
                    <td className="px-3 py-3 tabular-nums font-medium">{usd(row.unpaidCents)}</td>
                    <td className="px-3 py-3 text-muted">{row.readySince ? formatWhen(row.readySince) : "—"}</td>
                    <td className="px-3 py-3 text-muted">{row.lastPaymentAt ? formatWhen(row.lastPaymentAt) : "—"}</td>
                    <td className={row.paymentStatus === "ready" ? "px-3 py-3 text-warn" : "px-3 py-3 text-muted"}>{statusLabel(row.paymentStatus)}</td>
                    <td className="px-3 py-3">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(row.id)}>
                        View details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Dialog open={Boolean(openId)} onOpenChange={(next) => { if (!next) setOpenId(""); }}>
        {openId ? (
          <EarningsDetailDialog
            advisorId={openId}
            onClose={() => setOpenId("")}
            onPaid={async () => {
              await load();
            }}
          />
        ) : null}
      </Dialog>
    </main>
  );
}

function EarningsDetailDialog({
  advisorId,
  onClose,
  onPaid,
}: {
  advisorId: string;
  onClose: () => void;
  onPaid: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [month, setMonth] = useState("");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Bank transfer");
  const [customMethod, setCustomMethod] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(requestKey);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load(nextMonth = month) {
    const result = await adminAdvisorEarningsDetail({ data: { advisorId, month: nextMonth, t: Date.now() } });
    setDetail(result);
    if (!amountTouched) setAmount(dollarInput(Math.max(0, result.unpaidCents)));
    return result;
  }

  useEffect(() => {
    void load("").catch((err) => setError(err instanceof Error ? err.message : "Could not load this advisor."));
  }, [advisorId]);

  async function pay() {
    if (!detail || busy) return;
    const amountCents = centsFromDollars(amount);
    if (amountCents == null) {
      setError("Enter the payment in dollars, such as 50.00.");
      return;
    }
    const chosen = method === "Other" ? customMethod.trim() : method;
    setBusy(true);
    setError("");
    try {
      const saved = await adminPayAdvisorEarnings({
        data: { advisorId, amountCents, method: chosen, referenceId, note, requestId },
      });
      setNotice(`Payment of ${usd(saved.paidCents)} recorded. Unpaid balance is ${usd(saved.unpaidAfter)}. Past earnings stay in the history.`);
      toast.success("Advisor payment recorded.");
      setRequestId(requestKey());
      setReferenceId("");
      setNote("");
      setAmountTouched(false);
      await load(month);
      await onPaid();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not record that payment.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const advisor = detail?.advisor;

  return (
    <DialogContent className="max-h-[min(100%-1.5rem,46rem)] w-[min(100%-1.5rem,42rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Advisor earnings</DialogTitle>
        <DialogDescription>Stored advisor share only. Paying records a payout and does not delete earlier earnings.</DialogDescription>
      </DialogHeader>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-ok">{notice}</p> : null}
      {!detail || !advisor ? (
        <div className="h-40 animate-pulse rounded-xl bg-elevated" />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            {advisor.photoUrl ? <img src={advisor.photoUrl} alt="" className="size-14 rounded-md object-cover" /> : null}
            <div className="min-w-0">
              <p className="font-medium">{advisor.name}</p>
              <p className="break-all text-xs text-muted">{advisor.id}</p>
              <p className="break-all text-xs text-muted">{advisor.email || "No email on file"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Figure label="Current unpaid balance" value={usd(detail.unpaidCents)} />
            <Figure label="This month earnings" value={usd(detail.monthEarningsCents)} />
            <Figure label="Lifetime earnings" value={usd(detail.lifetimeCents)} />
            <Figure label="Total paid" value={usd(detail.paidCents)} />
            <Figure label="Last payment date" value={detail.lastPaymentAt ? formatWhen(detail.lastPaymentAt) : "—"} />
            <Figure label="Ready since" value={detail.readySince ? formatWhen(detail.readySince) : "—"} />
          </div>
          <section>
            <h3 className="text-sm font-medium">Monthly earnings</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {detail.months.map((row) => (
                <li key={row.month} className="flex justify-between gap-3">
                  <span className="text-muted">{row.label}</span>
                  <span className="tabular-nums">{usd(row.cents)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-medium">Earnings breakdown</h3>
              <label className="text-xs text-muted">
                Month
                <select
                  className="mt-1 h-11 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                  value={detail.breakdown.month}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMonth(next);
                    void load(next).catch((err) => setError(err instanceof Error ? err.message : "Could not load that month."));
                  }}
                >
                  {detail.months.map((row) => (
                    <option key={row.month} value={row.month}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              <Breakdown label="Live reading earnings" cents={detail.breakdown.readingCents} />
              <Breakdown label="Paid message earnings" cents={detail.breakdown.messageCents} />
              <Breakdown label="Tip/gift earnings" cents={detail.breakdown.tipCents} />
              <Breakdown label="Other eligible advisor earnings" cents={detail.breakdown.otherCents} />
              <Breakdown label="Total advisor earnings" cents={detail.breakdown.totalCents} strong />
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-medium">Payment history</h3>
            {detail.payments.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No payouts recorded yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead className="text-faint uppercase">
                    <tr>
                      <th className="py-2 pr-2 font-medium">Payment ID</th>
                      <th className="py-2 pr-2 font-medium">Amount</th>
                      <th className="py-2 pr-2 font-medium">Date</th>
                      <th className="py-2 pr-2 font-medium">Method</th>
                      <th className="py-2 pr-2 font-medium">Reference</th>
                      <th className="py-2 pr-2 font-medium">Status</th>
                      <th className="py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((payment) => (
                      <tr key={payment.id} className="border-t border-border/70">
                        <td className="py-2 pr-2 break-all">{payment.id}</td>
                        <td className="py-2 pr-2 tabular-nums">{usd(payment.cents)}</td>
                        <td className="py-2 pr-2">{payment.at ? formatWhen(payment.at) : "—"}</td>
                        <td className="py-2 pr-2">{payment.method || "—"}</td>
                        <td className="py-2 pr-2 break-all">{payment.referenceId || "—"}</td>
                        <td className="py-2 pr-2 capitalize">{payment.status}</td>
                        <td className="py-2">{payment.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {detail.ready ? (
            <form
              className="space-y-3 border-t border-border pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void pay();
              }}
            >
              <h3 className="text-sm font-medium">Record payment</h3>
              <p className="text-xs text-faint">Pays up to the current unpaid balance. The same request cannot be recorded twice.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="earn-amount">Amount (USD)</Label>
                  <Input
                    id="earn-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => {
                      setAmountTouched(true);
                      setAmount(event.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="earn-method">Payment method</Label>
                  <select
                    id="earn-method"
                    className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as (typeof METHODS)[number])}
                  >
                    {METHODS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                {method === "Other" ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="earn-method-other">Method name</Label>
                    <Input id="earn-method-other" value={customMethod} onChange={(event) => setCustomMethod(event.target.value)} maxLength={40} />
                  </div>
                ) : null}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="earn-ref">Transaction / reference ID</Label>
                  <Input id="earn-ref" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} maxLength={80} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="earn-note">Admin note</Label>
                <Textarea id="earn-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Recording…" : "Record payment"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted">Unpaid balance is under $50, so this advisor is not on the payout-ready list.</p>
          )}
        </div>
      )}
    </DialogContent>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-2">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function Breakdown({ label, cents, strong = false }: { label: string; cents: number; strong?: boolean }) {
  return (
    <li className={strong ? "flex justify-between gap-3 border-t border-border pt-1 font-medium" : "flex justify-between gap-3"}>
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{usd(cents)}</span>
    </li>
  );
}

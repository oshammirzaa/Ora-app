import { Banknote, CheckCircle2, Clock, Landmark, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminAdvisorEarningsDetail } from "@/lib/ora-admin-earnings-api";
import {
  adminAdvisorPayDesk,
  adminConfirmAdvisorPayout,
  adminProcessAdvisorPayout,
  adminReleaseAdvisorPayout,
  adminReserveAdvisorPayout,
  adminSaveAdvisorPayoutMethod,
} from "@/lib/ora-admin-payout-desk";
import { payoutStatusLabel } from "@/lib/ora-admin-payouts";
import { formatUsdFromCoins } from "@/lib/ora-advisor-desk-stats";
import { formatUsdFromCents } from "@/lib/ora-paid-messages";
import { formatWhen } from "@/lib/ora";

function requestId() {
  return `req_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

const METHODS = ["Bank transfer", "PayPal", "Wise", "Other"];

export function AdvisorPayDialog({
  advisorId,
  name,
  open,
  onOpenChange,
}: {
  advisorId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [month, setMonth] = useState("");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminAdvisorEarningsDetail>> | null>(null);
  const [desk, setDesk] = useState<Awaited<ReturnType<typeof adminAdvisorPayDesk>> | null>(null);
  const [coins, setCoins] = useState("");
  const [method, setMethod] = useState("Bank transfer");
  const [customMethod, setCustomMethod] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [holder, setHolder] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [methodNotes, setMethodNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [reserveKey, setReserveKey] = useState(requestId);
  const [actionKeys, setActionKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !advisorId) return;
    setReserveKey(requestId());
    setActionKeys({});
    setDetail(null);
    setDesk(null);
    void adminAdvisorEarningsDetail({ data: { advisorId, month, t: Date.now() } })
      .then(setDetail)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load earnings."));
    void adminAdvisorPayDesk({ data: { advisorId, t: Date.now() } })
      .then((next) => {
        setDesk(next);
        if (next.method?.method) {
          if ((METHODS as readonly string[]).includes(next.method.method)) setMethod(next.method.method);
          else {
            setMethod("Other");
            setCustomMethod(next.method.method);
          }
        }
        setHolder(next.method?.holder || "");
        setAccountLabel(next.method?.accountLabel || "");
        setMethodNotes(next.method?.notes || "");
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load payouts."));
  }, [open, advisorId, month]);

  const pendingCoins = useMemo(
    () =>
      (desk?.payouts ?? [])
        .filter((row) => {
          const label = payoutStatusLabel(row.status, row.workflow);
          return label === "pending" || label === "processing";
        })
        .reduce((sum, row) => sum + row.coins, 0),
    [desk],
  );
  const processingCoins = useMemo(
    () =>
      (desk?.payouts ?? [])
        .filter((row) => payoutStatusLabel(row.status, row.workflow) === "processing")
        .reduce((sum, row) => sum + row.coins, 0),
    [desk],
  );

  const dollarPreview = formatUsdFromCoins(Math.max(0, Math.floor(Number(coins) || 0)));

  async function reload() {
    const [nextDetail, nextDesk] = await Promise.all([
      adminAdvisorEarningsDetail({ data: { advisorId, month, t: Date.now() } }),
      adminAdvisorPayDesk({ data: { advisorId, t: Date.now() } }),
    ]);
    setDetail(nextDetail);
    setDesk(nextDesk);
  }

  const chosenMethod = method === "Other" ? customMethod.trim() : method;
  const monthPayouts = (desk?.payouts ?? []).filter((row) => {
    const selected = detail?.breakdown.month || "";
    if (!selected) return false;
    return row.at.slice(0, 7) === selected || row.paidAt.slice(0, 7) === selected;
  });

  async function reserve() {
    if (busy) return;
    if (!window.confirm(`Reserve ${dollarPreview} for an external transfer? Ora will not send the money.`)) return;
    setBusy("reserve");
    try {
      await adminReserveAdvisorPayout({
        data: { advisorId, coins: Number(coins), method: chosenMethod, note, requestId: reserveKey },
      });
      toast.success("Amount reserved. Send the transfer outside Ora, then mark it paid with the reference.");
      setCoins("");
      setReserveKey(requestId());
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reserve payout.");
    } finally {
      setBusy("");
    }
  }

  async function saveMethod() {
    if (busy) return;
    setBusy("method");
    try {
      await adminSaveAdvisorPayoutMethod({
        data: { advisorId, method: chosenMethod, holder, accountLabel, notes: methodNotes },
      });
      toast.success("Payment details saved for admins only. No money was sent.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save payment details.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(100%-1.5rem,48rem)] w-[min(100%-1.5rem,44rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advisor payment details</DialogTitle>
          <DialogDescription>
            {name || "Advisor"}. Monthly and lifetime earnings stay as recorded. Ora does not send money. Mark paid only after the transfer is complete.
          </DialogDescription>
        </DialogHeader>
        {!detail || !desk ? (
          <div className="mt-4 h-28 animate-pulse rounded-2xl bg-dash-violet" />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{detail.advisor.name}</p>
              <span className="rounded-full bg-dash-mint px-2 py-0.5 text-xs font-medium text-ok capitalize">{detail.advisor.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Monthly earnings" value={formatUsdFromCents(detail.breakdown.totalCents)} hint={detail.breakdown.label} icon={Banknote} tone="violet" />
              <Stat label="Available balance" value={formatUsdFromCoins(desk.advisor.availableCoins)} hint="Unreserved payout coins" icon={Wallet} tone="mint" />
              <Stat label="Pending payout" value={formatUsdFromCoins(pendingCoins)} hint={processingCoins ? `${formatUsdFromCoins(processingCoins)} processing` : "Reserved, not sent"} icon={Clock} tone="sand" />
              <Stat label="Total paid" value={formatUsdFromCents(detail.paidCents)} hint="Confirmed transfers" icon={CheckCircle2} tone="rose" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Lifetime earnings" value={formatUsdFromCents(detail.lifetimeCents)} hint="Not reduced by payouts" tone="violet" />
              <Stat label="This month" value={formatUsdFromCents(detail.monthEarningsCents)} hint="Current calendar month" tone="sky" />
              <Stat label="Unpaid earnings" value={formatUsdFromCents(detail.unpaidCents)} hint="Earned minus paid" tone="teal" />
              <Stat label="Reserved" value={formatUsdFromCoins(pendingCoins)} hint="Held so it cannot be paid twice" tone="sand" />
            </div>
            <label className="block text-sm">
              <span className="text-muted">Month</span>
              <select
                className="mt-1 h-11 w-full rounded-2xl border border-dash-note-line bg-white px-3 text-sm"
                value={detail.breakdown.month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {detail.months.map((row) => (
                  <option key={row.month} value={row.month}>
                    {row.label} · {formatUsdFromCents(row.cents)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <p>Readings {formatUsdFromCents(detail.breakdown.readingCents)}</p>
              <p>Messages {formatUsdFromCents(detail.breakdown.messageCents)}</p>
              <p>Tips {formatUsdFromCents(detail.breakdown.tipCents)}</p>
              <p>Other {formatUsdFromCents(detail.breakdown.otherCents)}</p>
            </div>
            <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
              {detail.months.map((row) => (
                <li key={row.month} className="flex justify-between gap-2">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{formatUsdFromCents(row.cents)}</span>
                </li>
              ))}
            </ul>
            <section className="rounded-2xl border border-dash-note-line bg-dash-note p-3">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                <Landmark className="size-3.5" />
                Payment details
              </p>
              {desk.method ? (
                <div className="mt-2 rounded-2xl bg-white p-3">
                  <p className="font-medium">{desk.method.method}</p>
                  <p className="text-sm text-muted">{desk.method.holder || "No account holder"}</p>
                  <p className="text-sm text-muted">Account: {desk.method.accountLabel || "No label saved"}</p>
                  {desk.method.notes ? <p className="mt-1 text-xs text-faint">{desk.method.notes}</p> : null}
                  <p className="mt-1 text-xs text-faint">Saved by an admin. Ora has not verified this with a bank and will not send the transfer.</p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted">No payout account is saved. Record one the advisor gave you. Do not invent account numbers.</p>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="method-kind">Method</Label>
                  <select
                    id="method-kind"
                    className="mt-1 h-11 w-full rounded-2xl border border-dash-note-line bg-white px-3 text-sm"
                    value={METHODS.includes(method) ? method : "Other"}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {METHODS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                {method === "Other" ? (
                  <div>
                    <Label htmlFor="method-custom">Method name</Label>
                    <Input id="method-custom" value={customMethod} onChange={(e) => setCustomMethod(e.target.value)} />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="method-holder">Account holder</Label>
                  <Input id="method-holder" value={holder} onChange={(e) => setHolder(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="method-account">Account label</Label>
                  <Input id="method-account" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} placeholder="Last 4 or email, not a full card" />
                </div>
              </div>
              <Input className="mt-2" value={methodNotes} onChange={(e) => setMethodNotes(e.target.value)} placeholder="Private note for admins" />
              <Button className="mt-2" type="button" variant="outline" disabled={busy === "method"} onClick={() => void saveMethod()}>
                Save payment details
              </Button>
            </section>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void reserve();
              }}
            >
              <p className="text-sm font-medium">Withdraw / send payment</p>
              <p className="text-xs text-muted">Reserves the amount so it cannot be paid twice. This does not transfer money. 10 coins = $1. {coins ? dollarPreview : ""}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pay-coins">Coins</Label>
                  <Input id="pay-coins" type="number" min={1} value={coins} onChange={(e) => setCoins(e.target.value)} placeholder="Amount in coins" />
                </div>
                <div>
                  <Label htmlFor="pay-note">Note</Label>
                  <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <Button type="submit" disabled={busy === "reserve" || chosenMethod.length < 2}>
                Reserve payout
              </Button>
            </form>
            <div>
              <Label htmlFor="pay-ref">External reference, required before Mark paid</Label>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank or wallet reference" />
            </div>
            <section>
              <h3 className="font-display text-lg">Payouts in {detail.breakdown.label}</h3>
              {!monthPayouts.length ? <p className="mt-1 text-sm text-muted">No payouts recorded in this month.</p> : null}
              <PayoutList
                rows={monthPayouts}
                busy={busy}
                reference={reference}
                note={note}
                onBusy={setBusy}
                requestFor={(id, verb) => {
                  const existing = actionKeys[`${verb}:${id}`];
                  if (existing) return existing;
                  const next = requestId();
                  setActionKeys((current) => ({ ...current, [`${verb}:${id}`]: next }));
                  return next;
                }}
                reload={reload}
              />
            </section>
            <section>
              <h3 className="font-display text-lg">Payout history</h3>
              <PayoutList
                rows={desk.payouts}
                busy={busy}
                reference={reference}
                note={note}
                onBusy={setBusy}
                requestFor={(id, verb) => {
                  const existing = actionKeys[`${verb}:${id}`];
                  if (existing) return existing;
                  const next = requestId();
                  setActionKeys((current) => ({ ...current, [`${verb}:${id}`]: next }));
                  return next;
                }}
                reload={reload}
              />
            </section>
            <section>
              <h3 className="font-display text-lg">Ledger</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {!desk.ledger.length ? <li>No ledger rows yet.</li> : null}
                {desk.ledger.map((row) => (
                  <li key={row.id}>
                    {row.verb} · {formatUsdFromCoins(row.coins)} · available {row.previousAvailable} → {row.nextAvailable}
                    {row.referenceId ? ` · ${row.referenceId}` : ""} · {formatWhen(row.at)}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayoutList({
  rows,
  busy,
  reference,
  note,
  onBusy,
  requestFor,
  reload,
}: {
  rows: Awaited<ReturnType<typeof adminAdvisorPayDesk>>["payouts"];
  busy: string;
  reference: string;
  note: string;
  onBusy: (id: string) => void;
  requestFor: (id: string, verb: string) => string;
  reload: () => Promise<void>;
}) {
  if (!rows.length) return null;
  return (
    <ul className="mt-2 space-y-2">
      {rows.map((row) => {
        const label = payoutStatusLabel(row.status, row.workflow);
        const openRow = label === "pending" || label === "processing";
        return (
          <li key={row.id} className="rounded-2xl border border-dash-note-line bg-white p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium capitalize">
                  {label} · {formatUsdFromCoins(row.coins)}
                </p>
                <p className="text-xs text-muted">
                  {row.method || "No method"} · {formatWhen(row.paidAt || row.at)}
                </p>
                {row.referenceId ? <p className="text-xs text-faint">Ref {row.referenceId}</p> : null}
                {row.note ? <p className="text-xs text-muted">{row.note}</p> : null}
              </div>
              {openRow ? (
                <div className="flex flex-wrap gap-2">
                  {label === "pending" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        onBusy(row.id);
                        void adminProcessAdvisorPayout({ data: { id: row.id, requestId: requestFor(row.id, "processing") } })
                          .then(reload)
                          .catch((err) => toast.error(err instanceof Error ? err.message : "Could not update"))
                          .finally(() => onBusy(""));
                      }}
                    >
                      Processing
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={Boolean(busy) || reference.trim().length < 2}
                    onClick={() => {
                      if (!window.confirm("Mark paid only if you already sent this money outside Ora. The available balance will not be reduced again.")) return;
                      onBusy(row.id);
                      void adminConfirmAdvisorPayout({
                        data: { id: row.id, referenceId: reference, note, requestId: requestFor(row.id, "confirm") },
                      })
                        .then(() => {
                          toast.success("Marked paid. Available balance was not reduced again.");
                          return reload();
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Could not confirm"))
                        .finally(() => onBusy(""));
                    }}
                  >
                    Mark paid
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (!window.confirm("Cancel this reservation and return the coins to the available balance?")) return;
                      onBusy(row.id);
                      void adminReleaseAdvisorPayout({ data: { id: row.id, note, requestId: requestFor(row.id, "release") } })
                        .then(() => {
                          toast.success("Reservation released.");
                          return reload();
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Could not release"))
                        .finally(() => onBusy(""));
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

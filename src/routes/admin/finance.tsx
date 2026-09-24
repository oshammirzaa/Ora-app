import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhen } from "@/lib/ora";
import { formatCoinUnitsFromCents } from "@/lib/ora-paid-messages";
import { adminAdjust, adminCustomers, adminFinance, adminRefundPayment, formatMoney } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/finance")({ component: FinancePage });

function FinancePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminFinance>> | null>(null);
  const [userId, setUserId] = useState("");
  const [coins, setCoins] = useState("10");
  const [kind, setKind] = useState("refund");
  const [note, setNote] = useState("");
  const [readingId, setReadingId] = useState("");
  const [people, setPeople] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);

  async function load() {
    const [next, list] = await Promise.all([
      adminFinance({ data: { t: Date.now() } }),
      adminCustomers({ data: { q: "", t: Date.now() } }),
    ]);
    setData(next);
    setPeople(list);
  }

  useEffect(() => {
    void load().catch(() => setData(null));
  }, []);

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <PageHeader
        title="Finance"
        description="Customer payments, wallet movement, advisor earnings, house commission, refunds."
      />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Coin purchases"
          value={formatMoney(data.stats.paymentCents, data.currency)}
          hint={`${data.stats.payments}c credited`}
          tone="gold"
        />
        <Stat label="Customer spend" value={`${data.stats.spent}c`} tone="blush" />
        <Stat label="Advisor earnings" value={`${data.stats.earned}c`} tone="primary" />
        <Stat label="House commission" value={`${data.stats.commission}c`} tone="lotus" />
        <Stat label="Refunds issued" value={`${data.stats.refunds}c`} tone="warn" />
        <Stat
          label="Paid messages"
          value={`${data.stats.messageCoins ?? 0}c`}
          hint={formatMoney(data.stats.messageCents ?? 0, data.currency)}
          tone="gold"
        />
        <Stat label="Message advisor share" value={formatCoinUnitsFromCents(data.stats.messageAdvisor ?? 0)} tone="primary" />
        <Stat label="Message Ora share" value={formatCoinUnitsFromCents(data.stats.messageOra ?? 0)} tone="lotus" />
        <Stat label="Tip revenue" value={`${data.stats.tipCoins ?? 0}c`} hint={`${data.stats.tipCount ?? 0} gifts · 50/50`} tone="gold" />
        <Stat label="Tip advisor share" value={`${data.stats.tipAdvisor ?? 0}c`} hint="50%" tone="primary" />
        <Stat label="Tip Ora share" value={`${data.stats.tipOra ?? 0}c`} hint="50%" tone="lotus" />
      </div>

      <Panel title="Tips">
        <ul className="ora-rows">
          {!data.tips?.length ? (
            <li className="px-4 py-3 text-sm text-muted">No tips yet.</li>
          ) : (
            data.tips.map((tip) => (
              <li key={tip.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{tip.customerName}</p>
                <p className="mt-0.5 text-xs text-faint">Advisor {tip.advisorName}</p>
                <p className="text-xs text-faint">Gift {tip.giftName}</p>
                <p className="text-xs text-faint">Total coins spent {tip.coins}</p>
                <p className="text-xs text-faint">Advisor 50% share {tip.advisorShare} coins</p>
                <p className="text-xs text-faint">Ora 50% share {tip.oraShare} coins</p>
                <p className="text-xs text-faint">{formatWhen(tip.at)}</p>
                <p className="text-xs text-faint">Status {tip.status}</p>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel title="Customer payments">
        <ul className="ora-rows">
          {!data.payments.length ? (
            <li className="px-4 py-3 text-sm text-muted">No checkouts yet.</li>
          ) : (
            data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {p.name || p.email || p.userId.slice(0, 10)}
                  {p.email && p.name ? ` · ${p.email}` : ""} · {p.coins}c · {formatMoney(p.amountCents, p.currency)}
                  <span className="mt-0.5 block text-xs text-faint">
                    {p.status} · {p.id} · {p.provider} · {formatWhen(p.paidAt || p.createdAt)}
                  </span>
                </span>
                {p.status === "succeeded" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void adminRefundPayment({ data: { id: p.id } })
                        .then((r) => {
                          toast.success(r.already ? "Already refunded." : "Payment refunded.");
                          return load();
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Could not refund"))
                    }
                  >
                    Refund
                  </Button>
                ) : (
                  <span className="text-xs text-muted">{p.status}</span>
                )}
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel title="Refund or adjustment">
        <form
          className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            void adminAdjust({
              data: {
                userId,
                coins: Number(coins),
                kind,
                note,
                readingId,
              },
            })
              .then(() => {
                toast.success("Posted.");
                setNote("");
                return load();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not post"));
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
                {people.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name} {p.email ? `· ${p.email}` : ""}
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

      <Panel title="Wallet transactions">
        <ul className="ora-rows">
          {data.ledger.length ? (
            data.ledger.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {l.name || l.userId} · {l.note}
                  <span className="mt-0.5 block text-xs text-faint">{formatWhen(l.createdAt)}</span>
                </span>
                <span className="tabular-nums text-primary">
                  {l.coins > 0 ? "+" : ""}
                  {l.coins}c
                </span>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-muted">No wallet movement yet.</li>
          )}
        </ul>
      </Panel>
      <Panel title="Refunds and adjustments">
        <ul className="ora-rows">
          {!data.adjustments.length ? (
            <li className="px-4 py-3 text-sm text-muted">None posted yet.</li>
          ) : (
            data.adjustments.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {a.kind} · {a.userId.slice(0, 10)}
                  {a.note ? ` · ${a.note}` : ""}
                  <span className="mt-0.5 block text-xs text-faint">{formatWhen(a.createdAt)}</span>
                </span>
                <span className="tabular-nums text-primary">
                  {a.coins > 0 ? "+" : ""}
                  {a.coins}c
                </span>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </main>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatClock, formatMoney, formatWhen, getCustomer, type LedgerRow, type PaymentHistoryRow } from "@/lib/ora";
import { visibleCustomerTransactions, walletTransactions } from "@/lib/ora-customer-transactions";
import { useOraRefresh } from "@/lib/use-ora-refresh";

export const Route = createFileRoute("/transactions")({ component: TransactionsPage });

function TransactionsPage() {
  const { user, isPending } = useCurrentUserState();
  const [payments, setPayments] = useState<PaymentHistoryRow[] | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const next = await getCustomer();
    setPayments(next.payments);
    setLedger(next.ledger);
  }

  useEffect(() => {
    if (!user) {
      setPayments(null);
      setLedger(null);
      return;
    }
    void load().catch(() => {
      setPayments([]);
      setLedger([]);
    });
  }, [user]);
  useOraRefresh(() => {
    if (!user) return;
    return load().catch(() => undefined);
  });

  if (isPending || (user && (!payments || !ledger))) {
    return (
      <AppShell tab="you">
        <div className="mx-4 mt-8 h-48 animate-pulse rounded-xl bg-elevated" />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">Transactions</h1>
          <p className="mt-2 text-sm text-muted">Sign in to see payments, wallet, and coin history.</p>
          <Button asChild className="mt-6 w-full rounded-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </main>
      </AppShell>
    );
  }

  const rows = walletTransactions(payments ?? [], ledger ?? []);
  const view = visibleCustomerTransactions(rows, open);

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" preload={false} className="text-sm text-primary">
          Back to account
        </Link>
        <h1 className="mt-3 font-display text-3xl text-fg">Transactions</h1>
        <p className="mt-1 text-sm text-muted">Payments, wallet, and coin history. Readings stay in Reading History.</p>
        {!rows.length ? (
          <p className="mt-4 text-sm text-muted">No payments or coin activity yet.</p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
              {view.visible.map((row) =>
                row.kind === "payment" ? (
                  <li key={row.key} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm">
                        Purchase · {row.payment.coins}c · {formatMoney(row.payment.amountCents, row.payment.currency)}
                      </p>
                      <p className="text-xs text-faint">
                        {row.payment.status} · {row.payment.id} · {formatWhen(row.payment.paidAt || row.payment.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-primary">
                      {row.payment.status === "succeeded" ? `+${row.payment.coins}c` : "0c"}
                    </p>
                  </li>
                ) : (
                  <li key={row.key} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm">{row.ledger.note}</p>
                      <p className="text-xs text-faint">{formatWhen(row.ledger.createdAt)}</p>
                    </div>
                    <p className="text-sm tabular-nums text-primary">
                      {row.ledger.amountCoins !== 0
                        ? `${row.ledger.amountCoins > 0 ? "+" : ""}${row.ledger.amountCoins}c`
                        : formatClock(row.ledger.seconds)}
                    </p>
                  </li>
                ),
              )}
            </ul>
            {view.canToggle ? (
              <button
                type="button"
                className="mt-3 w-full rounded-full bg-surface py-2.5 text-sm font-medium text-primary shadow-[var(--shadow-border)]"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? "See less" : "See More"}
              </button>
            ) : null}
          </>
        )}
        <Button asChild variant="outline" className="mt-6 w-full rounded-full">
          <Link to="/account">Wallet</Link>
        </Button>
      </main>
    </AppShell>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { rememberMe } from "@/lib/client-cache";
import {
  formatClock,
  formatMoney,
  formatWhen,
  getMe,
  includedSeconds,
  subscribe,
  SUB_PRICE_USD,
  type Me,
} from "@/lib/ora";
import {
  cancelPayment,
  confirmSandboxPayment,
  confirmStripeReturn,
  failSandboxPayment,
  getPayment,
  listMyPayments,
  listPacks,
  paymentConfig,
  startCheckout,
  type CoinPack,
  type PaymentRow,
} from "@/lib/ora-pay";

type AccountSearch = { pay?: string; session_id?: string };

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    pay: typeof search.pay === "string" ? search.pay.slice(0, 64) : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id.slice(0, 200) : undefined,
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const { pay: payId, session_id: sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [checkout, setCheckout] = useState<{ payment: PaymentRow; pack: CoinPack | null } | null>(null);
  const [busy, setBusy] = useState("");
  const [stripeEnabled, setStripeEnabled] = useState(false);

  async function refreshWallet() {
    const [next, history] = await Promise.all([getMe(), listMyPayments()]);
    rememberMe(next);
    setMe(next);
    setPayments(history);
    return next;
  }

  useEffect(() => {
    if (!user) return;
    void Promise.all([refreshWallet(), listPacks(), paymentConfig()]).then(([, nextPacks, cfg]) => {
      setPacks(nextPacks);
      setStripeEnabled(Boolean(cfg.stripeEnabled));
    });
  }, [user]);

  useEffect(() => {
    if (!user || !sessionId) return;
    let cancelled = false;
    void confirmStripeReturn({ data: { sessionId } })
      .then((res) => {
        if (cancelled) return;
        if (res.status === "succeeded") toast.success("Payment received. Coins are in your wallet.");
        if (res.paymentId) void navigate({ to: "/account", search: { pay: res.paymentId } });
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not confirm payment"));
    return () => {
      cancelled = true;
    };
  }, [user, sessionId, navigate]);

  useEffect(() => {
    if (!user || !payId) {
      setCheckout(null);
      return;
    }
    let cancelled = false;
    void getPayment({ data: { id: payId } }).then((row) => {
      if (cancelled) return;
      if (!row) {
        setCheckout(null);
        return;
      }
      setCheckout(row);
    });
    return () => {
      cancelled = true;
    };
  }, [user, payId]);

  if (isPending) {
    return (
      <AppShell tab="wallet">
        <div className="mx-4 mt-8 h-48 animate-pulse rounded-xl bg-elevated" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function sub() {
    const next = await subscribe();
    setMe(next);
    rememberMe(next);
    toast.success("Subscription on. Three minutes this week.");
  }

  async function openPack(id: string) {
    setBusy(id);
    try {
      const res = await startCheckout({
        data: { packId: id, returnTo: "/account", origin: window.location.origin },
      });
      if (res.provider === "stripe" && res.url.startsWith("https://")) {
        window.location.assign(res.url);
        return;
      }
      await navigate({ to: "/account", search: { pay: res.paymentId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open checkout");
    } finally {
      setBusy("");
    }
  }

  async function reloadCheckout(id: string) {
    const row = await getPayment({ data: { id } });
    setCheckout(row);
    await refreshWallet();
    return row;
  }

  async function payNow() {
    if (!checkout) return;
    setBusy("pay");
    try {
      const res = await confirmSandboxPayment({ data: { id: checkout.payment.id } });
      await reloadCheckout(checkout.payment.id);
      if (res.status === "succeeded") {
        toast.success(res.credited ? `${res.coins} coins added.` : "This purchase was already credited.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy("");
    }
  }

  async function declineCard() {
    if (!checkout) return;
    setBusy("fail");
    try {
      await failSandboxPayment({ data: { id: checkout.payment.id } });
      await reloadCheckout(checkout.payment.id);
      toast.error("Card declined. No coins were added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not decline");
    } finally {
      setBusy("");
    }
  }

  async function cancelPay() {
    if (!checkout) return;
    setBusy("cancel");
    try {
      await cancelPayment({ data: { id: checkout.payment.id } });
      await reloadCheckout(checkout.payment.id);
      toast.message("Payment cancelled. No coins were added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy("");
    }
  }

  const w = me?.wallet;
  const welcome = w && w.bonusSeconds > 0;
  const payment = checkout?.payment;
  const pack = checkout?.pack;
  const sandboxCheckout = payment?.provider !== "stripe";
  const liveCheckout = payment && (payment.status === "created" || payment.status === "pending");
  const paidCheckout = payment?.status === "succeeded";
  const failedCheckout = payment?.status === "failed";
  const cancelledCheckout = payment?.status === "cancelled";
  const returnTo = payment?.returnTo && payment.returnTo.startsWith("/reading/") ? payment.returnTo : "";

  return (
    <AppShell tab="wallet">
      <main className="px-4 py-8">
        <p className="text-xs tracking-wide text-faint uppercase">{me?.displayName}</p>
        <h1 className="mt-1 font-display text-3xl">Wallet</h1>
        <p className="mt-2 text-muted">
          Welcome gift, weekly minutes if you subscribe, then coins. 10 coins = $1.
        </p>

        {welcome ? (
          <div className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-sm text-primary">Your first three minutes are waiting.</p>
            <p className="mt-1 text-sm text-muted">Sit with any advisor. Included time burns before coins.</p>
            <Button asChild className="mt-4">
              <Link to="/">Choose an advisor</Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Welcome minutes" value={w ? formatClock(w.bonusSeconds) : "—"} />
          <Stat label="This week" value={w ? formatClock(w.weeklySeconds) : "—"} />
          <Stat label="Coins" value={w ? String(w.coins) : "—"} />
        </div>
        {w ? (
          <p className="mt-3 text-sm text-muted">
            Included time left: {formatClock(includedSeconds(w))}
            {w.subscribed ? " · subscribed" : ""}
          </p>
        ) : null}

        <section className="mt-10 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl">Weekly subscription</h2>
          <p className="mt-2 text-sm text-muted">
            ${SUB_PRICE_USD}. Three minutes every seven days, with any advisor. After those minutes, coins at their
            rate.
          </p>
          {w?.subscribed ? (
            <p className="mt-4 text-ok">Active — refreshes every week.</p>
          ) : (
            <Button className="mt-4" onClick={() => void sub()}>
              Subscribe · ${SUB_PRICE_USD}
            </Button>
          )}
        </section>

        <section className="mt-6 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl">Add funds</h2>
          {payment ? (
            <div className="mt-4 space-y-4">
              <p className="rounded-md bg-elevated px-3 py-2 text-xs text-primary">
                {stripeEnabled || payment.provider === "stripe"
                  ? "Card checkout"
                  : "Test checkout · no real card is charged"}
              </p>
              <div>
                <p className="font-display text-2xl">{payment.coins} coins</p>
                <p className="mt-1 text-sm text-muted">{formatMoney(payment.amountCents, payment.currency)}</p>
                <p className="mt-2 text-xs text-faint">Transaction ID {payment.id}</p>
              </div>
              {paidCheckout ? (
                <div className="space-y-3">
                  <p className="text-sm text-ok">
                    Paid. {payment.coins} coins are in your wallet. This purchase cannot be credited again.
                  </p>
                  <p className="text-xs text-faint">{formatWhen(payment.paidAt || payment.createdAt)}</p>
                  <div className="flex flex-col gap-2">
                    {returnTo ? (
                      <Button asChild>
                        <a href={returnTo}>Return to reading</a>
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={() => void navigate({ to: "/account", search: {} })}>
                      Back to wallet
                    </Button>
                  </div>
                </div>
              ) : null}
              {failedCheckout ? (
                <div className="space-y-3">
                  <p className="text-sm text-danger">Card declined. No coins were added.</p>
                  <Button variant="outline" onClick={() => void navigate({ to: "/account", search: {} })}>
                    Choose another pack
                  </Button>
                </div>
              ) : null}
              {cancelledCheckout ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">Payment cancelled. No coins were added.</p>
                  <Button variant="outline" onClick={() => void navigate({ to: "/account", search: {} })}>
                    Choose another pack
                  </Button>
                </div>
              ) : null}
              {liveCheckout && sandboxCheckout ? (
                <div className="flex flex-col gap-2">
                  <Button disabled={Boolean(busy)} onClick={() => void payNow()}>
                    {busy === "pay" ? "Paying…" : `Pay ${formatMoney(payment.amountCents, payment.currency)}`}
                  </Button>
                  <Button variant="outline" disabled={Boolean(busy)} onClick={() => void declineCard()}>
                    {busy === "fail" ? "Declining…" : "Simulate declined card"}
                  </Button>
                  <Button variant="ghost" disabled={Boolean(busy)} onClick={() => void cancelPay()}>
                    {busy === "cancel" ? "Cancelling…" : "Cancel"}
                  </Button>
                </div>
              ) : null}
              {liveCheckout && !sandboxCheckout ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">Finish card payment to add these coins. If the card page closed, choose the pack again.</p>
                  <Button variant="outline" onClick={() => void openPack(payment.packId)}>
                    Return to card checkout
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                {stripeEnabled
                  ? "Use these after included minutes run out. Card payment adds coins once."
                  : "Use these after included minutes run out. Test checkout only."}
              </p>
              <ul className="mt-4 grid gap-2">
                {packs.map((p) => (
                  <li key={p.id}>
                    <Button
                      variant="outline"
                      className="h-auto w-full justify-between py-3"
                      disabled={Boolean(busy)}
                      onClick={() => void openPack(p.id)}
                    >
                      <span>{p.coins} coins</span>
                      <span className="text-primary">{formatMoney(p.amountCents, p.currency)}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="mt-6">
          <h2 className="font-display text-xl">Purchases</h2>
          {!payments.length ? (
            <p className="mt-2 text-sm text-muted">No checkouts yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
              {payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm">
                      {p.coins}c · {formatMoney(p.amountCents, p.currency)}
                    </p>
                    <p className="text-xs text-faint">
                      {p.status} · {p.id} · {formatWhen(p.paidAt || p.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums text-primary">{p.status === "succeeded" ? `+${p.coins}c` : "0c"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {me?.pendingApplication ? (
          <p className="mt-8 text-sm text-muted">Your advisor application is with the panel.</p>
        ) : me?.advisorId ? (
          <p className="mt-8 text-sm">
            <Link to="/studio" className="text-primary">
              Open studio
            </Link>
          </p>
        ) : (
          <p className="mt-8 text-sm">
            <Link to="/apply" className="text-primary">
              Apply as an advisor
            </Link>
          </p>
        )}
      </main>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-faint uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}

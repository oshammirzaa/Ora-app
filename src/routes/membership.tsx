import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { MembershipStatusCard, membershipFromWallet } from "@/components/membership-status";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { rememberMe } from "@/lib/client-cache";
import { getMe, type Me } from "@/lib/ora";
import { cancelMembership } from "@/lib/ora-membership";
import { isMembershipLive, MEMBERSHIP_PLANS, type MembershipPlan } from "@/lib/ora-membership-plan";
import {
  cancelPayment,
  confirmSandboxPayment,
  confirmStripeReturn,
  failSandboxPayment,
  formatMoney,
  getPayment,
  startCheckout,
  type PaymentRow,
} from "@/lib/ora-pay";

type MembershipSearch = { pay?: string; session_id?: string };

export const Route = createFileRoute("/membership")({
  validateSearch: (search: Record<string, unknown>): MembershipSearch => ({
    pay: typeof search.pay === "string" ? search.pay.slice(0, 64) : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id.slice(0, 200) : undefined,
  }),
  component: MembershipPage,
});

function MembershipPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const { pay: payId, session_id: sessionId } = Route.useSearch();
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState("");
  const [payment, setPayment] = useState<PaymentRow | null>(null);

  async function refresh() {
    const next = await getMe();
    rememberMe(next);
    setMe(next);
    return next;
  }

  useEffect(() => {
    if (!user) {
      setMe(null);
      return;
    }
    void refresh();
  }, [user]);

  useEffect(() => {
    if (!user || !sessionId) return;
    let cancelled = false;
    void confirmStripeReturn({ data: { sessionId } })
      .then((res) => {
        if (cancelled) return;
        if (res.status === "succeeded") toast.success("Membership is active.");
        if (res.paymentId) void navigate({ to: "/membership", search: { pay: res.paymentId } });
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not confirm payment"));
    return () => {
      cancelled = true;
    };
  }, [user, sessionId, navigate]);

  useEffect(() => {
    if (!user || !payId) {
      setPayment(null);
      return;
    }
    let cancelled = false;
    void getPayment({ data: { id: payId } }).then((row) => {
      if (cancelled) return;
      setPayment(row?.payment ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [user, payId]);

  const live = me ? isMembershipLive(membershipFromWallet(me.wallet)) : false;

  async function choose(plan: MembershipPlan) {
    if (!user) {
      await navigate({ to: "/login" });
      return;
    }
    setBusy(plan.packId);
    try {
      const res = await startCheckout({
        data: { packId: plan.packId, returnTo: "/membership", origin: window.location.origin },
      });
      if (res.provider === "stripe" && res.url.startsWith("https://")) {
        window.location.assign(res.url);
        return;
      }
      await navigate({ to: "/membership", search: { pay: res.paymentId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open checkout");
    } finally {
      setBusy("");
    }
  }

  async function payNow() {
    if (!payment) return;
    setBusy("pay");
    try {
      const res = await confirmSandboxPayment({ data: { id: payment.id } });
      const next = await getPayment({ data: { id: payment.id } });
      setPayment(next?.payment ?? null);
      await refresh();
      if (res.status === "succeeded") toast.success("Membership payment confirmed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy("");
    }
  }

  async function decline() {
    if (!payment) return;
    setBusy("fail");
    try {
      await failSandboxPayment({ data: { id: payment.id } });
      const next = await getPayment({ data: { id: payment.id } });
      setPayment(next?.payment ?? null);
      toast.error("Payment failed. Membership was not activated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not decline");
    } finally {
      setBusy("");
    }
  }

  async function cancelPay() {
    if (!payment) return;
    setBusy("cancel");
    try {
      await cancelPayment({ data: { id: payment.id } });
      const next = await getPayment({ data: { id: payment.id } });
      setPayment(next?.payment ?? null);
      toast.message("Checkout cancelled. Membership was not activated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy("");
    }
  }

  async function stopRenewal() {
    setBusy("stop");
    try {
      await cancelMembership();
      await refresh();
      toast.success("Membership stays on until the paid period ends.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy("");
    }
  }

  const pendingPay = payment && (payment.status === "created" || payment.status === "pending");
  const paidPay = payment?.status === "succeeded";
  const failedPay = payment?.status === "failed";
  const cancelledPay = payment?.status === "cancelled";

  return (
    <AppShell tab="home" hideHeader>
      <main className="relative overflow-hidden px-4 pt-3 pb-6" style={{ background: "linear-gradient(180deg, #f6eef4 0%, #f8f5f7 45%, #f4eaf1 100%)" }}>
        <div
          className="pointer-events-none absolute -top-6 right-[-70px] h-64 w-64 rounded-full border border-[#e6d3a8]/60"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-28 -left-24 h-52 w-52 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(244,196,214,0.45) 0%, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative z-10 flex items-center justify-between">
          <Link
            to="/"
            preload={false}
            aria-label="Back"
            className="grid size-10 place-items-center rounded-full bg-white text-fg shadow-[0_10px_24px_-14px_rgba(42,36,48,0.45)]"
          >
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </Link>
          <Link
            to="/support"
            preload={false}
            aria-label="Notifications"
            className="grid size-10 place-items-center rounded-full bg-white text-fg shadow-[0_10px_24px_-14px_rgba(42,36,48,0.45)]"
          >
            <Bell className="size-4" strokeWidth={1.8} />
          </Link>
        </div>

        <div className="relative z-10 mt-5 pr-[7.6rem]">
          <p className="text-[10px] font-medium tracking-[0.22em] text-[#9a8796] uppercase">Choose your plan</p>
          <h1 className="mt-1 font-display text-[2.35rem] leading-[1.02] font-semibold tracking-tight text-[#241c28]">
            A brighter <span className="text-[#7a4e6c] italic">you</span>
            <HeartMark />
          </h1>
          <p className="mt-2 text-[13px] text-[#8a7a88]">More guidance. More connection.</p>
        </div>

        <div className="absolute top-[3.2rem] right-3 z-10 w-[7.4rem] text-center">
          <OraLockup />
          <p
            className="mt-1 text-[17px] leading-[1.12] text-[#8a5a78]"
            style={{ fontFamily: "var(--font-script)", transform: "rotate(-11deg)" }}
          >
            Good Energy Always With You ♡
          </p>
        </div>

        <div className="relative z-10 mt-11 grid grid-cols-2 items-stretch gap-2.5">
          <MiniCard
            disabled={live}
            busy={busy === MEMBERSHIP_PLANS.mini.packId || isPending}
            onChoose={() => void choose(MEMBERSHIP_PLANS.mini)}
          />
          <FullCard
            disabled={live}
            busy={busy === MEMBERSHIP_PLANS.membership.packId || isPending}
            onChoose={() => void choose(MEMBERSHIP_PLANS.membership)}
          />
        </div>

        {pendingPay ? (
          <div className="relative z-10 mt-4 space-y-3 rounded-[1.6rem] bg-white p-4 shadow-[var(--shadow-border)]">
            <p className="font-display text-xl text-fg">Confirm payment</p>
            <p className="text-sm text-muted">
              {formatMoney(payment.amountCents, payment.currency)} · {payment.coins} coins after success. Membership
              starts only when this payment succeeds.
            </p>
            <Button className="w-full rounded-full" disabled={busy === "pay"} onClick={() => void payNow()}>
              {busy === "pay" ? "Confirming…" : `Pay ${formatMoney(payment.amountCents, payment.currency)}`}
            </Button>
            <Button variant="outline" className="w-full rounded-full" disabled={Boolean(busy)} onClick={() => void decline()}>
              Decline card
            </Button>
            <button type="button" className="w-full text-sm text-muted" onClick={() => void cancelPay()}>
              Cancel checkout
            </button>
          </div>
        ) : null}

        {paidPay && live ? <p className="relative z-10 mt-3 text-sm text-ok">Payment confirmed. Your plan is on.</p> : null}
        {failedPay ? (
          <p className="relative z-10 mt-3 text-sm text-danger">Payment failed. No plan was activated and no coins were added.</p>
        ) : null}
        {cancelledPay ? <p className="relative z-10 mt-3 text-sm text-muted">Checkout cancelled. No plan was started.</p> : null}

        {me && live ? (
          <div className="relative z-10 mt-4">
            <MembershipStatusCard wallet={me.wallet} onCancel={() => void stopRenewal()} busy={busy === "stop"} />
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

function MiniCard({ disabled, busy, onChoose }: { disabled: boolean; busy: boolean; onChoose: () => void }) {
  return (
    <article
      className="flex flex-col rounded-[1.75rem] px-2.5 pt-3.5 pb-2.5"
      style={{
        background: "linear-gradient(180deg, #ffeef4 0%, #fbd6e4 48%, #f5c0d4 100%)",
        boxShadow: "0 20px 34px -20px rgba(196, 90, 130, 0.5)",
      }}
    >
      <span
        className="grid size-12 place-items-center rounded-[1.05rem]"
        style={{ background: "linear-gradient(180deg, #f7c8d8, #efadc3)" }}
      >
        <MoonStar fill="#fff7fa" />
      </span>
      <h2 className="mt-3 font-sans text-[15px] font-semibold tracking-tight text-[#2a2030]">Ora Mini</h2>
      <p className="mt-1 font-display text-[1.85rem] leading-none font-semibold" style={{ color: "#c63d73" }}>
        $10 <span className="align-middle text-[11px] font-medium text-[#8a7080]">/ month</span>
      </p>
      <div className="mt-3 space-y-1.5">
        <Benefit
          tone="pink"
          icon={<ClockIcon color="#e07aa0" />}
          title="3 Free Reading Minutes"
          subtitle="Every 7 Days"
        />
        <Benefit
          tone="pink"
          icon={<CoinStack color="#e07aa0" />}
          title="20 Ora Coins"
          subtitle="Every Month"
        />
      </div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onChoose}
        className="mt-auto inline-flex h-10 w-full items-center justify-center gap-1 rounded-full text-[12px] font-medium text-white disabled:opacity-50"
        style={{ background: "linear-gradient(180deg, #de5f94, #c43f78)", marginTop: "0.75rem" }}
      >
        {busy ? "Opening…" : "Get Ora Mini"}
        <span aria-hidden>→</span>
      </button>
    </article>
  );
}

function FullCard({ disabled, busy, onChoose }: { disabled: boolean; busy: boolean; onChoose: () => void }) {
  return (
    <article
      className="flex flex-col rounded-[1.75rem] px-2.5 pt-3.5 pb-2.5"
      style={{
        background: "linear-gradient(180deg, #fffaf2 0%, #f6ead8 52%, #edd9b8 100%)",
        boxShadow: "0 20px 34px -20px rgba(92, 58, 90, 0.42)",
      }}
    >
      <span
        className="grid size-12 place-items-center rounded-[1.05rem]"
        style={{ background: "linear-gradient(160deg, #8a5a74, #4a2c46 72%)" }}
      >
        <MoonStar fill="#e7c37a" />
      </span>
      <h2 className="mt-3 font-sans text-[15px] font-semibold tracking-tight text-[#2a2030]">Ora Membership</h2>
      <p className="mt-1 font-display text-[1.85rem] leading-none font-semibold" style={{ color: "#c4a35a" }}>
        $25 <span className="align-middle text-[11px] font-medium text-[#8a7080]">/ month</span>
      </p>
      <div className="mt-3 space-y-1.5">
        <Benefit
          tone="gold"
          icon={<ClockIcon color="#c4a35a" />}
          title="3 Free Reading Minutes"
          subtitle="Every 48 Hours"
        />
        <Benefit
          tone="gold"
          icon={<CoinStack color="#c4a35a" />}
          title="50 Ora Coins"
          subtitle="Every Month"
        />
      </div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onChoose}
        className="mt-auto inline-flex h-10 w-full items-center justify-center gap-1 rounded-full text-[12px] font-medium text-white disabled:opacity-50"
        style={{ background: "linear-gradient(180deg, #6b3d5c, #4f2a44)", marginTop: "0.75rem" }}
      >
        {busy ? "Opening…" : "Get Membership"}
        <span aria-hidden>→</span>
      </button>
    </article>
  );
}

function Benefit({
  tone,
  icon,
  title,
  subtitle,
}: {
  tone: "pink" | "gold";
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-[1.05rem] px-1.5 py-2"
      style={{ background: tone === "pink" ? "rgba(255,255,255,0.78)" : "rgba(255,252,246,0.82)" }}
    >
      <span className="grid size-7 shrink-0 place-items-center">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] leading-tight font-semibold text-fg">{title}</p>
        <p className="text-[9px] leading-tight text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function MoonStar({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <path
        fill={fill}
        d="M19.2 4.2C12.6 6.4 8 12.6 8 19.4c0 4.6 2.2 8.7 5.6 11.3C8.4 28.8 4 23.2 4 16.2 4 8.6 9.6 2.4 17 1.4c.7 1 1.4 1.9 2.2 2.8z"
      />
      <path fill={fill} d="M24.2 6.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
    </svg>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth="1.7" />
      <path d="M12 8.2v4.1l2.8 1.6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CoinStack({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <ellipse cx="12" cy="16.2" rx="6.2" ry="2.4" fill={color} opacity="0.85" />
      <ellipse cx="12" cy="13.4" rx="6.2" ry="2.4" fill={color} />
      <ellipse cx="12" cy="10.6" rx="6.2" ry="2.4" fill={color} opacity="0.92" />
    </svg>
  );
}

function HeartMark() {
  return (
    <svg viewBox="0 0 20 18" className="ml-1 inline-block size-4 align-[-2px] text-primary" aria-hidden>
      <path
        fill="currentColor"
        d="M10 16.2C4.2 11.6 1.6 8.6 1.6 5.7 1.6 3.4 3.3 1.8 5.5 1.8c1.4 0 2.7.7 3.5 1.8C9.8 2.5 11.1 1.8 12.5 1.8c2.2 0 3.9 1.6 3.9 3.9 0 2.9-2.6 5.9-8.4 10.5z"
        opacity="0.85"
      />
    </svg>
  );
}

function OraLockup() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1">
        <span
          className="grid size-9 place-items-center rounded-full"
          style={{ background: "linear-gradient(160deg, #8a5a74, #c4a35a)" }}
        >
          <MoonStar fill="#fff8ee" />
        </span>
        <span className="font-display text-[1.7rem] leading-none font-semibold tracking-tight text-[#7a4e6c]">Ora</span>
      </div>
      <span className="mt-1 text-[6.5px] tracking-[0.18em] text-[#9a8796] uppercase">Psychic Readings</span>
    </div>
  );
}

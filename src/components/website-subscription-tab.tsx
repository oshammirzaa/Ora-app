import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { membershipFromWallet } from "@/components/membership-status";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe } from "@/lib/client-cache";
import { MEMBERSHIP_PLANS, isMembershipLive, planById, type MembershipPlan } from "@/lib/ora-membership-plan";
import { monthlyPriceLabel, planMinutesLabel } from "@/lib/ora-marketing-copy";
import { startCheckout } from "@/lib/ora-pay";
import { useAccountRole, useMarketingWebsite } from "@/lib/use-account-home";

function hiddenPath(pathname: string) {
  return pathname === "/advisor" || pathname.startsWith("/advisor/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

export function WebsiteSubscriptionTab() {
  const website = useMarketingWebsite();
  const role = useAccountRole();
  const { user } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [owned, setOwned] = useState("");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!website || !user) {
      setOwned("");
      setLive(false);
      return;
    }
    let alive = true;
    void cachedMe()
      .then((me) => {
        if (!alive) return;
        const membership = membershipFromWallet(me.wallet);
        const active = isMembershipLive(membership);
        setLive(active);
        setOwned(active ? membership.plan : "");
      })
      .catch(() => {
        if (!alive) return;
        setLive(false);
        setOwned("");
      });
    return () => {
      alive = false;
    };
  }, [website, user?.id, pathname, open]);

  if (!website || hiddenPath(pathname) || role === "advisor" || role === "admin") return null;

  async function choose(plan: MembershipPlan) {
    if (!user) {
      setOpen(false);
      await navigate({ to: "/login" });
      return;
    }
    if (live) return;
    setBusy(plan.packId);
    try {
      const res = await startCheckout({
        data: { packId: plan.packId, returnTo: "/membership", origin: window.location.origin },
      });
      setOpen(false);
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

  const current = planById(owned);

  return (
    <>
      <button
        type="button"
        aria-label="Subscription"
        onClick={() => setOpen(true)}
        className="fixed top-[36%] right-0 z-30 flex flex-col items-center gap-1.5 rounded-l-2xl bg-primary py-3 pr-[0.35rem] pl-1.5 text-primary-fg shadow-[var(--shadow-border)]"
      >
        <Crown className="size-3.5 fill-gold text-gold" strokeWidth={1.8} />
        <span className="text-[10px] font-medium tracking-[0.16em] [writing-mode:vertical-rl] rotate-180">Subscription</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(92dvh,46rem)] w-[min(100%-1.25rem,46rem)] overflow-y-auto border border-[#e6d3a8]/80 bg-[#f8f3ea] p-4 sm:p-6">
          <p className="text-[10px] font-medium tracking-[0.22em] text-[#9a8796] uppercase">Subscription</p>
          <DialogTitle className="mt-1 font-display text-[1.85rem] leading-tight text-[#241c28]">
            {live ? "Your Ora plan" : "Choose your plan"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-[#8a7a88]">
            {live
              ? `${current?.name || "Membership"} is active on this account.`
              : "Ora Mini is $10/month. Ora Membership is $25/month. Checkout stays on this website."}
          </DialogDescription>
          {live && current ? (
            <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm shadow-[var(--shadow-border)]">
              <p className="font-medium text-fg">{current.name}</p>
              <p className="mt-1 text-ok">Active</p>
              <p className="mt-1 text-muted">{monthlyPriceLabel(current.amountCents)}</p>
              <p className="text-muted">{planMinutesLabel(current)}</p>
              <p className="text-muted">{current.coins} coins monthly</p>
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[MEMBERSHIP_PLANS.mini, MEMBERSHIP_PLANS.membership].map((plan) => {
              const currentPlan = live && owned === plan.plan;
              return (
                <article
                  key={plan.packId}
                  className="flex flex-col rounded-[1.5rem] px-4 py-4"
                  style={{
                    background:
                      plan.plan === "membership"
                        ? "linear-gradient(180deg, #fffaf2 0%, #f6ead8 55%, #edd9b8 100%)"
                        : "linear-gradient(180deg, #ffeef4 0%, #fbd6e4 48%, #f5c0d4 100%)",
                  }}
                >
                  <h3 className="font-sans text-[15px] font-semibold text-[#2a2030]">{plan.name}</h3>
                  <p className="mt-1 font-display text-3xl leading-none font-semibold" style={{ color: plan.plan === "membership" ? "#c4a35a" : "#c63d73" }}>
                    {monthlyPriceLabel(plan.amountCents).replace("/month", "")}{" "}
                    <span className="align-middle text-[11px] font-medium text-[#8a7080]">/ month</span>
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[13px] text-[#2a2030]">
                    <li>{planMinutesLabel(plan)}</li>
                    <li>{plan.coins} coins monthly</li>
                  </ul>
                  <button
                    type="button"
                    disabled={Boolean(busy) || live}
                    onClick={() => void choose(plan)}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-white disabled:opacity-60"
                    style={{
                      background: plan.plan === "membership" ? "linear-gradient(180deg, #6b3d5c, #4f2a44)" : "linear-gradient(180deg, #de5f94, #c43f78)",
                    }}
                  >
                    {currentPlan ? "Active" : live ? "Plan active" : busy === plan.packId ? "Opening…" : "Subscribe"}
                  </button>
                </article>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

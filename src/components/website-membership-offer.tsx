import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe } from "@/lib/client-cache";
import { membershipFromWallet } from "@/components/membership-status";
import { isMembershipLive, type MembershipPlan } from "@/lib/ora-membership-plan";
import {
  MEMBERSHIP_OFFER_DISMISS_KEY,
  membershipOfferDecision,
  membershipOfferPlans,
} from "@/lib/ora-membership-offer";
import { monthlyPriceLabel, planMinutesLabel } from "@/lib/ora-marketing-copy";
import { startCheckout } from "@/lib/ora-pay";
import { useMarketingWebsite } from "@/lib/use-account-home";

function readDismissed() {
  try {
    return sessionStorage.getItem(MEMBERSHIP_OFFER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(MEMBERSHIP_OFFER_DISMISS_KEY, "1");
  } catch {
    /* private mode can block storage; the in-memory close still holds for this view */
  }
}

export function WebsiteMembershipOffer() {
  const website = useMarketingWebsite();
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [ownedPlan, setOwnedPlan] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!website || isPending || !user) {
      setOpen(false);
      return;
    }
    let alive = true;
    void cachedMe()
      .then((me) => {
        if (!alive) return;
        const membership = membershipFromWallet(me.wallet);
        const live = isMembershipLive(membership);
        setOwnedPlan(live ? membership.plan : "");
        const next = membershipOfferDecision({
          marketingHost: website,
          signedIn: true,
          role: me.role,
          membershipActive: live,
          dismissed: readDismissed(),
          pathname,
        });
        setOpen(next === "show");
      })
      .catch(() => {
        if (alive) setOpen(false);
      });
    return () => {
      alive = false;
    };
  }, [website, isPending, user?.id, pathname]);

  function dismiss() {
    writeDismissed();
    setOpen(false);
  }

  async function choose(plan: MembershipPlan) {
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

  if (!website || !open) return null;

  const plans = membershipOfferPlans(ownedPlan);
  if (!plans.length) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="max-h-[min(92dvh,46rem)] w-[min(100%-1.25rem,46rem)] overflow-y-auto border border-[#e6d3a8]/80 bg-[#f8f3ea] p-4 shadow-[0_24px_60px_-28px_rgba(74,44,70,0.55)] sm:p-6">
        <p className="text-[10px] font-medium tracking-[0.22em] text-[#9a8796] uppercase">Ora Membership</p>
        <DialogTitle className="mt-1 font-display text-[1.85rem] leading-tight text-[#241c28] sm:text-4xl">
          A brighter <span className="text-[#7a4e6c] italic">you</span>
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[#8a7a88]">
          Choose a plan. Membership starts only after the real checkout succeeds.
        </DialogDescription>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.packId}
              plan={plan}
              busy={busy === plan.packId}
              disabled={Boolean(busy)}
              onChoose={() => void choose(plan)}
            />
          ))}
        </div>
        <button type="button" className="mt-4 w-full text-sm text-[#8a7a88]" onClick={dismiss}>
          Not now
        </button>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({
  plan,
  busy,
  disabled,
  onChoose,
}: {
  plan: MembershipPlan;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const full = plan.plan === "membership";
  const price = monthlyPriceLabel(plan.amountCents).replace("/month", "");
  return (
    <article
      className="flex flex-col rounded-[1.5rem] px-4 py-4"
      style={{
        background: full
          ? "linear-gradient(180deg, #fffaf2 0%, #f6ead8 55%, #edd9b8 100%)"
          : "linear-gradient(180deg, #ffeef4 0%, #fbd6e4 48%, #f5c0d4 100%)",
      }}
    >
      <h3 className="font-sans text-[15px] font-semibold text-[#2a2030]">{plan.name}</h3>
      <p className="mt-1 font-display text-3xl leading-none font-semibold" style={{ color: full ? "#c4a35a" : "#c63d73" }}>
        {price} <span className="align-middle text-[11px] font-medium text-[#8a7080]">/ month</span>
      </p>
      <ul className="mt-3 space-y-1.5 text-[13px] text-[#2a2030]">
        <li>{planMinutesLabel(plan)}</li>
        <li>{plan.coins} coins monthly</li>
      </ul>
      <button
        type="button"
        disabled={disabled}
        onClick={onChoose}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-white disabled:opacity-50"
        style={{ background: full ? "linear-gradient(180deg, #6b3d5c, #4f2a44)" : "linear-gradient(180deg, #de5f94, #c43f78)" }}
      >
        {busy ? "Opening…" : full ? "Subscribe" : "Get Ora Mini"}
      </button>
    </article>
  );
}

import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Clock3, Coins, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { OraLockup } from "@/components/ora-brand";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe } from "@/lib/client-cache";
import { membershipFromWallet } from "@/components/membership-status";
import { isMembershipLive, planById, type MembershipPlan } from "@/lib/ora-membership-plan";
import {
  MEMBERSHIP_OFFER_DISMISS_KEY,
  membershipOfferDecision,
  membershipOfferPlans,
  type MembershipOfferView,
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
  const [mode, setMode] = useState<MembershipOfferView>("hide");
  const [ownedPlan, setOwnedPlan] = useState("");
  const [busy, setBusy] = useState("");

  const signedIn = Boolean(user);
  const userId = user?.id || "";

  useEffect(() => {
    if (!website || isPending) {
      if (!website) setOpen(false);
      return;
    }
    let alive = true;
    const apply = (next: MembershipOfferView, plan = "") => {
      if (!alive) return;
      setOwnedPlan(plan);
      setMode(next);
      if (next === "hide") {
        setOpen(false);
        return;
      }
      writeDismissed();
      setOpen(true);
    };
    if (!signedIn) {
      apply(
        membershipOfferDecision({
          marketingHost: website,
          signedIn: false,
          role: "",
          membershipActive: false,
          dismissed: readDismissed(),
          pathname,
        }),
      );
      return () => {
        alive = false;
      };
    }
    void cachedMe()
      .then((me) => {
        const membership = membershipFromWallet(me.wallet);
        const live = isMembershipLive(membership);
        apply(
          membershipOfferDecision({
            marketingHost: website,
            signedIn: true,
            role: me.role,
            membershipActive: live,
            dismissed: readDismissed(),
            pathname,
          }),
          live ? membership.plan : "",
        );
      })
      .catch(() => {
        if (alive) setOpen(false);
      });
    return () => {
      alive = false;
    };
  }, [website, isPending, signedIn, userId, pathname]);

  function dismiss() {
    writeDismissed();
    setOpen(false);
  }

  async function choose(plan: MembershipPlan) {
    if (!user) {
      dismiss();
      await navigate({ to: "/login" });
      return;
    }
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

  function viewPlans() {
    dismiss();
    void navigate({ to: "/membership" });
  }

  if (!website || !open) return null;

  const plans = mode === "member" ? [] : membershipOfferPlans("");
  const current = mode === "member" ? planById(ownedPlan) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="max-h-[min(92dvh,48rem)] w-[min(100%-1.25rem,48rem)] overflow-y-auto border border-[#e6d3a8]/80 bg-[#fffdfb] p-4 shadow-[0_28px_70px_-28px_rgba(74,44,70,0.55)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:p-6">
        <div className="pr-8">
          <OraLockup />
        </div>
        <DialogTitle className="mt-3 font-display text-[1.85rem] leading-tight text-[#6d3054] sm:text-4xl">
          Unlock More With Ora Membership
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[#8a7a88]">
          {mode === "member"
            ? "Your membership is active. Nothing is charged from this window."
            : "Choose a plan. Membership starts only after you confirm the existing secure checkout."}
        </DialogDescription>
        {current ? (
          <article className="mt-4 rounded-[1.5rem] border border-[#ead7b0] bg-[#fffaf2] p-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8d6b32] uppercase">Active membership</p>
            <h3 className="mt-1 font-display text-3xl text-[#6d3054]">{current.name}</h3>
            <p className="mt-1 text-sm font-semibold text-[#2a2030]">{monthlyPriceLabel(current.amountCents)}</p>
            <ul className="mt-3 space-y-2 text-sm text-[#2a2030]">
              <li className="flex items-center gap-2">
                <Clock3 className="size-4 text-[#c4a35a]" />
                {planMinutesLabel(current)}
              </li>
              <li className="flex items-center gap-2">
                <Coins className="size-4 text-[#c4a35a]" />
                {current.coins} Ora Coins monthly
              </li>
            </ul>
          </article>
        ) : (
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
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={viewPlans}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#7a4e6c] text-sm font-semibold text-[#7a4e6c]"
          >
            View Plans
          </button>
          <button type="button" className="inline-flex h-11 items-center justify-center rounded-full text-sm text-[#8a7a88]" onClick={dismiss}>
            <X className="mr-1 size-4" />
            Close
          </button>
        </div>
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
  const price = monthlyPriceLabel(plan.amountCents);
  return (
    <article
      className="flex flex-col rounded-[1.5rem] border px-4 py-4"
      style={{
        background: full
          ? "linear-gradient(180deg, #fffaf2 0%, #f6ead8 55%, #edd9b8 100%)"
          : "linear-gradient(180deg, #fff7fa 0%, #fde4ee 48%, #f6d0e2 100%)",
        borderColor: full ? "#ead7b0" : "#f3c3d8",
      }}
    >
      <span className="grid size-10 place-items-center rounded-2xl bg-white text-[#7a4e6c] shadow-[0_8px_18px_-12px_rgba(122,78,108,0.8)]">
        {full ? <Sparkles className="size-5" /> : <Coins className="size-5" />}
      </span>
      <h3 className="mt-3 font-sans text-[15px] font-semibold text-[#2a2030]">{plan.name}</h3>
      <p className="mt-1 font-display text-3xl leading-none font-semibold" style={{ color: full ? "#8d6b32" : "#7a4e6c" }}>
        {price.replace("/month", "")} <span className="align-middle text-[11px] font-medium text-[#8a7080]">/ month</span>
      </p>
      <ul className="mt-3 space-y-1.5 text-[13px] text-[#2a2030]">
        <li>{planMinutesLabel(plan).replace("free minutes", "free reading minutes").replace("free minute", "free reading minute")}</li>
        <li>{plan.coins} Ora Coins monthly</li>
      </ul>
      <button
        type="button"
        disabled={disabled}
        onClick={onChoose}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#7a4e6c] text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Opening…" : "Join Membership"}
      </button>
    </article>
  );
}

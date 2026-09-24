import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gift, Heart, Sparkles, X } from "lucide-react";
import { TIP_GIFTS, tipGift } from "@/lib/ora-tips";
import { cn } from "@/lib/utils";

export function TipButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Send a tip"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-elevated px-2.5 text-xs font-medium text-primary shadow-[var(--shadow-border)] disabled:opacity-40"
    >
      <Gift className="size-4" />
      Tip
    </button>
  );
}

export function ChatTip({ giftId }: { giftId?: string }) {
  const gift = tipGift(giftId);
  if (!gift) return null;
  return (
    <span className="flex items-center gap-2">
      <img src={gift.image} alt="" className="size-9 rounded-xl object-cover" />
      <span>
        <span className="block font-medium">{gift.name}</span>
        <span className="block text-xs opacity-80">{gift.coins} coins</span>
      </span>
    </span>
  );
}

export function SendTipModal({
  open,
  advisorName,
  balance,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  advisorName: string;
  balance: number | null;
  busy?: boolean;
  onClose: () => void;
  onSend: (giftId: string) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState("");
  const gift = tipGift(selected);
  const coins = balance == null ? null : Math.max(0, Math.floor(Number(balance) || 0));
  const short = Boolean(gift && coins != null && coins < gift.coins);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) setSelected("");
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2a2430]/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ora-tip-title">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[1.7rem] border border-[#ead7c2] bg-[linear-gradient(180deg,#fffdfb_0%,#f6f0fb_100%)] px-3.5 pt-4 pb-4 shadow-[0_22px_50px_-28px_rgba(42,36,48,0.65)]">
        <button type="button" aria-label="Close" className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-white/80 text-muted" onClick={onClose}>
          <X className="size-4" />
        </button>
        <div className="px-6 text-center">
          <h2 id="ora-tip-title" className="flex items-center justify-center gap-2 font-display text-[1.7rem] text-primary">
            <Gift className="size-6" />
            Send a Tip
          </h2>
          <p className="sr-only">Tip for {advisorName || "your advisor"}</p>
          <p className="mt-1 font-[family-name:var(--font-script)] text-[1.35rem] leading-none text-[#6d5a86]">
            Show your appreciation and spread positive energy <Sparkles className="inline size-3.5 text-gold" />
          </p>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {TIP_GIFTS.map((item) => {
            const active = selected === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={cn(
                  "rounded-2xl border bg-white/80 px-1 pt-1.5 pb-1.5 text-center",
                  active ? "border-primary shadow-[0_0_0_2px_rgba(92,58,122,0.18)]" : "border-[#f0e4d4]",
                )}
              >
                <img src={item.image} alt="" className="mx-auto size-12 rounded-xl object-cover" />
                <span className="mt-1 block truncate text-[10px] font-medium text-fg">{item.name}</span>
                <span className="mt-1 inline-flex max-w-full items-center justify-center gap-0.5 rounded-full bg-[#f6efe6] px-1 py-0.5 text-[9px] text-[#6b5536]">
                  <span className="text-gold">●</span>
                  {item.coins} Coins
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded-2xl bg-[#f3eafb]/80 px-3 py-2.5 text-center text-[12px] leading-relaxed text-[#5c4d6e]">
          <Heart className="mr-1 inline size-3.5 text-primary" />
          Thank you for supporting your advisor.
          <span className="mt-0.5 block">
            Your kindness makes a difference. <Sparkles className="inline size-3.5 text-gold" />
          </span>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          {coins == null ? "Checking your balance…" : `Your balance: ${coins} coins`}
        </p>
        {gift ? (
          <p className="mt-1 text-center text-sm text-fg">
            {gift.name} · {gift.coins} coins
            {short ? <span className="mt-0.5 block text-xs text-muted">Not enough coins for this tip.</span> : null}
          </p>
        ) : (
          <p className="mt-1 text-center text-xs text-muted">Choose a gift</p>
        )}
        <button
          type="button"
          disabled={!gift || short || busy}
          onClick={() => {
            if (!gift || short || busy) return;
            void onSend(gift.id);
          }}
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-fg disabled:opacity-40"
        >
          {busy ? "Sending…" : gift ? `Send ${gift.name} · ${gift.coins} coins` : "Send a tip"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

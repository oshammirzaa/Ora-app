import type { LoyaltyTier } from "@/lib/ora-loyalty";
import { isLoyaltyTier, loyaltyLabel } from "@/lib/ora-loyalty";
import { cn } from "@/lib/utils";

function glyph(tier: Exclude<LoyaltyTier, "none">) {
  if (tier === "silver") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path
          fill="#C9D0DA"
          stroke="#9AA4B2"
          strokeWidth="0.55"
          strokeLinejoin="round"
          d="M8 1.55 9.72 5.1l3.9.5-2.86 2.68.76 3.86L8 10.4l-3.52 1.74.76-3.86L2.38 5.6l3.9-.5z"
        />
      </svg>
    );
  }
  if (tier === "gold") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path
          fill="#E2C36A"
          stroke="#C4A35A"
          strokeWidth="0.55"
          strokeLinejoin="round"
          d="M8 1.55 9.72 5.1l3.9.5-2.86 2.68.76 3.86L8 10.4l-3.52 1.74.76-3.86L2.38 5.6l3.9-.5z"
        />
      </svg>
    );
  }
  if (tier === "diamond") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path fill="#7B8EE6" d="M8 1.7 13.4 8 8 14.3 2.6 8z" />
        <path fill="#C9D4F7" d="M8 1.7 10.4 8 8 14.3 8 1.7z" opacity="0.55" />
        <path fill="none" stroke="#5C6BC0" strokeWidth="0.6" strokeLinejoin="round" d="M8 1.7 13.4 8 8 14.3 2.6 8z" />
      </svg>
    );
  }
  if (tier === "king") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path fill="#E2C36A" d="M2.2 11.6h11.6l-.5 2.1H2.7z" />
        <path fill="#D4B45A" d="M3 5.1 5.4 8.4 8 4.2 10.6 8.4 13 5.1 12.4 11.6H3.6z" />
        <circle cx="8" cy="3.3" r="1.05" fill="#5B6FD6" />
        <circle cx="3.05" cy="4.7" r="0.8" fill="#C4A35A" />
        <circle cx="12.95" cy="4.7" r="0.8" fill="#C4A35A" />
      </svg>
    );
  }
  if (tier === "queen") {
    return (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path fill="#E8B7C6" d="M2.2 11.6h11.6l-.5 2.1H2.7z" />
        <path fill="#E2C36A" d="M2.8 5.4 4.7 8.6 6.4 5.2 8 8.8 9.6 5.2 11.3 8.6 13.2 5.4 12.4 11.6H3.6z" />
        <circle cx="8" cy="3.2" r="1.05" fill="#C45B7A" />
        <circle cx="4.7" cy="4.8" r="0.7" fill="#E8B7C6" />
        <circle cx="11.3" cy="4.8" r="0.7" fill="#E8B7C6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <path fill="#E2C36A" d="M2.2 11.6h11.6l-.5 2.1H2.7z" />
      <path fill="#D8C48A" d="M3 5.1 5.4 8.4 8 4.2 10.6 8.4 13 5.1 12.4 11.6H3.6z" />
      <circle cx="8" cy="3.3" r="1.05" fill="#F4EEE4" stroke="#C4A35A" strokeWidth="0.4" />
      <circle cx="3.05" cy="4.7" r="0.75" fill="#C4A35A" />
      <circle cx="12.95" cy="4.7" r="0.75" fill="#C4A35A" />
    </svg>
  );
}

export function LoyaltyBadge({
  tier,
  className,
}: {
  tier?: LoyaltyTier | string | null;
  className?: string;
}) {
  if (!isLoyaltyTier(tier) || tier === "none") return null;
  const label = loyaltyLabel(tier);
  return (
    <span
      data-loyalty={tier}
      title={label}
      aria-label={label}
      className={cn("inline-flex shrink-0 items-center leading-none", className)}
    >
      {glyph(tier)}
    </span>
  );
}

export function ClientNameWithBadge({
  name,
  tier,
  className,
  nameClassName,
  as: Tag = "span",
}: {
  name: string;
  tier?: LoyaltyTier | string | null;
  className?: string;
  nameClassName?: string;
  as?: "span" | "p" | "h1" | "h2";
}) {
  return (
    <Tag className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      <span className={cn("truncate", nameClassName)}>{name}</span>
      <LoyaltyBadge tier={tier} />
    </Tag>
  );
}

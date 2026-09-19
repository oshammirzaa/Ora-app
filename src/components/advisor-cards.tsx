import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { AdvisorMedia } from "@/components/advisor-media";
import { ChatNow, PresenceBadge } from "@/components/chat-now";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isFavoriteId, setFavoriteId, subscribeFavorites, hydrateFavoriteIds } from "@/lib/favorite-store";
import { COINS_PER_DOLLAR, toggleFavorite, type Advisor } from "@/lib/ora";
import { listFavoriteIds } from "@/lib/ora-favorites";
import { cn } from "@/lib/utils";

export function formatUsdPerMin(rateCoins: number) {
  return `$${(rateCoins / COINS_PER_DOLLAR).toFixed(2)}/min`;
}

export function formatReviewCount(n: number) {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

export function primarySpecialty(advisor: Advisor) {
  return advisor.specialties.split(/[·,|&]/)[0]?.trim() || advisor.specialties;
}

export function AdvisorRating({ advisor }: { advisor: Advisor }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-fg">
      <Star className="size-3 fill-gold text-gold" />
      {advisor.rating.toFixed(1)}
      <span className="text-faint">({formatReviewCount(advisor.reviews)})</span>
    </span>
  );
}

export function FavoriteHeart({
  advisorId,
  className,
}: {
  advisorId: string;
  className?: string;
}) {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => isFavoriteId(advisorId));

  useEffect(() => {
    if (user) {
      hydrateFavoriteIds(() => listFavoriteIds().then((r) => r.ids));
    }
    const sync = () => setSaved(isFavoriteId(advisorId));
    sync();
    return subscribeFavorites(sync);
  }, [advisorId, user]);

  async function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      await navigate({ to: "/login" });
      return;
    }
    try {
      const r = await toggleFavorite({ data: { advisorId } });
      setFavoriteId(advisorId, r.saved);
      setSaved(r.saved);
    } catch {
      /* keep current heart */
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      aria-label={saved ? "Unsave advisor" : "Save advisor"}
      aria-pressed={saved}
      className={cn(
        "relative grid size-9 place-items-center rounded-full text-faint after:absolute after:inset-[-4px] hover:text-primary",
        className,
      )}
    >
      <Heart className={cn("size-4.5 size-[1.05rem]", saved ? "fill-primary text-primary" : "")} strokeWidth={1.7} />
    </button>
  );
}

export function AdvisorCard({ advisor, showRank = false }: { advisor: Advisor; showRank?: boolean }) {
  return (
    <article className="relative flex h-full flex-col rounded-2xl bg-surface px-3 pt-3 pb-2.5 shadow-[var(--shadow-border)]">
      <FavoriteHeart advisorId={advisor.id} className="absolute top-1.5 right-1.5 z-10" />
      <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false} className="block min-w-0 pr-6">
        <div className="relative w-fit">
          <div className="size-[4.4rem] overflow-hidden rounded-full bg-elevated">
            <AdvisorMedia photo={advisor.photoUrl} className="outline-none" />
          </div>
          {showRank && typeof advisor.monthlyRank === "number" ? (
            <span className="absolute -top-1 -left-1 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-fg">
              #{advisor.monthlyRank}
            </span>
          ) : null}
          {advisor.trusted ? (
            <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-fg">
              <ShieldCheck className="size-3" />
            </span>
          ) : null}
          <PresenceBadge
            advisor={advisor}
            className="absolute -bottom-1 left-[3.15rem] bg-surface shadow-[var(--shadow-border)]"
          />
        </div>
        <p className="mt-3.5 truncate font-display text-[1.05rem] leading-tight">{advisor.name}</p>
        <p className="truncate text-xs text-muted">{primarySpecialty(advisor)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg">
          <AdvisorRating advisor={advisor} />
          <span className="text-faint">|</span>
          <span>{formatUsdPerMin(advisor.rateCoins)}</span>
        </div>
      </Link>
      <ChatNow advisor={advisor} className="mt-2.5 h-9 w-full rounded-full px-2 text-sm" />
    </article>
  );
}

export function AdvisorRecommendCard({ advisor }: { advisor: Advisor }) {
  return (
    <article className="relative flex w-[16.75rem] shrink-0 items-center gap-3 rounded-2xl bg-surface p-3 pr-9 shadow-[var(--shadow-border)]">
      <FavoriteHeart advisorId={advisor.id} className="absolute top-1.5 right-1.5 z-10" />
      <Link
        to="/advisors/$id"
        params={{ id: advisor.slug }}
        preload={false}
        className="size-[3.35rem] shrink-0 overflow-hidden rounded-full bg-elevated"
      >
        <AdvisorMedia photo={advisor.photoUrl} className="outline-none" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false} className="block">
          <p className="truncate font-display text-base leading-tight">{advisor.name}</p>
          <p className="truncate text-xs text-muted">{primarySpecialty(advisor)}</p>
          <AdvisorRating advisor={advisor} />
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <PresenceBadge advisor={advisor} />
          <span className="text-xs text-fg">{formatUsdPerMin(advisor.rateCoins)}</span>
        </div>
      </div>
    </article>
  );
}

export function AdvisorRow({ advisor, showRank = false }: { advisor: Advisor; showRank?: boolean }) {
  return (
    <div className="relative flex gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <FavoriteHeart advisorId={advisor.id} className="absolute top-2 right-2 z-10" />
      <Link
        to="/advisors/$id"
        params={{ id: advisor.slug }}
        preload={false}
        className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-full bg-elevated"
      >
        <AdvisorMedia photo={advisor.photoUrl} className="outline-none" />
        {showRank && typeof advisor.monthlyRank === "number" ? (
          <span className="absolute top-0.5 right-0.5 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-fg">
            #{advisor.monthlyRank}
          </span>
        ) : null}
      </Link>
      <div className="min-w-0 flex-1 pr-6">
        <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false}>
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-lg leading-tight">{advisor.name}</p>
            {advisor.isNew ? (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
                New
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted">{advisor.specialties}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <AdvisorRating advisor={advisor} />
            <span className="text-xs text-fg">{formatUsdPerMin(advisor.rateCoins)}</span>
          </div>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <PresenceBadge advisor={advisor} />
          <ChatNow advisor={advisor} className="h-9 flex-1 rounded-full px-3 text-xs" />
        </div>
      </div>
    </div>
  );
}

export function NotifySwitch({
  checked,
  disabled,
  onChange,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-3 text-sm text-fg", className)}>
      <span>Notify me when online</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Notify me when online"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-primary" : "bg-[#d9d2d6]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </label>
  );
}

export function TalkAgainCard({ advisor }: { advisor: Advisor }) {
  const live = advisor.online && !advisor.busy;
  return (
    <article className="relative flex w-[16.5rem] shrink-0 flex-col rounded-2xl bg-surface p-3 pr-9 shadow-[var(--shadow-border)]">
      <FavoriteHeart advisorId={advisor.id} className="absolute top-1.5 right-1.5 z-10" />
      <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false} className="flex items-center gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-full bg-elevated">
          <AdvisorMedia photo={advisor.photoUrl} className="outline-none" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-base leading-tight text-fg">{advisor.name}</p>
          <p className="truncate text-xs text-muted">{primarySpecialty(advisor)}</p>
          <PresenceBadge advisor={advisor} className="mt-1" />
        </div>
      </Link>
      {live ? (
        <ChatNow advisor={advisor} label="Chat Again" className="mt-2.5 h-9 w-full rounded-full px-2 text-xs" />
      ) : (
        <Link
          to="/advisors/$id"
          params={{ id: advisor.slug }}
          preload={false}
          className="mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-full bg-elevated text-xs font-medium text-fg"
        >
          View Profile
        </Link>
      )}
    </article>
  );
}

import { Link } from "@tanstack/react-router";
import { ShieldCheck, Star } from "lucide-react";
import { AdvisorMedia } from "@/components/advisor-media";
import { ChatNow, PresenceBadge } from "@/components/chat-now";
import type { Advisor } from "@/lib/ora";

export function AdvisorRating({ advisor }: { advisor: Advisor }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary">
      <Star className="size-3 fill-primary text-primary" />
      {advisor.rating.toFixed(1)}
      <span className="text-faint">({advisor.reviews})</span>
    </span>
  );
}

export function AdvisorCard({ advisor, showRank = false }: { advisor: Advisor; showRank?: boolean }) {
  return (
    <div>
      <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false} className="block">
        <div className="relative aspect-3/4 overflow-hidden rounded-xl bg-elevated">
          <AdvisorMedia photo={advisor.photoUrl} />
          {showRank && typeof advisor.monthlyRank === "number" ? (
            <span className="absolute top-2 right-2 inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-fg">
              #{advisor.monthlyRank}
            </span>
          ) : null}
          {advisor.trusted ? (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-xs text-primary">
              <ShieldCheck className="size-3" />
              Trusted
            </span>
          ) : null}
          <PresenceBadge advisor={advisor} className="absolute bottom-2 left-2" />
        </div>
        <p className="mt-2 truncate font-display text-base leading-tight">{advisor.name}</p>
        <p className="truncate text-xs text-muted">{advisor.specialties}</p>
        <AdvisorRating advisor={advisor} />
      </Link>
      <p className="mt-1 text-xs text-primary">{advisor.rateCoins}c / min</p>
      <ChatNow advisor={advisor} className="mt-2 h-9 w-full px-2 text-xs" />
    </div>
  );
}

export function AdvisorRow({ advisor, showRank = false }: { advisor: Advisor; showRank?: boolean }) {
  return (
    <div className="flex gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <Link
        to="/advisors/$id"
        params={{ id: advisor.slug }}
        preload={false}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-elevated"
      >
        <AdvisorMedia photo={advisor.photoUrl} />
        {showRank && typeof advisor.monthlyRank === "number" ? (
          <span className="absolute top-1 right-1 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-fg">
            #{advisor.monthlyRank}
          </span>
        ) : null}
        <PresenceBadge advisor={advisor} className="absolute bottom-1 left-1 scale-90" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to="/advisors/$id" params={{ id: advisor.slug }} preload={false}>
          <div className="flex items-center gap-2">
            <p className="font-display text-lg leading-tight">{advisor.name}</p>
            {showRank && typeof advisor.monthlyRank === "number" ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg">
                #{advisor.monthlyRank}
              </span>
            ) : null}
            {advisor.isNew ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                New
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted">{advisor.specialties}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <AdvisorRating advisor={advisor} />
            <span className="text-xs text-primary">{advisor.rateCoins}c / min</span>
          </div>
        </Link>
        <ChatNow advisor={advisor} className="mt-2 h-9 px-3 text-xs" />
      </div>
    </div>
  );
}

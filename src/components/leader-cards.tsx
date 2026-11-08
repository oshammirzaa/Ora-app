import { Link } from "@tanstack/react-router";
import { AdvisorMedia } from "@/components/advisor-media";
import { AdvisorRating, formatUsdPerMin } from "@/components/advisor-cards";
import { ChatNow, PresenceBadge, PresenceDot } from "@/components/chat-now";
import type { Advisor } from "@/lib/ora";

export function LeaderCard({
  advisor,
  rank,
  badge,
}: {
  advisor: Advisor;
  rank: number;
  badge: string;
}) {
  const slug = String(advisor.slug || advisor.id || "");
  if (!advisor.id || !slug) return null;
  return (
    <article className="flex h-full w-[11.5rem] shrink-0 flex-col rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg">
          #{rank}
        </span>
        <span className="truncate rounded-full bg-[#fbf6ea] px-2 py-0.5 text-[10px] font-medium text-[#8d6b32]">
          {badge}
        </span>
      </div>
      <Link to="/advisors/$id" params={{ id: slug }} preload={false} className="mt-3 block min-w-0">
        <div className="relative w-fit">
          <div className="size-16 overflow-hidden rounded-full bg-elevated">
            <AdvisorMedia photo={advisor.photoUrl} className="outline-none" />
          </div>
          <PresenceDot advisor={advisor} className="absolute right-0.5 bottom-0.5" />
        </div>
        <p className="mt-2 truncate font-display text-lg leading-tight text-fg">{advisor.name}</p>
        <AdvisorRating advisor={advisor} />
        <PresenceBadge advisor={advisor} className="mt-1" />
        <p className="mt-1 text-xs text-fg">{formatUsdPerMin(advisor.rateCoins)}</p>
      </Link>
      <div className="mt-auto space-y-2 pt-3">
        <Link
          to="/advisors/$id"
          params={{ id: slug }}
          preload={false}
          className="inline-flex h-8 w-full items-center justify-center rounded-full bg-elevated text-xs font-medium text-fg"
        >
          View profile
        </Link>
        <ChatNow advisor={advisor} label="Start Chat" className="h-9 w-full rounded-full px-2 text-sm" />
      </div>
    </article>
  );
}

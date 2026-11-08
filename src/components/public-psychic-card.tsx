import { Link } from "@tanstack/react-router";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { AdvisorMedia } from "@/components/advisor-media";
import { AdvisorRating, formatUsdPerMin, primarySpecialty } from "@/components/advisor-cards";
import { PresenceBadge, PresenceDot } from "@/components/chat-now";
import { appHref, type PublicPsychic } from "@/lib/ora-domains";
import { advisorShowsTrustedBadge } from "@/lib/ora-rank";
import { presenceState } from "@/lib/ora-presence";

export function PublicPsychicCard({
  advisor,
  marketingHost,
  rank,
  badge,
}: {
  advisor: PublicPsychic;
  marketingHost: boolean;
  rank?: number | null;
  badge?: string;
}) {
  const slug = advisor.slug || advisor.id;
  const state = presenceState(advisor);
  const blocked = state === "offline" || state === "busy";
  const chatLabel = state === "offline" ? "Offline" : state === "busy" ? "In Session" : "Chat Now";
  const showRank = typeof rank === "number" && rank > 0;
  return (
    <article className="advisor-tile relative rounded-2xl bg-surface px-3 pt-3 pb-2.5 shadow-[var(--shadow-border)]">
      {showRank ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg">
            #{rank}
          </span>
          {badge ? (
            <span className="truncate rounded-full bg-[#fbf6ea] px-2 py-0.5 text-[10px] font-medium text-[#8d6b32]">{badge}</span>
          ) : null}
        </div>
      ) : null}
      <Link to="/psychics/$id" params={{ id: slug }} preload={false} className="block min-w-0">
        <div className="relative w-fit">
          <div className="size-[4.4rem] overflow-hidden rounded-full bg-elevated">
            <AdvisorMedia photo={advisor.photoUrl} className="outline-none" />
          </div>
          {advisorShowsTrustedBadge(advisor) ? (
            <span className="absolute -top-0.5 -left-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-fg">
              <ShieldCheck className="size-3" />
            </span>
          ) : null}
          <PresenceDot advisor={advisor} className="absolute right-0.5 bottom-0.5" />
        </div>
        <p className="mt-3.5 truncate font-display text-[1.05rem] leading-tight text-fg">{advisor.name}</p>
        <p className="truncate text-xs text-muted">{primarySpecialty(advisor) || "Specialties on profile"}</p>
        <PresenceBadge advisor={advisor} className="mt-1" />
        <div className="advisor-tile-rate mt-1 text-xs text-fg">
          <AdvisorRating advisor={advisor} />
          <span className="text-faint">|</span>
          <span>{advisor.rateCoins > 0 ? formatUsdPerMin(advisor.rateCoins) : "Rate on profile"}</span>
        </div>
      </Link>
      <div className="advisor-tile-action">
        {showRank ? (
          <Link
            to="/psychics/$id"
            params={{ id: slug }}
            preload={false}
            className="mb-2 inline-flex h-8 w-full items-center justify-center rounded-full bg-elevated text-xs font-medium text-fg"
          >
            View profile
          </Link>
        ) : null}
        {blocked ? (
          <span className="inline-flex h-9 w-full items-center justify-center rounded-full bg-elevated text-sm text-faint">
            {chatLabel}
          </span>
        ) : (
          <a
            href={appHref(`/advisors/${slug}`, marketingHost)}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-medium text-primary-fg"
          >
            <MessageCircle className="size-4" />
            {showRank ? "Start Chat" : "Chat Now"}
          </a>
        )}
      </div>
    </article>
  );
}

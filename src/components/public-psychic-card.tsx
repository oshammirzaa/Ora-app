import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { MessageCircle, ShieldCheck, Crown, Diamond, Flame, Heart, Star, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { AdvisorMedia } from "@/components/advisor-media";
import { AdvisorRating, formatUsdPerMin, primarySpecialty } from "@/components/advisor-cards";
import { PresenceBadge, PresenceDot } from "@/components/chat-now";
import { appHref, type PublicPsychic } from "@/lib/ora-domains";
import { advisorShowsTrustedBadge } from "@/lib/ora-rank";
import { PSYCHIC_CATEGORIES, psychicCategoryById } from "@/lib/ora-psychic-categories";
import { presenceState } from "@/lib/ora-presence";

export function PublicPsychicCard({
  advisor,
  marketingHost,
  eager = false,
}: {
  advisor: PublicPsychic;
  marketingHost: boolean;
  eager?: boolean;
}) {
  const slug = advisor.slug || advisor.id;
  const state = presenceState(advisor);
  const blocked = state === "offline" || state === "busy";
  const chatLabel = state === "offline" ? "Offline" : state === "busy" ? "In Session" : "Chat";
  const specialty = primarySpecialty(advisor) || "Specialty on profile";
  const bio = String(advisor.bio || "").trim();
  const rank = advisor.manualRank ?? advisor.monthlyRank;
  const showRank = typeof rank === "number" && rank >= 1 && rank <= 10;

  return (
    <article className="ora-lift flex h-full w-full flex-col rounded-2xl border border-[#efe4ea] bg-white p-3.5 shadow-[0_12px_32px_-22px_rgba(122,78,108,0.55)]">
      <Link to="/psychics/$id" params={{ id: slug }} preload={false} className="block min-w-0">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="size-16 overflow-hidden rounded-2xl bg-[#f6f1f4]">
              <AdvisorMedia photo={advisor.photoUrl} alt="" eager={eager} className="outline-none" />
            </div>
            <PresenceDot advisor={advisor} className="absolute -right-0.5 -bottom-0.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {showRank ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-fg">#{rank}</span>
              ) : null}
              {advisorShowsTrustedBadge(advisor) ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f8eef3] px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  <ShieldCheck className="size-3" strokeWidth={2.25} />
                  Trusted
                </span>
              ) : null}
              {advisor.isNew ? (
                <span className="rounded-full bg-[#fbf6ea] px-1.5 py-0.5 text-[10px] font-semibold text-[#8d6b32]">New</span>
              ) : null}
              {(advisor.psychicCategories || []).slice(0, 2).map((id) => {
                const cat = psychicCategoryById(id);
                if (!cat) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: cat.bg, color: cat.color }}>
                    {cat.label.split(" ")[0]}
                  </span>
                );
              })}
            </div>
            <p className="mt-1 truncate text-base font-semibold text-[#2a2430]">{advisor.name}</p>
            <p className="truncate text-sm font-semibold text-primary">{specialty}</p>
          </div>
        </div>
        {bio ? <p className="mt-3 line-clamp-2 text-sm leading-snug text-[#5c5366]">{bio}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {advisor.reviews > 0 ? (
            <AdvisorRating advisor={advisor} />
          ) : (
            <span className="text-sm text-[#72687a]">No reviews yet</span>
          )}
          <PresenceBadge advisor={advisor} />
        </div>
        <p className="mt-2 text-sm font-semibold text-[#2a2430]">
          {advisor.rateCoins > 0 ? (
            <>
              {formatUsdPerMin(advisor.rateCoins)}
              <span className="font-medium text-[#72687a]"> · {advisor.rateCoins} coins/min</span>
            </>
          ) : (
            <span className="font-medium text-[#72687a]">Rate on profile</span>
          )}
        </p>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/psychics/$id"
          params={{ id: slug }}
          preload={false}
          className="inline-flex h-11 items-center justify-center rounded-full border border-[#e6d5df] text-sm font-semibold text-[#2a2430]"
        >
          View Profile
        </Link>
        {blocked ? (
          <span className="inline-flex h-11 items-center justify-center rounded-full bg-[#f4f1f3] text-sm font-semibold text-[#a39aaa]">
            {chatLabel}
          </span>
        ) : (
          <a
            href={appHref(`/advisors/${slug}`, marketingHost)}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-fg"
          >
            <MessageCircle className="size-4" strokeWidth={2.25} />
            Chat
          </a>
        )}
      </div>
    </article>
  );
}

export function AdvisorScroller({
  advisors,
  marketingHost,
  showArrows = false,
}: {
  advisors: PublicPsychic[];
  marketingHost: boolean;
  showArrows?: boolean;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  function slide(direction: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(280, node.clientWidth * 0.8), behavior: "smooth" });
  }
  return (
    <div className="relative">
      {showArrows ? (
        <button
          type="button"
          aria-label="Previous advisors"
          onClick={() => slide(-1)}
          className="absolute top-1/2 left-1 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#efe4ea] bg-white/95 text-[#6d3054] shadow-sm"
        >
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      <ul ref={scroller} className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {advisors.map((advisor, index) => (
          <li key={advisor.id} className="flex w-[18.5rem] shrink-0 snap-start">
            <PublicPsychicCard advisor={advisor} marketingHost={marketingHost} eager={index < 3} />
          </li>
        ))}
      </ul>
      {showArrows ? (
        <button
          type="button"
          aria-label="Next advisors"
          onClick={() => slide(1)}
          className="absolute top-1/2 right-1 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#efe4ea] bg-white/95 text-[#6d3054] shadow-sm"
        >
          <ChevronRight className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

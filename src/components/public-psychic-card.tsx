import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AdvisorMedia } from "@/components/advisor-media";
import { AdvisorRating, formatUsdPerMin, primarySpecialty } from "@/components/advisor-cards";
import { PresenceBadge, PresenceDot } from "@/components/chat-now";
import { appHref, type PublicPsychic } from "@/lib/ora-domains";
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
  const specialty = primarySpecialty(advisor) || "";
  const primaryCat = (advisor.psychicCategories || [])[0];
  const cat = primaryCat ? psychicCategoryById(primaryCat) : null;

  return (
    <article className="flex h-full w-full flex-col rounded-2xl border border-[#efe4ea] bg-white p-3 shadow-[0_8px_24px_-16px_rgba(90,45,74,0.4)]">
      <Link to="/psychics/$id" params={{ id: slug }} preload={false} className="block min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="size-14 overflow-hidden rounded-full bg-[#f6f1f4]">
              <AdvisorMedia photo={advisor.photoUrl} alt="" eager={eager} className="size-full object-cover" />
            </div>
            <PresenceDot advisor={advisor} className="absolute -right-0.5 -bottom-0.5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-1.5">
              {cat ? (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: cat.bg, color: cat.color }}>
                  {cat.label.split(" ")[0]}
                </span>
              ) : null}
              <p className="truncate text-sm font-semibold text-[#2a2430]">{advisor.name}</p>
            </div>
            <p className="truncate text-xs text-[#72687a]">{specialty}</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {advisor.reviews > 0 ? <AdvisorRating advisor={advisor} /> : null}
          <PresenceBadge advisor={advisor} />
        </div>
        <p className="mt-1.5 text-xs font-semibold text-[#2a2430]">
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
          className="inline-flex h-9 items-center justify-center rounded-full border border-[#e6d5df] text-xs font-semibold text-[#2a2430]"
        >
          View Profile
        </Link>
        {blocked ? (
          <span className="inline-flex h-9 items-center justify-center rounded-full bg-[#f4f1f3] text-xs font-semibold text-[#a39aaa]">
            {chatLabel}
          </span>
        ) : (
          <a
            href={appHref(`/advisors/${slug}`, marketingHost)}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-[#6d3054] text-xs font-semibold text-white"
          >
            <MessageCircle className="size-3.5" strokeWidth={2.25} />
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
}: {
  advisors: PublicPsychic[];
  marketingHost: boolean;
}) {
  return (
    <div className="relative">
      <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {advisors.map((advisor, index) => (
          <li key={advisor.id} className="flex w-[17.5rem] shrink-0 snap-start sm:w-[18rem]">
            <PublicPsychicCard advisor={advisor} marketingHost={marketingHost} eager={index < 3} />
          </li>
        ))}
      </ul>
    </div>
  );
}

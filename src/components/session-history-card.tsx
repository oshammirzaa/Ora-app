import { Link } from "@tanstack/react-router";
import { AdvisorMedia } from "@/components/advisor-media";
import { ChatNow } from "@/components/chat-now";
import {
  formatClock,
  formatWhen,
  sessionAdvisor,
  sessionStatusLabel,
  type SessionRow,
} from "@/lib/ora";

export function SessionHistoryCard({ session: s }: { session: SessionRow }) {
  const advisor = sessionAdvisor(s);
  const canChat = advisor.online && !advisor.busy;

  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <Link to="/reading/$id" params={{ id: s.id }} className="flex items-center gap-3">
        <div className="size-14 overflow-hidden rounded-full bg-elevated">
          <AdvisorMedia photo={s.photoUrl} className="outline-none" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight text-fg">{s.advisorName}</p>
          <p className="text-xs text-muted">
            {formatWhen(s.startedAt)}
            {s.endedAt ? ` – ${formatWhen(s.endedAt)}` : ""}
          </p>
          <p className="text-xs text-muted">
            {s.kind} · {formatClock(s.seconds)} · {s.coinsSpent}c
          </p>
          <p className="text-xs text-primary">
            {sessionStatusLabel(s.status)}
            {s.status === "ended" && !s.reviewed ? " · Rate this reading" : ""}
          </p>
        </div>
      </Link>
      {s.status === "ended" ? (
        <div className="mt-2">
          {canChat ? (
            <ChatNow advisor={advisor} label="Chat Again" className="h-9 w-full rounded-full px-3 text-xs" />
          ) : (
            <Link
              to="/advisors/$id"
              params={{ id: s.advisorSlug }}
              preload={false}
              className="inline-flex h-9 w-full items-center justify-center rounded-full bg-elevated text-xs font-medium text-fg"
            >
              View Profile
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

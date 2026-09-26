import { useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { type MouseEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isHouseAdvisor, requestChat, type Advisor } from "@/lib/ora";
import { rememberLiveRequest } from "@/lib/live-request";
import { presenceLabel, presenceState, type PresenceBits } from "@/lib/ora-presence";
import { cn } from "@/lib/utils";

export function PresenceDot({ advisor, className }: { advisor: PresenceBits; className?: string }) {
  const state = presenceState(advisor);
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 rounded-full ring-2 ring-surface",
        state === "online" ? "bg-ok" : state === "busy" ? "bg-warn" : "bg-faint",
        className,
      )}
    />
  );
}

export function PresenceBadge({ advisor, className }: { advisor: PresenceBits; className?: string }) {
  const state = presenceState(advisor);
  const live = state === "online";
  const busy = state === "busy";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        live ? "bg-ok/12 text-ok" : busy ? "bg-warn/15 text-warn" : "bg-elevated text-faint",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", live ? "bg-ok" : busy ? "bg-warn" : "bg-faint")} />
      {presenceLabel(state)}
    </span>
  );
}

export function OnlineNowCount({ count, className }: { count: number; className?: string }) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return (
    <p className={cn("inline-flex items-center gap-2 text-sm text-fg", className)}>
      <span className="size-2 rounded-full bg-ok" />
      <span>
        <span className="tabular-nums font-medium">{n}</span>{" "}
        {n === 1 ? "Psychic Online Now" : "Psychics Online Now"}
      </span>
    </p>
  );
}

export function ChatNow({
  advisor,
  className,
  label: labelProp,
}: {
  advisor: Advisor;
  className?: string;
  label?: string;
}) {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const house = isHouseAdvisor(advisor.userId);
  const state = presenceState(advisor);
  const blocked = state === "offline" || (state === "busy" && !house);
  const label =
    state === "offline" ? "Offline" : state === "busy" && !house ? "In Session" : labelProp || "Chat Now";

  async function go(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      await navigate({ to: "/login" });
      return;
    }
    if (blocked) {
      toast.error(state === "busy" ? "Advisor is in a session." : "This advisor is offline.");
      return;
    }
    try {
      const res = await requestChat({ data: { advisorId: advisor.id } });
      if (res.mode === "live" && res.id) {
        await navigate({ to: "/reading/$id", params: { id: res.id } });
      } else if (res.requestId) {
        rememberLiveRequest(res.requestId);
        await navigate({ to: "/wait/$id", params: { id: res.requestId } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start");
    }
  }

  return (
    <Button type="button" className={className} disabled={blocked} onClick={(e) => void go(e)}>
      {!blocked ? <MessageCircle className="size-4" /> : null}
      {label}
    </Button>
  );
}

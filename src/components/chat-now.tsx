import { useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { type MouseEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isHouseAdvisor, requestChat, type Advisor } from "@/lib/ora";
import { cn } from "@/lib/utils";

export function PresenceBadge({ advisor, className }: { advisor: Advisor; className?: string }) {
  const live = advisor.online && !advisor.busy;
  const busy = advisor.online && advisor.busy;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        live ? "bg-ok/12 text-ok" : busy ? "bg-warn/15 text-warn" : "bg-elevated text-faint",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", live ? "bg-ok" : busy ? "bg-warn" : "bg-faint")} />
      {live ? "Online" : busy ? "Busy" : "Offline"}
    </span>
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
  const blocked = !advisor.online || (advisor.busy && !house);
  const label = !advisor.online ? "Offline" : advisor.busy && !house ? "Busy" : labelProp || "Chat Now";

  async function go(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      await navigate({ to: "/login" });
      return;
    }
    if (blocked) {
      toast.error(advisor.online ? "Advisor is in a session." : "This advisor is offline.");
      return;
    }
    try {
      const res = await requestChat({ data: { advisorId: advisor.id } });
      if (res.mode === "live" && res.id) {
        await navigate({ to: "/reading/$id", params: { id: res.id } });
      } else if (res.requestId) {
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

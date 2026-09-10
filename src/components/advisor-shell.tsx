import { Link, useNavigate } from "@tanstack/react-router";
import { Banknote, LayoutDashboard, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { OraMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { decideRequest, getInbox, type DeskRequest } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "desk", to: "/advisor", label: "Desk", icon: LayoutDashboard },
  { id: "earnings", to: "/advisor/earnings", label: "Earnings", icon: Banknote },
  { id: "profile", to: "/advisor/profile", label: "Profile", icon: UserRound },
] as const;

export type AdvisorTab = (typeof TABS)[number]["id"];

export function AdvisorShell({
  children,
  tab,
  online,
  busy,
  canToggle,
  onToggle,
}: {
  children: ReactNode;
  tab: AdvisorTab;
  online?: boolean;
  busy?: boolean;
  canToggle?: boolean;
  onToggle?: (online: boolean) => void;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col md:shadow-[var(--shadow-border)]">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-bg/90 px-4 backdrop-blur-md">
          <OraMark />
          <div className="flex items-center gap-2">
            {canToggle ? (
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  onToggle?.(!online);
                }}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-3 text-xs font-medium",
                  busy ? "bg-warn/20 text-warn" : online ? "bg-ok/20 text-ok" : "bg-elevated text-muted",
                )}
              >
                {busy ? "Busy" : online ? "Online" : "Offline"}
              </button>
            ) : null}
            <UserButton />
          </div>
        </header>
        <div className="flex-1 pb-20">
          {canToggle && tab !== "desk" && !busy ? <IncomingBanner /> : null}
          {children}
        </div>
        <nav className="sticky bottom-0 z-40 grid h-16 grid-cols-3 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <Link
                key={t.id}
                to={t.to}
                preload={false}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
                  on ? "text-primary" : "text-faint",
                )}
              >
                <Icon className="size-5" strokeWidth={on ? 2.2 : 1.8} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function IncomingBanner() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<DeskRequest[]>([]);
  const [working, setWorking] = useState(false);

  useVisibleInterval(() => {
    void getInbox()
      .then((d) => setRequests(d.live ? [] : d.requests))
      .catch(() => setRequests([]));
  }, 3000);

  const r = requests[0];
  if (!r) return null;

  async function decide(accept: boolean) {
    if (working) return;
    setWorking(true);
    try {
      const res = await decideRequest({ data: { id: r.id, accept } });
      if (accept && res.readingId) {
        await navigate({ to: "/advisor/session/$id", params: { id: res.readingId } });
        return;
      }
      toast.success("Declined.");
      setRequests((cur) => cur.filter((x) => x.id !== r.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decide");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="border-b border-border bg-surface px-4 py-3">
      <p className="text-xs tracking-wide text-warn uppercase">Incoming chat</p>
      <p className="font-display text-lg">{r.clientName}</p>
      <p className="text-xs text-faint">Billing starts when you accept.</p>
      <div className="mt-2 flex gap-2">
        <Button className="flex-1" disabled={working} onClick={() => void decide(true)}>
          Accept
        </Button>
        <Button variant="outline" className="flex-1" disabled={working} onClick={() => void decide(false)}>
          Decline
        </Button>
      </div>
    </div>
  );
}

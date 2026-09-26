import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Gift, House, MessageSquare, Plus, User, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe } from "@/lib/client-cache";
import { getRequest, type Me } from "@/lib/ora";
import { clearLiveRequest, readLiveRequest } from "@/lib/live-request";
import { listCustomerInbox } from "@/lib/ora-paid-messages-api";
import { askMessageNotificationPermission, notifyNewMessage, playMessageSound, unlockMessageSound } from "@/lib/message-sound";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { MembershipTab } from "@/components/membership-tab";
import { CustomerAlerts } from "@/components/alerts-bell";
import { PhotoNudge } from "@/components/photo-nudge";
import { OraMark } from "@/components/ora-brand";
import { cn } from "@/lib/utils";

export { OraMark } from "@/components/ora-brand";

function GoldCoin() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx="12" cy="12" r="11" className="fill-gold" />
      <circle cx="12" cy="12" r="8.2" fill="none" className="stroke-gold-fg/25" strokeWidth="1.2" />
      <path
        d="M12.2 6.6c-2.2 0-3.4 1.1-3.4 2.4 0 1.2 1 1.9 2.8 2.3l.7.16c1.1.24 1.5.5 1.5 1.05 0 .62-.7 1.05-1.8 1.05-1.2 0-2-.46-2.2-1.2H8.2c.24 1.5 1.6 2.4 3.4 2.55V16.5h1.5v-1.64c1.9-.22 3.3-1.2 3.3-2.7 0-1.3-1-2.05-2.9-2.48l-.7-.16c-1-.22-1.4-.5-1.4-.96 0-.54.62-.92 1.6-.92 1.05 0 1.7.4 1.9 1.05h1.55c-.28-1.4-1.55-2.24-3.3-2.4V6.6h-1.45z"
        className="fill-gold-fg/70"
      />
    </svg>
  );
}

function ProfileLink() {
  const { user } = useCurrentUserState();
  return (
    <Link
      to={user ? "/me" : "/login"}
      preload={false}
      aria-label="Account"
      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-surface text-fg shadow-[var(--shadow-border)]"
    >
      {user?.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="size-10 object-cover outline-none" />
      ) : (
        <User className="size-4" strokeWidth={1.7} />
      )}
    </Link>
  );
}

function CustomerMessages() {
  const { user } = useCurrentUserState();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);
  const prev = useRef<number | null>(null);
  const onThread = /^\/messages\/.+/.test(path);

  useEffect(() => {
    const unlock = () => {
      unlockMessageSound();
      askMessageNotificationPermission();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useVisibleInterval(
    () => {
      if (!user) return;
      void listCustomerInbox()
        .then((data) => {
          const next = Number(data.unread) || 0;
          if (prev.current != null && next > prev.current && !onThread) {
            playMessageSound();
            const latest = data.threads.find((thread) => thread.unread > 0);
            notifyNewMessage(latest?.name || "New message", latest?.preview || "You have a new message");
          }
          prev.current = next;
          setUnread(next);
        })
        .catch(() => {});
    },
    5000,
    Boolean(user),
    false,
  );

  if (!user) return null;
  return (
    <Link
      to="/messages"
      preload={false}
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      className="relative grid size-10 place-items-center rounded-full bg-surface text-fg shadow-[var(--shadow-border)]"
    >
      <MessageSquare className="size-4" strokeWidth={1.7} />
      {unread ? (
        <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-fg">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

function TimeChip() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (!user) {
      setMe(null);
      return;
    }
    void cachedMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, [user?.id]);
  useVisibleInterval(
    () => {
      if (!user) return;
      void cachedMe()
        .then(setMe)
        .catch(() => {});
    },
    20_000,
    Boolean(user),
    false,
  );
  const coins = user && me ? me.wallet.coins : 0;
  if (isPending) return <div className="h-10 w-28 animate-pulse rounded-full bg-elevated" />;
  return (
    <div className="flex items-center gap-2">
      <Link
        to={user ? "/account" : "/login"}
        preload={false}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface py-1 pr-1 pl-1.5 shadow-[var(--shadow-border)]"
      >
        <GoldCoin />
        <span className="text-sm font-medium tabular-nums text-fg">{coins}c</span>
        <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-fg">
          <Plus className="size-3.5" strokeWidth={2.4} />
        </span>
      </Link>
      <CustomerMessages />
      <CustomerAlerts />
      <ProfileLink />
    </div>
  );
}

const TABS = [
  { id: "home", to: "/", label: "Home", icon: House },
  { id: "wallet", to: "/account", label: "Wallet", icon: Wallet },
  { id: "work", to: "/work", label: "Work", icon: Gift },
  { id: "you", to: "/me", label: "You", icon: User },
] as const;

export type AppTab = (typeof TABS)[number]["id"];

function LiveRequestFollow() {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useVisibleInterval(
    () => {
      if (!user || path.startsWith("/advisor") || path.startsWith("/reading/")) return;
      const id = readLiveRequest();
      if (!id) return;
      void getRequest({ data: { id } })
        .then((row) => {
          if (row.status === "accepted" && row.readingId) {
            clearLiveRequest();
            toast.success("Your advisor accepted. Opening the live chat.");
            void navigate({ to: "/reading/$id", params: { id: row.readingId } });
            return;
          }
          if (row.status === "declined" || row.status === "expired" || row.status === "missing") {
            clearLiveRequest();
          }
        })
        .catch(() => {});
    },
    2500,
    Boolean(user),
    true,
    false,
  );
  return null;
}

export function AppShell({
  children,
  tab,
  hideTab = false,
  hideHeader = false,
}: {
  children: ReactNode;
  tab?: AppTab;
  hideTab?: boolean;
  hideHeader?: boolean;
}) {
  const immersive = hideTab && hideHeader;
  return (
    <div className={cn("ora-canvas bg-bg text-fg", immersive ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <LiveRequestFollow />
      <div className={cn("mx-auto flex w-full max-w-[430px] flex-col md:shadow-[var(--shadow-border)]", immersive ? "h-dvh overflow-hidden" : "min-h-dvh")}>
        {hideHeader ? null : (
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-bg/92 px-4 backdrop-blur-md">
            <OraMark lockup />
            <TimeChip />
          </header>
        )}
        <div className={cn("flex-1", immersive ? "min-h-0 h-full overflow-hidden" : hideTab ? "" : "pb-1")}>{children}</div>
        {hideTab ? null : (
          <div className="sticky bottom-0 z-40 bg-gradient-to-t from-bg from-55% to-transparent px-4 pt-1 pb-[max(0.7rem,env(safe-area-inset-bottom))]">
            <nav className="grid h-[3.75rem] grid-cols-4 rounded-full bg-surface shadow-[var(--shadow-border)]">
              {TABS.map((t) => {
                const Icon = t.icon;
                const on = tab === t.id;
                return (
                  <Link
                    key={t.id}
                    to={t.to}
                    preload={false}
                    className={cn(
                      "relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                      on ? "font-medium text-primary" : "text-faint",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={on ? 2.25 : 1.7} fill={on ? "currentColor" : "none"} />
                    {t.label}
                    {on ? (
                      <span className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-primary" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
      {hideTab ? null : <MembershipTab afterHero={tab === "home"} />}
      <PhotoNudge />
    </div>
  );
}

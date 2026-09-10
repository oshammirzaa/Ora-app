import { Link } from "@tanstack/react-router";
import { Briefcase, Coins, House, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe, cachedPublicSettings } from "@/lib/client-cache";
import { formatClock, includedSeconds, type Me } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

export function OraMark({ className }: { className?: string }) {
  const [name, setName] = useState("Ora");
  const [logo, setLogo] = useState("");
  useEffect(() => {
    void cachedPublicSettings()
      .then((s) => {
        if (s.name) setName(s.name);
        if (s.logoUrl) setLogo(s.logoUrl);
      })
      .catch(() => {});
  }, []);
  return (
    <Link to="/" preload={false} className={cn("flex items-center gap-2 text-fg", className)}>
      {logo ? (
        <img src={logo} alt="" className="size-8 rounded-sm object-cover" />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-sm bg-primary">
          <span className="font-display text-sm text-primary-fg">{name.slice(0, 1)}</span>
        </span>
      )}
      <span className="font-display text-lg tracking-tight">{name}</span>
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
  if (isPending) return <div className="h-9 w-16 animate-pulse rounded-md bg-elevated" />;
  if (!user) {
    return (
      <Link
        to="/login"
        preload={false}
        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-fg"
      >
        Sign in
      </Link>
    );
  }
  const inc = me ? includedSeconds(me.wallet) : 0;
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/account"
        preload={false}
        className="inline-flex h-9 items-center rounded-md bg-elevated px-3 text-xs tabular-nums text-muted"
      >
        {me ? (inc > 0 ? formatClock(inc) : `${me.wallet.coins}c`) : "…"}
      </Link>
      <UserButton />
    </div>
  );
}

const TABS = [
  { id: "home", to: "/", label: "Home", icon: House },
  { id: "wallet", to: "/account", label: "Wallet", icon: Coins },
  { id: "work", to: "/advisor", label: "Work", icon: Briefcase },
  { id: "you", to: "/me", label: "You", icon: User },
] as const;

export type AppTab = (typeof TABS)[number]["id"];

export function AppShell({
  children,
  tab,
  hideTab = false,
}: {
  children: ReactNode;
  tab?: AppTab;
  hideTab?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col md:shadow-[var(--shadow-border)]">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-bg/90 px-4 backdrop-blur-md">
          <OraMark />
          <TimeChip />
        </header>
        <div className={cn("flex-1", hideTab ? "" : "pb-20")}>{children}</div>
        {hideTab ? null : (
          <nav className="sticky bottom-0 z-40 grid h-16 grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
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
        )}
      </div>
    </div>
  );
}

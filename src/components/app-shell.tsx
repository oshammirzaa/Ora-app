import { Link } from "@tanstack/react-router";
import { Gift, House, Plus, User, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe, cachedPublicSettings } from "@/lib/client-cache";
import { type Me } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { MembershipTab } from "@/components/membership-tab";
import { CustomerAlerts } from "@/components/alerts-bell";
import { cn } from "@/lib/utils";

export function OraMark({ className, lockup = false }: { className?: string; lockup?: boolean }) {
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
    <Link to="/" preload={false} className={cn("flex items-center gap-2.5 text-fg", className)}>
      {logo ? (
        <img
          src={logo}
          alt=""
          className={cn("object-cover outline-none", lockup ? "size-11 rounded-full" : "size-8 rounded-sm")}
        />
      ) : lockup ? (
        <MoonStarMark />
      ) : (
        <img src="/images/ora-logo.png" alt="" className="size-8 rounded-sm object-contain" />
      )}
      <span className={cn("flex min-w-0 flex-col", lockup ? "leading-none" : "")}>
        <span
          className={cn(
            "font-display tracking-tight",
            lockup ? "text-[1.85rem] leading-none text-primary" : "text-lg",
          )}
        >
          {name}
        </span>
        {lockup ? (
          <span className="mt-1 text-[11px] font-normal tracking-wide text-muted">Psychic Readings</span>
        ) : null}
      </span>
    </Link>
  );
}

function MoonStarMark() {
  return (
    <span className="relative grid size-11 place-items-center text-primary" aria-hidden>
      <svg viewBox="0 0 32 32" className="size-10 fill-current">
        <path d="M18.4 3.8C12 5.8 7.2 11.8 7.2 18.6c0 4.8 2.3 9.1 5.9 11.8C7.6 28.6 3 22.8 3 16 3 8.2 8.8 1.8 16.6 1c.6 1.1 1.2 2.1 1.8 2.8z" />
        <path d="M23.2 5.8l.78 2.28 2.28.78-2.28.78L23.2 12.9l-.78-2.28-2.28-.78 2.28-.78z" />
      </svg>
    </span>
  );
}

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
  return (
    <div className="ora-canvas min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col md:shadow-[var(--shadow-border)]">
        {hideHeader ? null : (
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-bg/92 px-4 backdrop-blur-md">
            <OraMark lockup />
            <TimeChip />
          </header>
        )}
        <div className={cn("flex-1", hideTab ? "" : "pb-1")}>{children}</div>
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
    </div>
  );
}

import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  MessageSquare,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Initials } from "@/components/advisor-desk";
import { OraMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorDeniedMessage, isAdvisorPublicPath } from "@/lib/ora-advisor-auth";
import { advisorEntryState, advisorPanelSession } from "@/lib/ora-advisor";
import { decideRequest, getInbox, setOnline, type DeskRequest } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

type AdvisorPath = "/advisor" | "/advisor/readings" | "/advisor/customers" | "/advisor/inbox" | "/advisor/profile";

type NavItem = { to: AdvisorPath; label: string; icon: LucideIcon };

const TABS: NavItem[] = [
  { to: "/advisor/readings", label: "Orders", icon: ClipboardList },
  { to: "/advisor/customers", label: "Clients", icon: Users },
  { to: "/advisor", label: "Statistics", icon: BarChart3 },
  { to: "/advisor/inbox", label: "Messages", icon: MessageSquare },
  { to: "/advisor/profile", label: "My Profile", icon: UserRound },
];

type Identity = {
  name: string;
  email: string;
  photoUrl?: string;
  online: boolean;
  busy: boolean;
  acceptsChat?: boolean;
};

const IdentityContext = createContext<Identity | null>(null);

type DeskStatus = {
  online: boolean;
  busy: boolean;
  setOnline: (next: boolean) => void;
  setBusy: (next: boolean) => void;
};

const DeskStatusContext = createContext<DeskStatus>({
  online: false,
  busy: false,
  setOnline: () => {},
  setBusy: () => {},
});

export function useAdvisorDeskStatus() {
  return useContext(DeskStatusContext);
}

export function AdvisorLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const matched = useRouterState({
    select: (s) =>
      s.matches.some((m) => {
        const rec = m as { fullPath?: string; pathname?: string };
        return isAdvisorPublicPath(String(rec.fullPath || rec.pathname || ""));
      }),
  });
  if (isAdvisorPublicPath(path) || matched) return <Outlet />;
  return (
    <AdvisorGuard>
      <AdvisorChrome>
        <Outlet />
      </AdvisorChrome>
    </AdvisorGuard>
  );
}

function AdvisorGuard({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<"load" | "ok" | "deny" | "pending" | "declined">("load");
  const [message, setMessage] = useState(advisorDeniedMessage("not_advisor"));
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setState("deny");
      return;
    }
    let alive = true;
    void advisorEntryState()
      .then(async (entry) => {
        if (!alive) return;
        if (entry.kind === "live") {
          try {
            const session = await advisorPanelSession();
            if (!alive) return;
            setIdentity({
              name: session.name,
              email: session.email,
              photoUrl: session.photoUrl,
              online: session.online,
              busy: session.busy,
              acceptsChat: session.acceptsChat,
            });
          } catch (err) {
            if (!alive) return;
            console.error("[ora] advisor panel session", err);
            setIdentity({
              name: entry.name || "Advisor",
              email: "",
              online: false,
              busy: false,
            });
          }
          setState("ok");
          return;
        }
        if (entry.kind === "pending") {
          setMessage(advisorDeniedMessage("pending"));
          setState("pending");
          return;
        }
        if (entry.kind === "declined") {
          setMessage(advisorDeniedMessage("declined"));
          setState("declined");
          return;
        }
        if (entry.kind === "paused") {
          setMessage(advisorDeniedMessage("paused"));
          setState("deny");
          return;
        }
        if (entry.kind === "suspended") {
          setMessage(advisorDeniedMessage("suspended"));
          setState("deny");
          return;
        }
        setMessage(advisorDeniedMessage("not_advisor"));
        setState("deny");
      })
      .catch((err) => {
        if (!alive) return;
        setMessage(err instanceof Error ? err.message : advisorDeniedMessage("not_advisor"));
        setState("deny");
      });
    return () => {
      alive = false;
    };
  }, [user, isPending]);

  if (isPending || state === "load") {
    return (
      <div className="min-h-dvh bg-bg p-8 text-fg">
        <div className="h-40 animate-pulse rounded-xl bg-elevated" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn to="/advisor/login" />;
  if (state === "pending") {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
        <OraMark />
        <h1 className="mt-8 font-display text-3xl">Application received</h1>
        <p className="mt-2 text-sm text-muted">
          Your advisor application is pending owner review. You cannot open the desk or go online until you are approved.
        </p>
        <div className="mt-6 space-y-3">
          <Button asChild className="w-full">
            <Link to="/advisor/applied">View status</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Back to readings</Link>
          </Button>
        </div>
      </main>
    );
  }
  if (state === "declined") {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
        <OraMark />
        <h1 className="mt-8 font-display text-3xl">Application declined</h1>
        <p className="mt-2 text-sm text-muted">{message} You may update your details and apply again.</p>
        <div className="mt-6 space-y-3">
          <Button asChild className="w-full">
            <Link to="/advisor/signup">Apply again</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Back to readings</Link>
          </Button>
        </div>
      </main>
    );
  }
  if (state === "deny" || !identity) {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
        <OraMark />
        <h1 className="mt-8 font-display text-3xl">Advisor access only</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-6 space-y-3">
          <Button asChild className="w-full">
            <Link to="/advisor/signup">Apply as Advisor</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/advisor/login">Advisor sign in</Link>
          </Button>
        </div>
      </main>
    );
  }
  return <IdentityContext.Provider value={identity}>{children}</IdentityContext.Provider>;
}

function deskChromeTitle(path: string, tab?: NavItem) {
  if (path.startsWith("/advisor/profile/edit")) return "Edit Profile";
  if (path.startsWith("/advisor/settings/security")) return "Account";
  if (path.startsWith("/advisor/settings/blocked")) return "Blocked Users";
  if (path.startsWith("/advisor/settings/reviews")) return "Rate & Review";
  if (path.startsWith("/advisor/settings/faq")) return "FAQ";
  if (path.startsWith("/advisor/settings/replies")) return "Quick Reply";
  if (path.startsWith("/advisor/settings")) return "Settings";
  if (path.startsWith("/advisor/earnings")) return "Revenue";
  return tab?.label ?? (path.startsWith("/advisor/session") ? "Reading" : "Advisor");
}

function tabForPath(path: string): NavItem | undefined {
  if (path.startsWith("/advisor/session")) return undefined;
  if (path === "/advisor" || path === "/advisor/" || path.startsWith("/advisor/activity")) return TABS[2];
  if (path.startsWith("/advisor/readings") || path.startsWith("/advisor/todo")) return TABS[0];
  if (path.startsWith("/advisor/customers") || path.startsWith("/advisor/notes")) return TABS[1];
  if (path.startsWith("/advisor/inbox")) return TABS[3];
  if (path.startsWith("/advisor/profile") || path.startsWith("/advisor/settings") || path.startsWith("/advisor/earnings")) {
    return TABS[4];
  }
  return TABS.find((item) => (item.to === "/advisor" ? path === "/advisor" || path === "/advisor/" : path === item.to || path.startsWith(`${item.to}/`)));
}

function AdvisorChrome({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const identity = useContext(IdentityContext);
  const [online, setIsOnline] = useState(Boolean(identity?.online));
  const [busy, setBusy] = useState(Boolean(identity?.busy));
  const session = path.startsWith("/advisor/session");

  useEffect(() => {
    setIsOnline(Boolean(identity?.online));
    setBusy(Boolean(identity?.busy));
  }, [identity]);

  async function toggle(next: boolean) {
    if (busy) return;
    try {
      await setOnline({ data: { online: next } });
      setIsOnline(next);
      toast.success(next ? "You are live on the floor." : "You are offline.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  const current = tabForPath(path);

  return (
    <DeskStatusContext.Provider value={{ online, busy, setOnline: setIsOnline, setBusy }}>
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-bg/90 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <Initials name={identity?.name || "A"} photo={identity?.photoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight">{deskChromeTitle(path, current)}</p>
            <p className="truncate text-xs text-faint">{identity?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void toggle(!online)}
            disabled={busy}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-3 text-xs font-medium",
              busy ? "bg-warn/20 text-warn" : online ? "bg-ok/20 text-ok" : "bg-elevated text-muted",
            )}
          >
            {busy ? "In a reading" : online ? "In service" : "Offline"}
          </button>
          <UserButton />
        </div>
      </header>
      <div className={cn("mx-auto w-full max-w-lg px-4 py-4", session ? "pb-6" : "pb-24")}>
        {busy || session ? null : <IncomingBanner />}
        {children}
      </div>
      {session ? null : (
        <nav
          aria-label="Advisor"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-bg/95 backdrop-blur-md"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
            {TABS.map((item) => {
              const on = current?.to === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    preload={false}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs",
                      on ? "text-primary" : "text-muted",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={on ? 2.3 : 1.8} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
    </DeskStatusContext.Provider>
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
    <div className="mb-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
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

export function AdvisorPageHeader({
  title,
  description,
  kicker,
}: {
  title: string;
  description?: string;
  kicker?: string;
}) {
  return (
    <div className="mb-4">
      {kicker ? <p className="text-xs tracking-wide text-faint uppercase">{kicker}</p> : null}
      <h1 className={cn("font-display text-3xl tracking-tight", kicker && "mt-1")}>{title}</h1>
      {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export function AdvisorStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs tracking-wide text-faint uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Kept for session/earnings pages that still pass a tab until they are fully migrated. */
export function AdvisorShell({
  children,
}: {
  children: ReactNode;
  tab?: string;
  online?: boolean;
  busy?: boolean;
  canToggle?: boolean;
  onToggle?: (online: boolean) => void;
}) {
  return <>{children}</>;
}

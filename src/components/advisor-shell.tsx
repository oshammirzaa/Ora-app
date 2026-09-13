import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Banknote,
  CheckSquare,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquare,
  NotebookPen,
  Settings,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { OraMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorDeniedMessage } from "@/lib/ora-advisor-auth";
import { advisorEntryState, advisorPanelSession } from "@/lib/ora-advisor";
import { decideRequest, getInbox, setOnline, type DeskRequest } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

type AdvisorPath =
  | "/advisor"
  | "/advisor/readings"
  | "/advisor/inbox"
  | "/advisor/customers"
  | "/advisor/notes"
  | "/advisor/todo"
  | "/advisor/earnings"
  | "/advisor/activity"
  | "/advisor/profile"
  | "/advisor/settings";

type NavItem = { to: AdvisorPath; label: string; icon: LucideIcon };

const PRIMARY: NavItem[] = [
  { to: "/advisor", label: "Overview", icon: LayoutDashboard },
  { to: "/advisor/readings", label: "Live Text Readings", icon: MessageSquare },
  { to: "/advisor/inbox", label: "Inbox", icon: Inbox },
  { to: "/advisor/customers", label: "Customers", icon: Users },
  { to: "/advisor/notes", label: "Private Notes", icon: NotebookPen },
  { to: "/advisor/todo", label: "Things To Do", icon: CheckSquare },
];

const MORE: NavItem[] = [
  { to: "/advisor/earnings", label: "Earnings", icon: Banknote },
  { to: "/advisor/activity", label: "Activity", icon: Activity },
  { to: "/advisor/profile", label: "Profile", icon: UserRound },
  { to: "/advisor/settings", label: "Settings", icon: Settings },
];

const ALL_NAV = [...PRIMARY, ...MORE];

type Identity = {
  name: string;
  email: string;
  online: boolean;
  busy: boolean;
};

const IdentityContext = createContext<Identity | null>(null);

export function AdvisorLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/advisor/login" || path === "/advisor/signup" || path === "/advisor/applied") return <Outlet />;
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
          const session = await advisorPanelSession();
          if (!alive) return;
          setIdentity({
            name: session.name,
            email: session.email,
            online: session.online,
            busy: session.busy,
          });
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

function AdvisorChrome({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const identity = useContext(IdentityContext);
  const [open, setOpen] = useState(false);
  const [online, setIsOnline] = useState(Boolean(identity?.online));
  const [busy, setBusy] = useState(Boolean(identity?.busy));

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

  const current = ALL_NAV.find((item) =>
    item.to === "/advisor" ? path === "/advisor" || path === "/advisor/" : path === item.to || path.startsWith(`${item.to}/`),
  );

  return (
    <AdvisorFrame
      path={path}
      title={current?.label ?? "Advisor"}
      identity={identity}
      open={open}
      setOpen={setOpen}
      online={online}
      busy={busy}
      onToggle={(v) => void toggle(v)}
    >
      {busy || path.startsWith("/advisor/session") ? null : <IncomingBanner />}
      {children}
    </AdvisorFrame>
  );
}

function AdvisorFrame({
  path,
  title,
  identity,
  open,
  setOpen,
  online,
  busy,
  onToggle,
  children,
}: {
  path: string;
  title: string;
  identity: Identity | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  online: boolean;
  busy: boolean;
  onToggle: (online: boolean) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-bg/70 md:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id="advisor-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-[var(--ease-out)]",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 md:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <OraMark />
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs tracking-wide text-primary uppercase">
              Advisor
            </span>
          </div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:text-fg md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Advisor" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-xs tracking-wide text-faint uppercase">Desk</p>
          <NavList items={PRIMARY} path={path} onNavigate={() => setOpen(false)} />
          <p className="mt-6 mb-2 px-3 text-xs tracking-wide text-faint uppercase">Account</p>
          <NavList items={MORE} path={path} onNavigate={() => setOpen(false)} />
        </nav>
        <div className="shrink-0 border-t border-border/60 p-3">
          <p className="truncate px-3 text-sm text-fg">{identity?.name || "Advisor"}</p>
          {identity?.email ? <p className="truncate px-3 text-xs text-faint">{identity.email}</p> : null}
          <Link
            to="/"
            className="mt-2 flex h-11 items-center gap-2 rounded-md px-3 text-sm text-muted transition-colors duration-150 ease-[var(--ease-out)] hover:bg-elevated hover:text-fg"
          >
            <ExternalLink className="size-4 shrink-0" />
            View marketplace
          </Link>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-bg/90 px-4 backdrop-blur-md md:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-md text-fg md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="advisor-sidebar"
            >
              <Menu className="size-5" />
            </button>
            <p className="truncate font-display text-lg">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggle(!online)}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-3 text-xs font-medium",
                busy ? "bg-warn/20 text-warn" : online ? "bg-ok/20 text-ok" : "bg-elevated text-muted",
              )}
            >
              {busy ? "Busy" : online ? "Online" : "Offline"}
            </button>
            <UserButton />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

function NavList({
  items,
  path,
  onNavigate,
}: {
  items: NavItem[];
  path: string;
  onNavigate: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const on =
          item.to === "/advisor"
            ? path === "/advisor" || path === "/advisor/"
            : path === item.to || path.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              preload={false}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 ease-[var(--ease-out)]",
                on ? "bg-elevated text-primary" : "text-muted hover:bg-elevated hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={on ? 2.2 : 1.8} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
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
    <div className="mb-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
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
    <div className="mb-6">
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
export function AdvisorShell({ children }: { children: ReactNode; tab?: string; online?: boolean; busy?: boolean; canToggle?: boolean; onToggle?: (online: boolean) => void }) {
  return <>{children}</>;
}

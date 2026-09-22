import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Award,
  Banknote,
  ChartColumn,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  Star,
  Tags,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { OraMark } from "@/components/app-shell";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminSession } from "@/lib/ora-admin";
import { cn } from "@/lib/utils";

type AdminPath =
  | "/admin"
  | "/admin/advisors"
  | "/admin/customers"
  | "/admin/sessions"
  | "/admin/trusted"
  | "/admin/finance"
  | "/admin/payouts"
  | "/admin/reports"
  | "/admin/support"
  | "/admin/settings"
  | "/admin/reviews"
  | "/admin/categories"
  | "/admin/promos"
  | "/admin/audit";

type NavItem = { to: AdminPath; label: string; icon: LucideIcon };

const PRIMARY: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/advisors", label: "Advisors", icon: Users },
  { to: "/admin/customers", label: "Customers", icon: UserRound },
  { to: "/admin/sessions", label: "Live Sessions", icon: MessageSquare },
  { to: "/admin/trusted", label: "Trusted Psychics", icon: Award },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/support", label: "Customer Support", icon: LifeBuoy },
  { to: "/admin/finance", label: "Finance", icon: Wallet },
  { to: "/admin/payouts", label: "Payouts", icon: Banknote },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

const MORE: NavItem[] = [
  { to: "/admin/reports", label: "Reports", icon: ChartColumn },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/promos", label: "Promos", icon: Gift },
];

const ALL_NAV = [...PRIMARY, ...MORE];

type AdminIdentity = { name: string; email: string };

const IdentityContext = createContext<AdminIdentity | null>(null);

export function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/admin/login") return <Outlet />;
  return (
    <AdminGuard>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </AdminGuard>
  );
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const gateSession = useSyncExternalStore(
    () => () => {},
    hasGateSessionMarker,
    () => false,
  );
  const [state, setState] = useState<"load" | "ok" | "deny">("load");
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      if (gateSession) return;
      setState("deny");
      return;
    }
    void adminSession()
      .then((s) => {
        setIdentity({ name: s.name, email: s.email });
        setState("ok");
      })
      .catch(() => setState("deny"));
  }, [user, isPending, gateSession]);

  useEffect(() => {
    if (user || !gateSession) return;
    const t = window.setTimeout(() => setState("deny"), 4000);
    return () => window.clearTimeout(t);
  }, [user, gateSession]);

  if (isPending || state === "load" || (gateSession && !user && state !== "deny")) {
    return (
      <div className="ora-canvas min-h-dvh bg-bg px-4 py-16 text-fg">
        <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-xl bg-elevated" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn to="/admin/login" />;
  if (state === "deny") {
    return (
      <main className="ora-canvas mx-auto min-h-dvh max-w-sm bg-bg px-4 py-16 text-fg">
        <OraMark lockup />
        <h1 className="mt-8 font-display text-3xl">Owner access only</h1>
        <p className="mt-3 text-sm text-muted">
          This panel is not a public signup. Sign in with an assigned owner account. Customer and
          psychic accounts cannot open it.
        </p>
        <Link to="/admin/login" className="mt-6 inline-flex h-11 items-center text-sm text-primary">
          Owner sign in
        </Link>
        <Link to="/" className="mt-3 block text-sm text-faint">
          Back to advisors
        </Link>
      </main>
    );
  }
  return <IdentityContext.Provider value={identity}>{children}</IdentityContext.Provider>;
}

function isOn(path: string, to: string) {
  return to === "/admin" ? path === "/admin" || path === "/admin/" : path === to || path.startsWith(`${to}/`);
}

function NavList({
  items,
  path,
  onNavigate,
}: {
  items: NavItem[];
  path: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((n) => {
        const Icon = n.icon;
        const on = isOn(path, n.to);
        return (
          <li key={n.to}>
            <Link
              to={n.to}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm transition-colors duration-150 ease-[var(--ease-out)]",
                on ? "bg-blush font-medium text-primary" : "text-muted hover:bg-elevated hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={on ? 2.2 : 1.8} />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const identity = useContext(IdentityContext);
  const [open, setOpen] = useState(false);
  const current = ALL_NAV.find((n) => isOn(path, n.to));

  useEffect(() => {
    setOpen(false);
  }, [path]);

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
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="ora-canvas min-h-dvh bg-bg text-fg">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-fg/20 md:hidden"
          aria-label="Close menu"
          onClick={close}
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface/95 shadow-[var(--shadow-border)] backdrop-blur-md transition-transform duration-200 ease-[var(--ease-out)]",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
          <div className="flex min-w-0 flex-col">
            <OraMark lockup />
            <span className="mt-1 w-fit rounded-full bg-blush px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
              Owner
            </span>
          </div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:text-fg md:hidden"
            onClick={close}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-xs tracking-wide text-faint uppercase">Dashboard</p>
          <NavList items={PRIMARY} path={path} onNavigate={close} />
          <p className="mt-6 mb-2 px-3 text-xs tracking-wide text-faint uppercase">More</p>
          <NavList items={MORE} path={path} onNavigate={close} />
        </nav>
        <div className="shrink-0 border-t border-border/60 p-3">
          <p className="truncate px-3 text-sm text-fg">{identity?.name || "Owner"}</p>
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-bg/92 px-4 backdrop-blur-md md:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-md text-fg md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="admin-sidebar"
            >
              <Menu className="size-5" />
            </button>
            <p className="truncate font-display text-lg">{current?.label ?? "Owner"}</p>
          </div>
          <UserButton />
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({
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

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  to,
  pulse,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  to?: AdminPath;
  pulse?: boolean;
  tone?: "primary" | "blush" | "gold" | "ok" | "lotus" | "warn";
}) {
  const well =
    tone === "ok"
      ? "bg-ok/12 text-ok"
      : tone === "gold"
        ? "bg-gold/15 text-gold"
        : tone === "warn"
          ? "bg-warn/15 text-warn"
          : tone === "lotus"
            ? "bg-lotus/30 text-primary"
            : tone === "blush"
              ? "bg-blush text-primary"
              : "bg-primary/12 text-primary";
  const card =
    tone === "ok"
      ? "bg-[#f3faf5]"
      : tone === "gold"
        ? "bg-[#fbf6ee]"
        : tone === "warn"
          ? "bg-[#fbf6ee]"
          : tone === "lotus"
            ? "bg-[#f7f1f6]"
            : tone === "blush"
              ? "bg-[#fbf4f7]"
              : "bg-[#f6f2f7]";
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
        {Icon ? (
          <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-xl", well)}>
            <Icon className="size-4" strokeWidth={1.8} />
            {pulse ? <span className="absolute top-0.5 right-0.5 size-2 animate-pulse rounded-full bg-ok" /> : null}
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-2xl tracking-tight text-fg tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );

  const cls = cn("rounded-2xl p-4 shadow-[var(--shadow-border)]", card);

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          cls,
          "block transition-shadow duration-150 ease-[var(--ease-out)] hover:shadow-[var(--shadow-border-hover)]",
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted shadow-[var(--shadow-border)]">
      {children}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

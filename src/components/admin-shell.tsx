import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Award,
  Banknote,
  ChartColumn,
  ClipboardList,
  CircleDollarSign,
  ExternalLink,
  Gift,
  Info,
  LayoutDashboard,
  LifeBuoy,
  ListOrdered,
  Menu,
  MessageSquare,
  Network,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
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
import { AdminSafetyNotices } from "@/components/admin-safety-notices";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminSession } from "@/lib/ora-admin";
import { adminAiReportCount } from "@/lib/ora-compliance-api";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

type AdminPath =
  | "/admin"
  | "/admin/advisors"
  | "/admin/applications"
  | "/admin/customers"
  | "/admin/sessions"
  | "/admin/transactions"
  | "/admin/trusted"
  | "/admin/finance"
  | "/admin/payouts"
  | "/admin/earnings"
  | "/admin/ranking"
  | "/admin/reports"
  | "/admin/support"
  | "/admin/safety"
  | "/admin/ip-security"
  | "/admin/ai-reports"
  | "/admin/settings"
  | "/admin/reviews"
  | "/admin/categories"
  | "/admin/promos"
  | "/admin/audit";

type NavItem = { to: AdminPath; label: string; icon: LucideIcon };

const FLOOR: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/advisors", label: "Advisors", icon: Users },
  { to: "/admin/applications", label: "Advisor Applications", icon: ClipboardList },
  { to: "/admin/customers", label: "Customers", icon: UserRound },
  { to: "/admin/sessions", label: "Sessions", icon: MessageSquare },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  { to: "/admin/finance", label: "Finance", icon: Wallet },
  { to: "/admin/payouts", label: "Payouts", icon: Banknote },
  { to: "/admin/reports", label: "Reports", icon: ChartColumn },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const CARE: NavItem[] = [
  { to: "/admin/trusted", label: "Trusted Psychics", icon: Award },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/earnings", label: "Advisor Earnings", icon: CircleDollarSign },
  { to: "/admin/ranking", label: "Advisor Ranking", icon: ListOrdered },
  { to: "/admin/support", label: "Customer Support", icon: LifeBuoy },
  { to: "/admin/safety", label: "Safety reports", icon: ShieldAlert },
  { to: "/admin/ip-security", label: "IP Security", icon: Network },
  { to: "/admin/ai-reports", label: "AI Report Inbox", icon: Shield },
];

const HOUSE: NavItem[] = [
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/promos", label: "Promos", icon: Gift },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

const ALL_NAV = [...FLOOR, ...CARE, ...HOUSE];

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
      <div className="ora-admin ora-canvas min-h-dvh bg-[#fbf9fb] px-4 py-16 text-fg">
        <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-2xl border border-dash-note-line bg-dash-violet" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn to="/admin/login" />;
  if (state === "deny") {
    return (
      <main className="ora-admin ora-canvas mx-auto min-h-dvh max-w-sm bg-[#fbf9fb] px-4 py-16 text-fg">
        <OraMark lockup />
        <h1 className="mt-8 font-display text-4xl font-bold tracking-tight text-fg">Owner access only</h1>
        <span className="mt-2 block h-0.5 w-12 rounded-full bg-gold" />
        <p className="mt-3 text-sm leading-snug text-muted">
          This panel is not a public signup. Sign in with an assigned owner account. Customer and
          psychic accounts cannot open it.
        </p>
        <Link
          to="/admin/login"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-dash-violet px-4 text-sm font-medium text-primary"
        >
          Owner sign in
        </Link>
        <Link to="/home" className="mt-3 block text-sm text-faint">
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
  aiNew,
  aiHigh,
}: {
  items: NavItem[];
  path: string;
  onNavigate?: () => void;
  aiNew: number;
  aiHigh: number;
}) {
  return (
    <ul className="space-y-1">
      {items.map((n) => {
        const Icon = n.icon;
        const on = isOn(path, n.to);
        const badge = n.to === "/admin/ai-reports" && aiNew > 0 ? aiNew : 0;
        const alert = n.to === "/admin/ai-reports" && aiHigh > 0 && !on;
        return (
          <li key={n.to}>
            <Link
              to={n.to}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-2xl px-2.5 text-sm transition-colors duration-150 ease-[var(--ease-out)]",
                on
                  ? "bg-dash-violet font-semibold text-primary"
                  : alert
                    ? "font-medium text-gold hover:bg-dash-quiet"
                    : "text-muted hover:bg-dash-note hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full",
                  on ? "bg-surface text-primary shadow-[var(--shadow-border)]" : "text-current",
                )}
              >
                <Icon className="size-4" strokeWidth={on ? 2.2 : 1.8} />
              </span>
              <span className="min-w-0 flex-1 truncate">{n.label}</span>
              {badge ? (
                <span className="rounded-full bg-dash-rose px-2 py-0.5 text-[11px] font-semibold text-dash-rose-ink tabular-nums">
                  {badge}
                </span>
              ) : null}
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
  const [aiNew, setAiNew] = useState(0);
  const [aiHigh, setAiHigh] = useState(0);
  const current = ALL_NAV.find((n) => isOn(path, n.to));

  useEffect(() => {
    void adminAiReportCount()
      .then((row) => {
        setAiNew(row.count);
        setAiHigh(row.high);
      })
      .catch(() => {
        setAiNew(0);
        setAiHigh(0);
      });
  }, [path]);

  useVisibleInterval(
    () => {
      void adminAiReportCount()
        .then((row) => {
          setAiNew(row.count);
          setAiHigh(row.high);
        })
        .catch(() => {
          setAiNew(0);
          setAiHigh(0);
        });
    },
    15000,
    true,
    true,
  );

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
    <div className="ora-admin ora-canvas min-h-dvh bg-[#fbf9fb] text-fg">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#2a2430]/25 backdrop-blur-[2px] lg:hidden"
          aria-label="Close menu"
          onClick={close}
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r border-dash-note-line bg-surface/95 shadow-[0_18px_50px_-28px_rgba(42,36,48,0.45)] backdrop-blur-md transition-transform duration-200 ease-[var(--ease-out)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-3">
          <div className="flex min-w-0 flex-col">
            <OraMark lockup />
            <span className="mt-2 block h-0.5 w-10 rounded-full bg-gold" aria-hidden />
            <span className="mt-2 w-fit rounded-full bg-dash-violet px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
              Owner
            </span>
          </div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-dash-note hover:text-fg lg:hidden"
            onClick={close}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">House</p>
          <NavList items={FLOOR} path={path} onNavigate={close} aiNew={aiNew} aiHigh={aiHigh} />
          <p className="mt-5 mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">Care</p>
          <NavList items={CARE} path={path} onNavigate={close} aiNew={aiNew} aiHigh={aiHigh} />
          <p className="mt-5 mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">Catalog</p>
          <NavList items={HOUSE} path={path} onNavigate={close} aiNew={aiNew} aiHigh={aiHigh} />
        </nav>
        <div className="shrink-0 border-t border-dash-note-line p-3">
          <p className="truncate px-2 text-sm font-medium text-fg">{identity?.name || "Owner"}</p>
          {identity?.email ? <p className="truncate px-2 text-xs text-faint">{identity.email}</p> : null}
          <Link
            to="/home"
            className="mt-2 flex h-11 items-center gap-2 rounded-2xl px-2.5 text-sm text-muted transition-colors duration-150 ease-[var(--ease-out)] hover:bg-dash-note hover:text-fg"
          >
            <ExternalLink className="size-4 shrink-0" />
            View marketplace
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-dash-note-line/80 bg-[#fbf9fb]/90 px-3 backdrop-blur-md sm:px-5 lg:h-16">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full text-fg hover:bg-dash-violet lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="admin-sidebar"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="truncate font-display text-2xl leading-none font-bold tracking-tight text-fg">
                {current?.label ?? "Owner"}
              </p>
              <span className="mt-1 block h-0.5 w-8 rounded-full bg-gold" aria-hidden />
            </div>
            <p className="hidden text-sm text-muted lg:block">
              Ora owner desk
              {current ? <span className="text-fg"> · {current.label}</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AdminSafetyNotices />
            <UserButton />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 lg:px-8 lg:py-7">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  kicker,
  icon: Icon,
}: {
  title: string;
  description?: string;
  kicker?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-dash-violet text-primary">
            <Icon className="size-5" strokeWidth={2.1} />
          </span>
        ) : null}
        <div className="min-w-0">
          {kicker ? <p className="mb-1 text-xs font-medium tracking-wide text-primary">{kicker}</p> : null}
          <h1 className="font-display text-[2rem] leading-none font-bold tracking-tight text-fg sm:text-4xl">{title}</h1>
          <span className="mt-2 block h-0.5 w-12 rounded-full bg-gold" aria-hidden />
          {description ? <p className="mt-2.5 max-w-2xl text-sm leading-snug text-muted">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

type StatTone =
  | "primary"
  | "blush"
  | "gold"
  | "ok"
  | "lotus"
  | "warn"
  | "violet"
  | "sand"
  | "mint"
  | "rose"
  | "sky"
  | "teal";

const STAT_PAINT: Record<StatTone, { card: string; ink: string; well: string }> = {
  primary: { card: "border-dash-violet-line bg-dash-violet", ink: "text-primary", well: "bg-surface text-primary" },
  violet: { card: "border-dash-violet-line bg-dash-violet", ink: "text-primary", well: "bg-surface text-primary" },
  lotus: { card: "border-dash-violet-line bg-dash-violet", ink: "text-primary", well: "bg-surface text-primary" },
  blush: { card: "border-dash-rose-line bg-dash-rose", ink: "text-dash-rose-ink", well: "bg-surface text-dash-rose-ink" },
  rose: { card: "border-dash-rose-line bg-dash-rose", ink: "text-dash-rose-ink", well: "bg-surface text-dash-rose-ink" },
  gold: { card: "border-dash-sand-line bg-dash-sand", ink: "text-gold", well: "bg-surface text-gold" },
  sand: { card: "border-dash-sand-line bg-dash-sand", ink: "text-gold", well: "bg-surface text-gold" },
  warn: { card: "border-dash-quiet-line bg-dash-quiet", ink: "text-gold", well: "bg-surface text-gold" },
  ok: { card: "border-dash-mint-line bg-dash-mint", ink: "text-ok", well: "bg-surface text-ok" },
  mint: { card: "border-dash-mint-line bg-dash-mint", ink: "text-ok", well: "bg-surface text-ok" },
  sky: { card: "border-dash-sky-line bg-dash-sky", ink: "text-dash-sky-ink", well: "bg-surface text-dash-sky-ink" },
  teal: { card: "border-dash-teal-line bg-dash-teal", ink: "text-dash-teal-ink", well: "bg-surface text-dash-teal-ink" },
};

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  to,
  pulse,
  tone = "violet",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  to?: AdminPath;
  pulse?: boolean;
  tone?: StatTone;
}) {
  const paint = STAT_PAINT[tone] ?? STAT_PAINT.violet;
  const inner = (
    <>
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-full shadow-[var(--shadow-border)]", paint.well)}>
            <Icon className="size-4" strokeWidth={2} />
            {pulse ? <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-ok ring-2 ring-white" /> : null}
          </span>
        ) : null}
        <p className={cn("min-w-0 pt-1 text-[11px] leading-tight font-semibold tracking-[0.08em] uppercase", paint.ink)}>
          {label}
        </p>
      </div>
      <p className="mt-3 font-sans text-[1.7rem] leading-none font-bold tracking-tight text-fg tabular-nums sm:text-[1.85rem]">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-muted">{hint}</p> : null}
    </>
  );

  const cls = cn("min-w-0 rounded-2xl border px-3.5 py-3.5", paint.card);

  if (to) {
    return (
      <Link to={to} className={cn(cls, "block transition-transform duration-150 ease-[var(--ease-out)] hover:-translate-y-px")}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <section className="mb-3 flex items-start gap-3 rounded-2xl border border-dash-note-line bg-dash-note px-3.5 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-primary shadow-[var(--shadow-border)]">
        <Info className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 text-sm leading-snug text-muted">{children}</div>
    </section>
  );
}

export function QuietNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-dash-quiet-line bg-dash-quiet px-3.5 py-3 text-sm font-medium text-fg">
      {children}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dash-quiet-line bg-dash-quiet px-4 py-4 text-center text-sm text-fg">
      {children}
    </div>
  );
}

export function Panel({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-dash-note-line bg-dash-note p-3.5 sm:p-4">
      <div className="mb-3 flex items-center gap-2.5">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-primary shadow-[var(--shadow-border)]">
            <Icon className="size-4" strokeWidth={2} />
          </span>
        ) : null}
        <h2 className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">{title}</h2>
      </div>
      {children}
    </section>
  );
}

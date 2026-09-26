import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  MessageSquare,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { IncomingRequestAlert } from "@/components/incoming-request-alert";
import { DueReminderAlert } from "@/components/due-reminder-alert";
import { availabilityLabel } from "@/components/advisor-desk";
import { OraMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorDeniedMessage, isAdvisorPublicPath } from "@/lib/ora-advisor-auth";
import { advisorEntryState, advisorPanelSession } from "@/lib/ora-advisor";
import { adminEndViewAs, adminViewAsStatus } from "@/lib/ora-admin-advisor-ops";
import { askMessageNotificationPermission, notifyNewMessage, playMessageSound, unlockMessageSound } from "@/lib/message-sound";
import { primeLiveChatVoice, stopLiveChatVoice, syncLiveChatVoice } from "@/lib/live-chat-voice";
import {
  ackAdvisorReminderDue,
  advisorInboxUnread,
  completeAdvisorReminder,
  listAdvisorReminders,
  snoozeAdvisorReminder,
} from "@/lib/ora-advisor-desk";
import { decideRequest, getInbox, setOnline, type DeskRequest } from "@/lib/ora";
import { pickActiveIncomingRequest, pickDueReminder, type AdvisorReminderRow, type SnoozePresetId } from "@/lib/ora-advisor-desk-stats";
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
      <div className="ora-canvas min-h-dvh bg-bg p-8 text-fg">
        <div className="h-40 animate-pulse rounded-xl bg-elevated" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn to="/advisor/login" />;
  if (state === "pending") {
    return (
      <main className="ora-canvas mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
        <OraMark lockup />
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
      <main className="ora-canvas mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
        <OraMark lockup />
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
      <main className="ora-canvas mx-auto min-h-dvh max-w-md bg-bg px-4 py-16 text-fg">
        <OraMark lockup />
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
  if (path.startsWith("/advisor/customers/") && path !== "/advisor/customers/") return "Client Profile";
  if (path.startsWith("/advisor/profile/edit")) return "Edit Profile";
  if (path.startsWith("/advisor/settings/security")) return "Account";
  if (path.startsWith("/advisor/settings/blocked")) return "Blocked Users";
  if (path.startsWith("/advisor/settings/reviews")) return "Rate & Review";
  if (path.startsWith("/advisor/settings/faq")) return "FAQ";
  if (path.startsWith("/advisor/settings/replies")) return "Quick Reply";
  if (path.startsWith("/advisor/settings")) return "Settings";
  if (path.startsWith("/advisor/earnings")) return "Revenue";
  if (path.startsWith("/advisor/todo")) return "Follow-ups";
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
  const navigate = useNavigate();
  const identity = useContext(IdentityContext);
  const [online, setIsOnline] = useState(Boolean(identity?.online));
  const [busy, setBusy] = useState(Boolean(identity?.busy));
  const [live, setLive] = useState(false);
  const [requests, setRequests] = useState<DeskRequest[]>([]);
  const [workingId, setWorkingId] = useState("");
  const [messageUnread, setMessageUnread] = useState(0);
  const messageUnreadRef = useRef<number | null>(null);
  const [reminders, setReminders] = useState<AdvisorReminderRow[]>([]);
  const [dismissedDue, setDismissedDue] = useState<string[]>([]);
  const [reminderBusy, setReminderBusy] = useState("");
  const [viewAsName, setViewAsName] = useState("");
  const session = path.startsWith("/advisor/session");

  useEffect(() => {
    void adminViewAsStatus()
      .then((state) => setViewAsName(state.active ? state.name : ""))
      .catch(() => setViewAsName(""));
  }, []);

  async function exitViewAs() {
    try {
      await adminEndViewAs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not exit");
      return;
    }
    window.location.href = "/admin/advisors";
  }

  useEffect(() => {
    setIsOnline(Boolean(identity?.online));
    setBusy(Boolean(identity?.busy));
  }, [identity]);

  useEffect(() => {
    const unlock = () => {
      unlockMessageSound();
      primeLiveChatVoice();
      askMessageNotificationPermission();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useVisibleInterval(() => {
    void getInbox()
      .then((d) => {
        setIsOnline(d.online);
        setBusy(d.busy);
        setLive(Boolean(d.live));
        setRequests(d.requests || []);
      })
      .catch(() => {});
  }, 2000, true, true, false);

  useVisibleInterval(() => {
    void advisorInboxUnread()
      .then((data) => {
        const next = Number(data.unread) || 0;
        if (messageUnreadRef.current != null && next > messageUnreadRef.current && !path.startsWith("/advisor/inbox")) {
          playMessageSound();
          notifyNewMessage("New message", "A client sent a message");
        }
        messageUnreadRef.current = next;
        setMessageUnread(next);
      })
      .catch(() => {});
  }, 5000);

  useVisibleInterval(() => {
    void listAdvisorReminders()
      .then((d) => setReminders((d.reminders || []) as AdvisorReminderRow[]))
      .catch(() => {});
  }, 12000);

  async function decide(id: string, accept: boolean) {
    if (workingId) return;
    stopLiveChatVoice();
    setWorkingId(id);
    try {
      const res = await decideRequest({ data: { id, accept } });
      setRequests((cur) => cur.filter((x) => x.id !== id));
      if (accept && res.readingId) {
        await navigate({ to: "/advisor/session/$id", params: { id: res.readingId } });
        return;
      }
      toast.success("Declined.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not decide";
      if (/gone|blocked|no time/i.test(msg)) {
        setRequests((cur) => cur.filter((x) => x.id !== id));
      } else {
        syncLiveChatVoice(id);
      }
      toast.error(msg);
    } finally {
      setWorkingId("");
    }
  }

  async function toggle(next: boolean) {
    if (live) return;
    try {
      await setOnline({ data: { online: next } });
      setIsOnline(next);
      if (!next) setBusy(false);
      toast.success(next ? "You are live on the floor." : "You are offline.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  const incoming = pickActiveIncomingRequest(requests);
  const dueReminder = !session && !incoming ? pickDueReminder(reminders, dismissedDue) : null;

  useEffect(() => {
    if (!dueReminder?.id) return;
    void ackAdvisorReminderDue({ data: { id: dueReminder.id } }).catch(() => {});
  }, [dueReminder?.id]);

  function dismissDue(id: string) {
    setDismissedDue((cur) => (cur.includes(id) ? cur : [...cur, id]));
  }

  async function snoozeDue(id: string, preset: SnoozePresetId, date?: string, time?: string) {
    if (reminderBusy) return;
    setReminderBusy(id);
    try {
      await snoozeAdvisorReminder({ data: { id, preset, date: date || "", time: time || "" } });
      dismissDue(id);
      setReminders((cur) => cur.filter((row) => row.id !== id || preset === "custom"));
      toast.success("Reminder snoozed. The client was not messaged.");
      const next = await listAdvisorReminders();
      setReminders((next.reminders || []) as AdvisorReminderRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not snooze");
    } finally {
      setReminderBusy("");
    }
  }

  async function completeDue(id: string) {
    if (reminderBusy) return;
    setReminderBusy(id);
    try {
      await completeAdvisorReminder({ data: { id } });
      dismissDue(id);
      setReminders((cur) => cur.filter((row) => row.id !== id));
      toast.success("Reminder marked done.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete reminder");
    } finally {
      setReminderBusy("");
    }
  }
  const current = tabForPath(path);
  const status = availabilityLabel({ online, busy, live });
  const statusClass = live || busy ? "bg-warn/15 text-warn" : online ? "bg-ok/12 text-ok" : "bg-elevated text-muted";
  const statusDot = live || busy ? "bg-warn" : online ? "bg-ok" : "bg-faint";

  return (
    <DeskStatusContext.Provider value={{ online, busy, setOnline: setIsOnline, setBusy }}>
      <div className={cn("ora-canvas bg-bg text-fg", session ? "h-dvh overflow-hidden" : "min-h-dvh")}>
        {viewAsName ? (
          <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-2 text-sm text-primary-fg">
            <span>Viewing as {viewAsName} — Exit</span>
            <button type="button" className="rounded-full bg-primary-fg px-3 py-1 text-xs font-medium text-primary" onClick={() => void exitViewAs()}>
              Exit
            </button>
          </div>
        ) : null}
        {session ? null : (
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-surface/92 shadow-[var(--shadow-border)] backdrop-blur-md lg:flex">
            <div className="px-4 pt-5 pb-3">
              <OraMark lockup />
              <p className="mt-2 text-[10px] font-medium tracking-[0.18em] text-primary uppercase">Advisor desk</p>
            </div>
            <nav aria-label="Advisor" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
              {TABS.map((item) => {
                const on = current?.to === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload={false}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm",
                      on ? "bg-blush font-medium text-primary" : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={on ? 2.2 : 1.7} />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.to === "/advisor/inbox" && messageUnread > 0 ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-fg">
                        {messageUnread > 9 ? "9+" : messageUnread}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border/70 p-3">
              <button
                type="button"
                onClick={() => void toggle(!online)}
                disabled={live}
                className={cn(
                  "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium",
                  statusClass,
                )}
              >
                <span className={cn("size-2 rounded-full", statusDot)} />
                {status}
              </button>
            </div>
          </aside>
        )}

        <div className={session ? "" : "lg:pl-60"}>
          {session ? null : (
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-bg/92 px-4 backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="lg:hidden">
                  <OraMark />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg leading-tight text-fg">{deskChromeTitle(path, current)}</p>
                  <p className="truncate text-xs text-muted">{identity?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggle(!online)}
                  disabled={live}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium lg:hidden",
                    statusClass,
                  )}
                >
                  <span className={cn("size-2 rounded-full", statusDot)} />
                  {status}
                </button>
                <UserButton />
              </div>
            </header>
          )}
          <div className={cn(session ? "h-dvh overflow-hidden" : "mx-auto w-full max-w-3xl px-4 py-4 lg:max-w-4xl pb-24 lg:pb-8")}>
            {children}
          </div>
          {session ? null : (
            <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg from-55% to-transparent px-4 pt-1 pb-[max(0.7rem,env(safe-area-inset-bottom))] lg:hidden">
              <nav aria-label="Advisor" className="mx-auto grid h-[3.75rem] max-w-3xl grid-cols-5 rounded-full bg-surface shadow-[var(--shadow-border)]">
                {TABS.map((item) => {
                  const on = current?.to === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      preload={false}
                      className={cn(
                        "relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                        on ? "font-medium text-primary" : "text-faint",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={on ? 2.25 : 1.7} />
                      {item.label}
                      {item.to === "/advisor/inbox" && messageUnread > 0 ? (
                        <span className="absolute top-1.5 right-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] text-primary-fg">
                          {messageUnread > 9 ? "9+" : messageUnread}
                        </span>
                      ) : null}
                      {on ? <span className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-primary" /> : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
        <IncomingRequestAlert
          requests={requests}
          workingId={workingId}
          onAccept={(id) => void decide(id, true)}
          onDecline={(id) => void decide(id, false)}
        />
        <DueReminderAlert
          reminder={dueReminder}
          busy={Boolean(reminderBusy)}
          onView={(id) => {
            const row = reminders.find((r) => r.id === id);
            dismissDue(id);
            if (row?.customerId) void navigate({ to: "/advisor/inbox", search: { client: row.customerId } });
          }}
          onMessage={(id) => {
            const row = reminders.find((r) => r.id === id);
            dismissDue(id);
            if (row?.customerId) void navigate({ to: "/advisor/inbox", search: { client: row.customerId } });
          }}
          onSnooze={(id, preset, date, time) => void snoozeDue(id, preset, date, time)}
          onDone={(id) => void completeDue(id)}
        />
      </div>
    </DeskStatusContext.Provider>
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
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
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

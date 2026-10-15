import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearFavorites, rememberFavoriteIds } from "@/lib/favorite-store";
import {
  alertInitials,
  alertPreviewText,
  alertSenderName,
  alertTimeLabel,
  previewNotifications,
} from "@/lib/ora-alert-view";
import {
  listAlertHistory,
  listFavoriteIds,
  markAlertRead,
  markAllAlertsRead,
  pollFavoriteAlerts,
  type CustomerAlert,
} from "@/lib/ora-favorites";
import { notifyNewMessage } from "@/lib/message-sound";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

export const ALERTS_REFRESH = "ora-alerts-refresh";

function alertAdvisorSlug(alert: CustomerAlert) {
  if (alert.advisorSlug) return alert.advisorSlug;
  if (alert.href.startsWith("/advisors/")) return alert.href.slice("/advisors/".length).split("/")[0];
  return "";
}

export function openCustomerAlert(navigate: ReturnType<typeof useNavigate>, alert: CustomerAlert) {
  const href = alert.href || "";
  if (href.startsWith("/reading/")) {
    const id = href.slice("/reading/".length).split("/")[0];
    if (id) {
      void navigate({ to: "/reading/$id", params: { id } });
      return;
    }
  }
  if (href.startsWith("/messages/")) {
    const id = href.slice("/messages/".length).split("/")[0];
    if (id) {
      void navigate({ to: "/messages/$id", params: { id } });
      return;
    }
  }
  if (href === "/messages") {
    void navigate({ to: "/messages" });
    return;
  }
  if (href.startsWith("/rewards")) {
    void navigate({ to: "/rewards" });
    return;
  }
  if (href.startsWith("/referrals")) {
    void navigate({ to: "/referrals", search: { code: "" } });
    return;
  }
  if (href.startsWith("/scheduled")) {
    void navigate({ to: "/scheduled", search: { advisor: "" } });
    return;
  }
  if (href.startsWith("/support/")) {
    const id = href.slice("/support/".length).split(/[/?#]/)[0];
    if (id) {
      void navigate({ to: "/support/$id", params: { id } });
      return;
    }
  }
  if (href.startsWith("/support")) {
    void navigate({ to: "/support" });
    return;
  }
  if (href.startsWith("/security")) {
    void navigate({ to: "/security" });
    return;
  }
  if (href.startsWith("/reading-history")) {
    void navigate({ to: "/reading-history" });
    return;
  }
  if (href.startsWith("/notifications")) {
    void navigate({ to: "/notifications" });
    return;
  }
  if (href.startsWith("/spirit/")) {
    const tool = href.slice("/spirit/".length).split(/[/?#]/)[0] || "";
    const advisor = new URLSearchParams(href.split("?")[1] || "").get("advisor") || "";
    if (tool) {
      void navigate({ to: "/spirit/$tool", params: { tool }, search: { advisor } });
      return;
    }
  }
  if (href === "/spirit" || href.startsWith("/spirit?")) {
    void navigate({ to: "/spirit" });
    return;
  }
  const slug = alertAdvisorSlug(alert);
  if (slug) void navigate({ to: "/advisors/$id", params: { id: slug } });
}

function requestAlertRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALERTS_REFRESH));
}

export function CustomerAlertRow({
  alert,
  onOpen,
}: {
  alert: CustomerAlert;
  onOpen: (alert: CustomerAlert) => void;
}) {
  const name = alertSenderName(alert);
  const preview = alertPreviewText(alert);
  const time = alertTimeLabel(alert.createdAt);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(alert)}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left",
          alert.read ? "bg-surface hover:bg-[#fbf8f4]" : "bg-[#fbf7f1] hover:bg-[#f6f0e6]",
        )}
      >
        <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f3e7c8] text-[11px] font-semibold text-[#8a6230]">
          {alert.senderPhoto ? (
            <img src={alert.senderPhoto} alt="" className="size-full object-cover" />
          ) : (
            alertInitials(name)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-[13px] text-fg", alert.read ? "font-medium" : "font-semibold")}>{name}</span>
            <span className="shrink-0 text-[10px] text-faint">{time}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{preview}</span>
        </span>
        {alert.read ? null : <span className="size-2 shrink-0 rounded-full bg-gold" aria-label="Unread" />}
      </button>
    </li>
  );
}

export function CustomerAlerts() {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<CustomerAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [place, setPlace] = useState({ top: 56, right: 12, width: 300 });
  const seen = useRef(new Set<string>());
  const primed = useRef(false);
  const shown = previewNotifications(alerts);
  const more = total > shown.length;

  function placePanel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = Math.max(8, window.innerWidth - rect.right);
    const width = Math.min(304, Math.max(0, window.innerWidth - right - 8));
    setPlace({ top: rect.bottom + 8, right, width });
  }

  function markLocalRead(id: string) {
    setAlerts((rows) => {
      const wasUnread = rows.some((row) => row.id === id && !row.read);
      if (wasUnread) setUnread((count) => Math.max(0, count - 1));
      return rows.map((row) => (row.id === id ? { ...row, read: true } : row));
    });
    void markAlertRead({ data: { id } });
  }

  function openOne(alert: CustomerAlert) {
    setOpen(false);
    if (!alert.read) markLocalRead(alert.id);
    openCustomerAlert(navigate, alert);
  }

  async function markAll() {
    setAlerts((rows) => rows.map((row) => ({ ...row, read: true })));
    setUnread(0);
    try {
      await markAllAlertsRead();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark notifications read");
    }
  }

  useEffect(() => {
    if (!user) {
      clearFavorites();
      setAlerts([]);
      setUnread(0);
      setTotal(0);
      seen.current.clear();
      primed.current = false;
      return;
    }
    void listFavoriteIds()
      .then((r) => rememberFavoriteIds(r.ids))
      .catch(() => {});
  }, [user]);

  useVisibleInterval(
    () => {
      if (!user) return;
      void pollFavoriteAlerts()
        .then((res) => {
          setAlerts(res.alerts);
          setUnread(res.unread);
          setTotal(Number(res.total) || res.alerts.length);
          const announce = new Map<string, CustomerAlert>();
          for (const alert of res.created) announce.set(alert.id, alert);
          if (primed.current) {
            for (const alert of res.alerts) {
              if (!alert.read && !seen.current.has(alert.id)) announce.set(alert.id, alert);
            }
          }
          for (const alert of res.alerts) seen.current.add(alert.id);
          for (const alert of announce.values()) seen.current.add(alert.id);
          primed.current = true;
          for (const alert of announce.values()) {
            if (seen.current.has(`told:${alert.id}`)) continue;
            seen.current.add(`told:${alert.id}`);
            const title = alert.kind === "message" ? "New Message" : alert.title || "Ora";
            toast(title, {
              description: alert.body,
              duration: 10_000,
              action: {
                label: "Open",
                onClick: () => {
                  markLocalRead(alert.id);
                  openCustomerAlert(navigate, alert);
                },
              },
            });
            notifyNewMessage(title, alert.body, `ora-${alert.kind || "alert"}-${alert.id}`, alert.href);
          }
        })
        .catch(() => {});
    },
    10_000,
    Boolean(user),
    true,
  );

  useEffect(() => {
    if (!open) return;
    placePanel();
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReflow() {
      placePanel();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  useEffect(() => {
    function onRefresh() {
      if (!user) return;
      void pollFavoriteAlerts()
        .then((res) => {
          setAlerts(res.alerts);
          setUnread(res.unread);
          setTotal(Number(res.total) || res.alerts.length);
        })
        .catch(() => {});
    }
    window.addEventListener(ALERTS_REFRESH, onRefresh);
    return () => window.removeEventListener(ALERTS_REFRESH, onRefresh);
  }, [user]);

  if (!user) return null;

  return (
    <div className="relative" ref={root}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (next) placePanel();
            return next;
          });
        }}
        className={cn(
          "relative grid size-10 place-items-center rounded-full text-fg shadow-[var(--shadow-border)]",
          unread > 0 ? "bg-[#f6f0e6]" : "bg-surface",
        )}
      >
        <Bell className="size-4" strokeWidth={1.7} />
        {unread ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-fg">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{ top: place.top, right: place.right, width: place.width }}
          className="fixed z-50 overflow-hidden rounded-2xl border border-[#ead9b0] bg-[#fffdf8] shadow-[0_16px_40px_rgba(74,42,78,0.16)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#f0e4c8] px-3 py-2">
            <h2 className="font-display text-[15px] font-semibold text-fg">Notifications</h2>
            {unread > 0 ? (
              <button type="button" className="shrink-0 text-xs font-medium text-primary" onClick={() => void markAll()}>
                Mark all as read
              </button>
            ) : null}
          </div>
          {!shown.length ? (
            <p className="px-3 py-5 text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-[#f3ead8] overflow-y-auto">
              {shown.map((alert) => (
                <CustomerAlertRow key={alert.id} alert={alert} onOpen={openOne} />
              ))}
            </ul>
          )}
          {more ? (
            <Link
              to="/notifications"
              preload={false}
              onClick={() => setOpen(false)}
              className="block border-t border-[#f0e4c8] py-2.5 text-center text-sm font-medium text-primary"
            >
              See all
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CustomerAlertHistory({
  alerts,
  onOpen,
}: {
  alerts: CustomerAlert[];
  onOpen: (alert: CustomerAlert) => void;
}) {
  if (!alerts.length) return <p className="mt-6 text-sm text-muted">No notifications yet.</p>;
  return (
    <ul className="mt-4 divide-y divide-[#f3ead8] overflow-hidden rounded-2xl border border-[#ead9b0] bg-[#fffdf8]">
      {alerts.map((alert) => (
        <CustomerAlertRow key={alert.id} alert={alert} onOpen={onOpen} />
      ))}
    </ul>
  );
}

export { listAlertHistory, markAlertRead, markAllAlertsRead, requestAlertRefresh };

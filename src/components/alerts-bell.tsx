import { useNavigate } from "@tanstack/react-router";
import { Bell, CalendarClock, LifeBuoy, MessageSquare, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearFavorites, rememberFavoriteIds } from "@/lib/favorite-store";
import { listFavoriteIds, markAlertRead, pollFavoriteAlerts, type CustomerAlert } from "@/lib/ora-favorites";
import { notifyNewMessage } from "@/lib/message-sound";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

function alertAdvisorSlug(alert: CustomerAlert) {
  if (alert.advisorSlug) return alert.advisorSlug;
  if (alert.href.startsWith("/advisors/")) return alert.href.slice("/advisors/".length).split("/")[0];
  return "";
}

function openAlert(navigate: ReturnType<typeof useNavigate>, alert: CustomerAlert) {
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
  const slug = alertAdvisorSlug(alert);
  if (slug) void navigate({ to: "/advisors/$id", params: { id: slug } });
}

function AlertIcon({ kind }: { kind: string }) {
  const className = "size-4 shrink-0";
  if (kind === "streak") return <Sparkles className={className} strokeWidth={1.7} />;
  if (kind === "referral") return <Users className={className} strokeWidth={1.7} />;
  if (kind === "online") return <Sparkles className={className} strokeWidth={1.7} />;
  if (kind === "support") return <LifeBuoy className={className} strokeWidth={1.7} />;
  if (kind === "booking") return <CalendarClock className={className} strokeWidth={1.7} />;
  if (kind === "message" || kind === "followup") return <MessageSquare className={className} strokeWidth={1.7} />;
  return <Bell className={className} strokeWidth={1.7} />;
}

export function CustomerAlerts() {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<CustomerAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  function markLocalRead(id: string) {
    setAlerts((rows) => {
      const wasUnread = rows.some((row) => row.id === id && !row.read);
      if (wasUnread) setUnread((count) => Math.max(0, count - 1));
      return rows.map((row) => (row.id === id ? { ...row, read: true } : row));
    });
    void markAlertRead({ data: { id } });
  }

  useEffect(() => {
    if (!user) {
      clearFavorites();
      setAlerts([]);
      setUnread(0);
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
                  openAlert(navigate, alert);
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

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid size-10 place-items-center rounded-full text-fg shadow-[var(--shadow-border)]",
          unread > 0 ? "bg-[#f3eaf6]" : "bg-surface",
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
        <div className="absolute top-12 right-0 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          <p className="px-3 pt-3 text-[10px] tracking-[0.16em] text-muted uppercase">Notifications</p>
          {!alerts.length ? (
            <p className="px-3 py-4 text-sm text-muted">No alerts yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (!a.read) markLocalRead(a.id);
                      openAlert(navigate, a);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-fg",
                      a.read ? "bg-surface hover:bg-elevated" : "bg-[#f3eaf6] hover:bg-[#eadcf0]",
                    )}
                  >
                    <span className="mt-0.5 text-primary">
                      <AlertIcon kind={a.kind} />
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block", a.read ? "font-normal" : "font-medium")}>
                        {a.kind === "message" ? "New Message" : a.title || a.body}
                      </span>
                      {a.body && a.body !== a.title ? <span className="mt-0.5 block text-xs text-muted">{a.body}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
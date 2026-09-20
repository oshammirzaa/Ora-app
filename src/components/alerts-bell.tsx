import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearFavorites, rememberFavoriteIds } from "@/lib/favorite-store";
import { listFavoriteIds, markAlertRead, pollFavoriteAlerts, type CustomerAlert } from "@/lib/ora-favorites";
import { useVisibleInterval } from "@/lib/use-visible-interval";

function alertAdvisorSlug(alert: CustomerAlert) {
  if (alert.advisorSlug) return alert.advisorSlug;
  if (alert.href.startsWith("/advisors/")) return alert.href.slice("/advisors/".length).split("/")[0];
  return "";
}

function openAlert(navigate: ReturnType<typeof useNavigate>, alert: CustomerAlert) {
  if (alert.href.startsWith("/reading/")) {
    const id = alert.href.slice("/reading/".length).split("/")[0];
    if (id) {
      void navigate({ to: "/reading/$id", params: { id } });
      return;
    }
  }
  const slug = alertAdvisorSlug(alert);
  if (slug) {
    void navigate({ to: "/advisors/$id", params: { id: slug } });
  }
}

export function CustomerAlerts() {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<CustomerAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!user) {
      clearFavorites();
      setAlerts([]);
      setUnread(0);
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
          for (const alert of res.created) {
            if (seen.current.has(alert.id)) continue;
            seen.current.add(alert.id);
            toast(alert.body, {
              duration: 10_000,
              action: {
                label: "Open",
                onClick: () => {
                  void markAlertRead({ data: { id: alert.id } });
                  openAlert(navigate, alert);
                },
              },
            });
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
        className="relative grid size-10 place-items-center rounded-full bg-surface text-fg shadow-[var(--shadow-border)]"
      >
        <Bell className="size-4" strokeWidth={1.7} />
        {unread ? (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute top-12 right-0 z-50 w-[18rem] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          <p className="px-3 pt-3 text-[10px] tracking-[0.16em] text-muted uppercase">Notifications</p>
          {!alerts.length ? (
            <p className="px-3 py-4 text-sm text-muted">No alerts yet.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/advisors/$id"
                    params={{ id: alertAdvisorSlug(a) || a.href.split("/").pop() || "" }}
                    preload={false}
                    onClick={() => {
                      setOpen(false);
                      void markAlertRead({ data: { id: a.id } });
                    }}
                    className="block px-3 py-2.5 text-sm text-fg hover:bg-elevated"
                  >
                    <span className={a.read ? "font-normal" : "font-medium"}>{a.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

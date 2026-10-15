import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CustomerAlertHistory,
  markAlertRead,
  markAllAlertsRead,
  openCustomerAlert,
  requestAlertRefresh,
} from "@/components/alerts-bell";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listAlertHistory, type CustomerAlert } from "@/lib/ora-favorites";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<CustomerAlert[] | null>(null);
  const [unread, setUnread] = useState(0);

  async function load() {
    const next = await listAlertHistory();
    setAlerts(next.alerts);
    setUnread(next.unread);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => {
      setAlerts([]);
      toast.error(err instanceof Error ? err.message : "Could not load notifications");
    });
  }, [user]);

  if (isPending || (user && !alerts)) {
    return (
      <AppShell tab="you">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-2xl bg-elevated" />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell tab="you">
        <RedirectToSignIn />
      </AppShell>
    );
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-6">
        <Link to="/me" preload={false} className="text-sm text-primary">
          Back to account
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-fg">Notifications</h1>
          {unread > 0 ? (
            <button
              type="button"
              className="shrink-0 text-sm font-medium text-primary"
              onClick={() => {
                setAlerts((rows) => (rows || []).map((row) => ({ ...row, read: true })));
                setUnread(0);
                void markAllAlertsRead()
                  .then(() => requestAlertRefresh())
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not mark notifications read"));
              }}
            >
              Mark all as read
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">Recent notes from Ora and your psychics. Older messages stay in your chats.</p>
        <CustomerAlertHistory
          alerts={alerts || []}
          onOpen={(alert) => {
            if (!alert.read) {
              setAlerts((rows) => (rows || []).map((row) => (row.id === alert.id ? { ...row, read: true } : row)));
              setUnread((count) => Math.max(0, count - 1));
              void markAlertRead({ data: { id: alert.id } }).then(() => requestAlertRefresh());
            }
            openCustomerAlert(navigate, alert);
          }}
        />
        {!alerts?.length ? (
          <Button asChild className="mt-6 w-full rounded-full">
            <Link to="/home">Browse psychics</Link>
          </Button>
        ) : null}
      </main>
    </AppShell>
  );
}

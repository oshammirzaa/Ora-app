import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Initials } from "@/components/advisor-desk";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listAdvisorBlocks, setAdvisorBlock } from "@/lib/ora-advisor-desk";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/settings/blocked")({ component: BlockedPage });

function BlockedPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdvisorBlocks>>["blocked"]>([]);
  const [working, setWorking] = useState("");

  const load = useCallback(() => {
    return listAdvisorBlocks()
      .then((d) => setRows(d.blocked))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load blocked users"));
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  async function unblock(customerId: string) {
    if (working) return;
    setWorking(customerId);
    try {
      await setAdvisorBlock({ data: { customerId, blocked: false } });
      toast.success("Unblocked.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unblock");
    } finally {
      setWorking("");
    }
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  return (
    <main className="space-y-4">
      <Link to="/advisor/settings" preload={false} className="text-sm text-primary">
        Back to Settings
      </Link>
      <p className="text-sm text-muted">Blocked clients cannot start a new live text chat with you. Unblock them here at any time.</p>
      {!rows.length ? (
        <EmptyState title="No blocked users" body="When you block someone from Messages, they will appear here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.customerId} className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <Initials name={row.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.name}</p>
                <p className="text-xs text-faint">Blocked {formatWhen(row.at)}</p>
              </div>
              <Button variant="outline" size="sm" disabled={working === row.customerId} onClick={() => void unblock(row.customerId)}>
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

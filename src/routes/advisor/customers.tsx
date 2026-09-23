import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Bell, Flag, MessageSquare, NotebookPen, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeskSearch, EmptyState, FilterChips, Initials, ReminderDialog, ReportDialog, StatusPill } from "@/components/advisor-desk";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { advisorClientList, setAdvisorClientFavorite } from "@/lib/ora-advisor-desk";
import { matchesClientKind, type ClientKindFilter } from "@/lib/ora-advisor-desk-stats";
import { formatUsdFromCents } from "@/lib/ora-paid-messages";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/advisor/customers")({ component: ClientsLayout });

function ClientsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/advisor/customers" && path !== "/advisor/customers/") return <Outlet />;
  return <ClientsPage />;
}

function ClientsPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<ClientKindFilter>("all");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorClientList>> | null>(null);
  const [remindFor, setRemindFor] = useState<{ id: string; name: string } | null>(null);
  const [reportFor, setReportFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    void advisorClientList({ data: { q: "" } })
      .then(setData)
      .catch(() => setData({ clients: [] }));
  }, []);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.clients.filter((c: any) => {
      if (!matchesClientKind(c, kind)) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle) || c.note.toLowerCase().includes(needle);
    });
  }, [data, q, kind]);

  async function toggleFavorite(id: string, next: boolean) {
    try {
      await setAdvisorClientFavorite({ data: { customerId: id, favorite: next } });
      setData((cur) =>
        cur ? { clients: cur.clients.map((c: any) => (c.id === id ? { ...c, favorite: next } : c)) } : cur,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  }

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main className="space-y-4">
      <DeskSearch value={q} onChange={setQ} placeholder="Search clients or notes" />
      <FilterChips
        value={kind}
        onChange={setKind}
        options={[
          { id: "all", label: "All" },
          { id: "repeat", label: "Returning" },
          { id: "frequent", label: "Frequent" },
          { id: "favorites", label: "Favorites" },
          { id: "favoritedYou", label: "Favorited you" },
          { id: "first", label: "First time" },
        ]}
      />
      {!data.clients.length ? (
        <EmptyState title="No clients yet" body="People who finish a live text reading with you will appear here." />
      ) : !visible.length ? (
        <EmptyState title="No matches" body="Try another name, note, or filter." />
      ) : (
        <ul className="space-y-2">
          {visible.map((c: any) => (
            <li key={c.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start gap-3">
                <Link to="/advisor/customers/$id" params={{ id: c.id }} preload={false} className="shrink-0" aria-label={`Open ${c.name} profile`}>
                  <Initials name={c.name} photo={c.photoUrl} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link to="/advisor/customers/$id" params={{ id: c.id }} preload={false} className="min-w-0">
                      <ClientNameWithBadge name={c.name} tier={c.loyaltyTier} className="min-w-0 font-medium" />
                    </Link>
                    <button
                      type="button"
                      aria-label={c.favorite ? "Remove favorite" : "Favorite client"}
                      onClick={() => void toggleFavorite(c.id, !c.favorite)}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-gold"
                    >
                      <Star className={c.favorite ? "size-4 fill-gold" : "size-4"} />
                    </button>
                    {c.frequent ? <StatusPill tone="ok">Frequent</StatusPill> : c.repeat ? <StatusPill tone="ok">Returning</StatusPill> : <StatusPill tone="muted">First time</StatusPill>}
                    {c.favoritedYou ? <StatusPill tone="ok">Favorited you</StatusPill> : null}
                    {c.live ? <StatusPill tone="warn">Live</StatusPill> : null}
                  </div>
                  <p className="mt-1 text-xs text-faint">
                    Active {c.lastAt ? formatWhen(c.lastAt) : "—"} · {c.readings} readings · {formatDuration(c.seconds)}
                  </p>
                  <p className="mt-3">
                    <span className="block text-xs tracking-wide text-faint uppercase">Your earnings</span>
                    <span className="mt-0.5 block text-sm font-medium tabular-nums text-fg">{formatUsdFromCents(c.yourEarningsCents || 0)}</span>
                  </p>
                  {c.note ? <p className="mt-2 line-clamp-2 text-xs text-muted">{c.note}</p> : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/advisor/inbox" search={{ client: c.id }} preload={false}>
                        <MessageSquare className="size-4" />
                        Message
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/advisor/customers/$id" params={{ id: c.id }} hash="notes" preload={false}>
                        <NotebookPen className="size-4" />
                        Notes
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRemindFor({ id: c.id, name: c.name })}>
                      <Bell className="size-4" />
                      Set follow-up reminder
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setReportFor({ id: c.id, name: c.name })}>
                      <Flag className="size-4" />
                      Report
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReminderDialog
        open={Boolean(remindFor)}
        name={remindFor?.name || ""}
        customerId={remindFor?.id || ""}
        onOpenChange={(open) => !open && setRemindFor(null)}
      />
      <ReportDialog
        open={Boolean(reportFor)}
        name={reportFor?.name || ""}
        customerId={reportFor?.id || ""}
        onOpenChange={(open) => !open && setReportFor(null)}
      />
    </main>
  );
}

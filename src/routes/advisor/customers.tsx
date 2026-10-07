import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DeskSearch, EmptyState, FilterChips, Initials, StatusPill, ADVISOR_CHIP } from "@/components/advisor-desk";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { advisorClientList } from "@/lib/ora-advisor-desk";
import { matchesClientKind, clientStatusBadge, type ClientKindFilter } from "@/lib/ora-advisor-desk-stats";
import { useOraRefresh } from "@/lib/use-ora-refresh";
import { formatUsdFromCents } from "@/lib/ora-paid-messages";

export const Route = createFileRoute("/advisor/customers")({ component: ClientsLayout });

function ClientsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/advisor/customers" && path !== "/advisor/customers/") return <Outlet />;
  return <ClientsPage />;
}

function ClientsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<ClientKindFilter>("all");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorClientList>> | null>(null);
  const [trustedWarn, setTrustedWarn] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    return advisorClientList({ data: { q: "" } })
      .then(setData)
      .catch(() => setData({ clients: [] }));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useOraRefresh(load);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.clients.filter((c: any) => {
      if (!matchesClientKind(c, kind)) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle) || c.note.toLowerCase().includes(needle);
    });
  }, [data, q, kind]);

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main className="space-y-4">
      <DeskSearch value={q} onChange={setQ} placeholder="Search clients or notes" />
      <FilterChips
        value={kind}
        onChange={setKind}
        options={[
          { id: "all", label: "All", ...ADVISOR_CHIP.plum },
          { id: "new", label: "New Clients", ...ADVISOR_CHIP.lilac },
          { id: "trusted", label: "Trusted Clients", ...ADVISOR_CHIP.diamond },
          { id: "repeat", label: "Returning", ...ADVISOR_CHIP.mint },
          { id: "frequent", label: "Frequent", ...ADVISOR_CHIP.gold },
          { id: "favorites", label: "Favorites", ...ADVISOR_CHIP.rose },
          { id: "favoritedYou", label: "Favorited you", ...ADVISOR_CHIP.blue },
          { id: "first", label: "First time", ...ADVISOR_CHIP.stone },
        ]}
      />
      {!data.clients.length ? (
        <EmptyState title="No clients yet" body="People who finish a live text reading with you will appear here." />
      ) : !visible.length ? (
        <EmptyState title="No matches" body="Try another name, note, or filter." />
      ) : (
        <ul className="space-y-2">
          {visible.map((c: any) => (
            <li key={c.id} className="rounded-2xl bg-surface px-3.5 py-3 shadow-[var(--shadow-border)]">
              <Link
                to="/advisor/customers/$id"
                params={{ id: c.id }}
                preload={false}
                className="flex items-center gap-3"
                aria-label={`Open ${c.name} profile`}
              >
                <Initials name={c.name} photo={c.photoUrl} />
                <div className="min-w-0 flex-1">
                  <ClientNameWithBadge name={c.name} tier={c.loyaltyTier} className="min-w-0 font-medium" />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.trusted ? <StatusPill tone="diamond">Trusted</StatusPill> : null}
                    {c.favorite ? <StatusPill tone="rose">Favorite</StatusPill> : null}
                    {(() => {
                      const badge = clientStatusBadge(c);
                      return <StatusPill tone={badge.tone}>{badge.label}</StatusPill>;
                    })()}
                  </div>
                </div>
              </Link>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Link to="/advisor/customers/$id" params={{ id: c.id }} preload={false} className="min-w-0">
                  <span className="block text-[10px] tracking-[0.14em] text-faint uppercase">Your earnings</span>
                  <span className="mt-0.5 block text-base font-medium tabular-nums text-fg">{formatUsdFromCents(c.yourEarningsCents || 0)}</span>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    if (c.needsTrustedWarning) {
                      setTrustedWarn({ id: c.id, name: c.name });
                      return;
                    }
                    void navigate({ to: "/advisor/inbox", search: { client: c.id } });
                  }}
                >
                  <MessageSquare className="size-4" />
                  Message
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(trustedWarn)} onOpenChange={(open) => !open && setTrustedWarn(null)}>
        <DialogContent>
          <DialogTitle>Trusted Client</DialogTitle>
          <DialogDescription>
            You can only send 1 message until this client replies. Please choose your message carefully.
          </DialogDescription>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setTrustedWarn(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const id = trustedWarn?.id;
                setTrustedWarn(null);
                if (id) void navigate({ to: "/advisor/inbox", search: { client: id } });
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

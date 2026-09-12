import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, LifeBuoy, MessageSquare, Radio, UserPlus, UserRound, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, Panel, Stat } from "@/components/admin-shell";
import { formatClock, formatWhen } from "@/lib/ora";
import { adminOverview, COINS_PER_DOLLAR, formatMoney } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/")({ component: OverviewPage });

function coinsToMoney(coins: number, currency: string) {
  return formatMoney(Math.max(0, coins) * (100 / COINS_PER_DOLLAR), currency);
}

function OverviewPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminOverview>> | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    void adminOverview({ data: { t: Date.now() } })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "No access"));
  }, []);

  if (err) return <p className="text-danger">{err}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  const s = data.stats;
  const currency = data.settings.currency;

  return (
    <main>
      <PageHeader
        kicker={`${data.settings.name} · owner`}
        title="Overview"
        description="Live floor, sales, and house take. Figures are from the database — tap a card to open that section."
      />

      {s.pendingApps > 0 ? (
        <Link
          to="/admin/advisors"
          className="mb-5 flex h-11 items-center justify-between rounded-xl bg-elevated px-4 text-sm text-primary shadow-[var(--shadow-border)]"
        >
          <span>
            {s.pendingApps} advisor {s.pendingApps === 1 ? "application" : "applications"} waiting
          </span>
          <span>Review</span>
        </Link>
      ) : null}

      {s.unreadTickets > 0 || s.openTickets > 0 ? (
        <Link
          to="/admin/support"
          className="mb-5 flex h-11 items-center justify-between rounded-xl bg-elevated px-4 text-sm text-primary shadow-[var(--shadow-border)]"
        >
          <span>
            {s.unreadTickets > 0
              ? `${s.unreadTickets} new support ${s.unreadTickets === 1 ? "ticket" : "tickets"}`
              : `${s.openTickets} open support ${s.openTickets === 1 ? "ticket" : "tickets"}`}
          </span>
          <span>Open desk</span>
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Total Customers" value={String(s.customers)} icon={UserRound} to="/admin/customers" />
        <Stat label="Total Psychics" value={String(s.advisors)} icon={Users} to="/admin/advisors" />
        <Stat
          label="Psychics Online Now"
          value={String(s.online)}
          icon={Radio}
          to="/admin/advisors"
          pulse={s.online > 0}
        />
        <Stat
          label="Active Live Chats"
          value={String(s.liveChats)}
          icon={MessageSquare}
          to="/admin/sessions"
          pulse={s.liveChats > 0}
        />
        <Stat
          label="Today's New Customers"
          value={String(s.newCustomersToday)}
          icon={UserPlus}
          to="/admin/customers"
        />
        <Stat
          label="Open Support Tickets"
          value={String(s.openTickets)}
          hint={s.unreadTickets ? `${s.unreadTickets} unread` : "Open or in progress"}
          icon={LifeBuoy}
          to="/admin/support"
          pulse={s.unreadTickets > 0}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Today's Sales"
          value={coinsToMoney(s.todaySales, currency)}
          hint={`${s.todaySales}c billed today`}
          icon={Wallet}
          to="/admin/finance"
        />
        <Stat
          label="Total Revenue"
          value={coinsToMoney(s.revenue, currency)}
          hint={`${s.revenue}c · ${data.settings.platformShare}% take`}
          icon={Banknote}
          to="/admin/finance"
        />
        <Stat
          label="Pending Payouts"
          value={coinsToMoney(s.pendingPayouts, currency)}
          hint={`${s.pendingPayouts}c waiting`}
          icon={Banknote}
          to="/admin/payouts"
        />
      </div>

      <Panel title="Live sessions">
        {!data.live.length ? (
          <p className="text-sm text-muted">No chats on the clock.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
            {data.live.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {r.client} · {r.advisor}
                  <span className="mt-0.5 block text-xs text-faint">{formatWhen(r.startedAt)}</span>
                </span>
                <span className="tabular-nums text-primary">
                  {formatClock(r.seconds)} · {r.coinsSpent}c
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link to="/admin/sessions" className="text-primary">
            All sessions
          </Link>
          <Link to="/admin/advisors" className="text-primary">
            Applications
          </Link>
          <Link to="/admin/payouts" className="text-primary">
            Payouts
          </Link>
        </div>
      </Panel>
    </main>
  );
}

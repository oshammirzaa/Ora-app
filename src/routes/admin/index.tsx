import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  CalendarDays,
  Coins,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Radio,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { InfoNote, PageHeader, Panel, QuietNote, Stat, EmptyNote } from "@/components/admin-shell";
import { formatClock, formatWhen } from "@/lib/ora";
import { adminOverview, adminReports, COINS_PER_DOLLAR, formatMoney } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/")({ component: OverviewPage });

function coinsToMoney(coins: number, currency: string) {
  return formatMoney(Math.max(0, coins) * (100 / COINS_PER_DOLLAR), currency);
}

type ReportRow = { day: string; sessions: number; spent: number; earned: number; fee: number };

function sumRows(rows: ReportRow[]) {
  return rows.reduce(
    (acc, row) => ({
      sessions: acc.sessions + row.sessions,
      spent: acc.spent + row.spent,
      earned: acc.earned + row.earned,
      fee: acc.fee + row.fee,
    }),
    { sessions: 0, spent: 0, earned: 0, fee: 0 },
  );
}

function OverviewPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminOverview>> | null>(null);
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    void adminOverview({ data: { t: Date.now() } })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "No access"));
    void adminReports({ data: { days: 30, t: Date.now() } })
      .then((next) => setReports(next.rows))
      .catch(() => setReports(null));
  }, []);

  if (err) return <p className="text-danger">{err}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl border border-dash-note-line bg-dash-violet" />;

  const s = data.stats;
  const currency = data.settings.currency;
  const quiet = s.todaySales === 0 && s.liveChats === 0 && s.newCustomersToday === 0;
  const ordered = [...(reports ?? [])].sort((a, b) => a.day.localeCompare(b.day));
  const todayRow = ordered.at(-1);
  const week = sumRows(ordered.slice(-7));
  const month = sumRows(ordered);
  const maxBar = Math.max(1, ...ordered.map((row) => row.spent + row.fee));

  return (
    <main>
      <PageHeader
        icon={LayoutDashboard}
        kicker={data.settings.name}
        title="Overview"
        description="Live floor, sales, and house take. Every figure is read from the database."
      />

      <InfoNote>
        Revenue cards use stored session fees, coin purchases, and payout requests. Promo gifts and cancelled chats stay out of the billed sitting totals.
      </InfoNote>

      {quiet ? (
        <QuietNote>
          <CalendarDays className="size-4 shrink-0 text-gold" strokeWidth={2} />
          No new billed activity on the floor yet today.
        </QuietNote>
      ) : null}

      {s.pendingApps > 0 ? (
        <Link
          to="/admin/advisors"
          className="mb-3 flex min-h-12 items-center justify-between rounded-2xl border border-dash-sand-line bg-dash-sand px-4 text-sm text-fg"
        >
          <span>
            {s.pendingApps} advisor {s.pendingApps === 1 ? "application" : "applications"} waiting
          </span>
          <span className="font-medium text-gold">Review</span>
        </Link>
      ) : null}

      {s.unreadTickets > 0 || s.openTickets > 0 ? (
        <Link
          to="/admin/support"
          className="mb-3 flex min-h-12 items-center justify-between rounded-2xl border border-dash-rose-line bg-dash-rose px-4 text-sm text-fg"
        >
          <span>
            {s.unreadTickets > 0
              ? `${s.unreadTickets} new support ${s.unreadTickets === 1 ? "ticket" : "tickets"}`
              : `${s.openTickets} open support ${s.openTickets === 1 ? "ticket" : "tickets"}`}
          </span>
          <span className="font-medium text-dash-rose-ink">Open desk</span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total revenue" value={coinsToMoney(s.revenue, currency)} hint={`${s.revenue}c house take`} icon={Banknote} to="/admin/finance" tone="sand" />
        <Stat label="Today's sales" value={coinsToMoney(s.todaySales, currency)} hint={`${s.todaySales}c billed today`} icon={Wallet} to="/admin/finance" tone="sand" />
        <Stat label="Coin purchases" value={formatMoney(s.paymentCents, currency)} hint={`${s.paymentCoins} coins sold`} icon={Coins} to="/admin/finance" tone="violet" />
        <Stat label="Active advisors" value={String(s.advisors)} hint="Profiles on the floor" icon={Users} to="/admin/advisors" tone="violet" />
        <Stat label="Online advisors" value={String(s.online)} hint="Live and available" icon={Radio} to="/admin/advisors" pulse={s.online > 0} tone="mint" />
        <Stat label="Total customers" value={String(s.customers)} hint="Registered accounts" icon={UserRound} to="/admin/customers" tone="rose" />
        <Stat label="New customers" value={String(s.newCustomersToday)} hint="Signed up today" icon={UserPlus} to="/admin/customers" tone="rose" />
        <Stat label="Live sessions" value={String(s.liveChats)} hint="On the clock now" icon={MessageSquare} to="/admin/sessions" pulse={s.liveChats > 0} tone="sky" />
        <Stat label="Pending payouts" value={coinsToMoney(s.pendingPayouts, currency)} hint={`${s.pendingPayouts}c requested`} icon={Banknote} to="/admin/payouts" tone="warn" />
        <Stat
          label="Open support"
          value={String(s.openTickets)}
          hint={s.unreadTickets ? `${s.unreadTickets} unread` : "Open or in progress"}
          icon={LifeBuoy}
          to="/admin/support"
          pulse={s.unreadTickets > 0}
          tone="teal"
        />
      </div>

      {ordered.length ? (
        <Panel title="Daily, weekly, and monthly sittings" icon={CalendarDays}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat
              label="Latest day"
              value={coinsToMoney(todayRow?.spent ?? 0, currency)}
              hint={todayRow ? `${todayRow.day} · ${todayRow.sessions} sittings · house ${todayRow.fee}c` : "No row"}
              tone="sand"
            />
            <Stat
              label="Last 7 recorded days"
              value={coinsToMoney(week.spent, currency)}
              hint={`${week.sessions} sittings · advisor ${week.earned}c · house ${week.fee}c`}
              tone="violet"
            />
            <Stat
              label="Last 30 recorded days"
              value={coinsToMoney(month.spent, currency)}
              hint={`${month.sessions} sittings · advisor ${month.earned}c · house ${month.fee}c`}
              tone="sky"
            />
          </div>
          <ul className="mt-3 space-y-2">
            {ordered.slice(-14).reverse().map((row) => (
              <li key={row.day} className="rounded-xl bg-surface px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{row.day}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {row.sessions} · spend {row.spent}c · house {row.fee}c
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#efe6f2]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, Math.round(((row.spent + row.fee) / maxBar) * 100))}%`,
                      background: "linear-gradient(90deg, #c4a35a, #7a4e6c)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Link to="/admin/reports" className="mt-3 inline-flex text-sm font-medium text-primary">
            Open full reports
          </Link>
        </Panel>
      ) : null}

      <Panel title="Live sessions" icon={MessageSquare}>
        {!data.live.length ? (
          <EmptyNote>No chats on the clock.</EmptyNote>
        ) : (
          <ul className="ora-rows">
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
          <Link to="/admin/sessions" className="font-medium text-primary">
            All sessions
          </Link>
          <Link to="/admin/advisors" className="font-medium text-primary">
            Applications
          </Link>
          <Link to="/admin/payouts" className="font-medium text-primary">
            Payouts
          </Link>
        </div>
      </Panel>
    </main>
  );
}


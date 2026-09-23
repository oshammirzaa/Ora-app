import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Heart, MessageSquare, PhoneIncoming, Repeat, Star, Timer, UserPlus, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, FilterChips, Initials, StatTile } from "@/components/advisor-desk";
import { advisorClientList, advisorStatistics, listAdvisorReminders } from "@/lib/ora-advisor-desk";
import { answerRate, compactClientBuckets, completionRate, formatPaidMinuteValue, formatPct, formatUsdFromCoins, groupAdvisorReminders, repeatClientRate, type AdvisorReminderRow, type CompactAdvisorClient } from "@/lib/ora-advisor-desk-stats";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { formatWhen } from "@/lib/ora";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/advisor/")({ component: StatisticsPage });

type Range = "day" | "week" | "month" | "all";

function StatisticsPage() {
  const [range, setRange] = useState<Range>("day");
  const [day, setDay] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorStatistics>> | null>(null);
  const [today, setToday] = useState<Awaited<ReturnType<typeof advisorStatistics>> | null>(null);
  const [reminders, setReminders] = useState<AdvisorReminderRow[]>([]);
  const [clients, setClients] = useState<CompactAdvisorClient[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return advisorStatistics({ data: { range, day } })
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load statistics."));
  }, [range, day]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void advisorStatistics({ data: { range: "day" } })
      .then(setToday)
      .catch(() => setToday(null));
    void listAdvisorReminders()
      .then((d) => setReminders(d.reminders as AdvisorReminderRow[]))
      .catch(() => setReminders([]));
    void advisorClientList({ data: { q: "" } })
      .then((d) => setClients((d.clients || []) as CompactAdvisorClient[]))
      .catch(() => setClients([]));
  }, []);

  if (error && !data) {
    return (
      <main>
        <p className="text-sm text-muted">{error}</p>
      </main>
    );
  }
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  const answer = answerRate(data.accepted, data.declined);
  const complete = completionRate(data.completed, data.cancelled);
  const repeat = repeatClientRate(data.repeatClients, data.totalClients);
  const todayQuiet = today && today.completed === 0 && today.earnings === 0 && today.paidMinutes === 0;
  const rangeEmpty =
    data.completed === 0 &&
    data.accepted === 0 &&
    data.declined === 0 &&
    data.onlineSeconds === 0 &&
    data.reviewCount === 0;
  const followUps = groupAdvisorReminders(reminders);
  const followPreview = [...followUps.due, ...followUps.upcoming].slice(0, 4);
  const clientBuckets = compactClientBuckets(clients, 6);

  return (
    <main>
      <p className="text-xs tracking-wide text-faint uppercase">Calculated from your desk</p>
      <h1 className="mt-1 font-display text-3xl">Statistics</h1>
      <p className="mt-1 text-sm text-muted">No placeholders. Empty windows show a dash.</p>

      <section className="mt-5">
        <p className="text-xs tracking-wide text-faint uppercase">Today</p>
        <p className="mt-1 text-sm text-muted">
          Paid minutes and earnings from completed billed sittings. Promo, gifts, and cancelled chats are left out.
        </p>
        {todayQuiet ? (
          <p className="mt-2 text-sm text-muted">No paid activity yet today.</p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label="Paid minutes today"
            value={formatPaidMinuteValue(today?.paidMinutes ?? 0)}
            hint="Billed coins only"
            icon={Timer}
            tone="gold"
          />
          <StatTile
            label="Earnings today"
            value={formatUsdFromCoins(today?.earnings ?? 0)}
            hint={
              today?.charged
                ? `20% of ${formatUsdFromCoins(today.charged)} charged`
                : "20% of billed readings"
            }
            icon={Wallet}
            tone="gold"
          />
          <StatTile
            label="Completed"
            value={String(today?.completed ?? 0)}
            hint="Ended sittings"
            icon={CheckCircle2}
            tone="ok"
          />
          <StatTile
            label="New clients"
            value={String(today?.newClients ?? 0)}
            hint="First paid reading"
            icon={UserPlus}
            tone="lotus"
          />
          <StatTile
            label="Returning clients"
            value={String(today?.repeatClients ?? 0)}
            hint="Prior paid reading"
            icon={Repeat}
            tone="blush"
          />
          <StatTile
            label="Online time today"
            value={formatDuration(today?.onlineSeconds ?? 0)}
            hint={today?.online ? "Includes the open session" : "Time you were live"}
            icon={Clock}
            tone="ok"
          />
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="text-xs tracking-wide text-faint uppercase">Message Earnings</p>
        <p className="mt-1 text-sm text-muted">
          Coin-paid customer messages only. Separate from live-reading earnings. You keep 50%. Ora keeps 50%.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Coin-paid messages" value={String(today?.messageEarnings?.paidMessages ?? 0)} hint="All time" icon={MessageSquare} tone="gold" />
          <StatTile label="Message exchanges" value={String(today?.messageEarnings?.exchanges ?? 0)} hint="Inbox messages" icon={Users} tone="primary" />
          <StatTile label="Your message earnings" value={formatUsdFromCoins(today?.messageEarnings?.advisorEarnings ?? 0)} hint={`${today?.messageEarnings?.advisorEarnings ?? 0}c · 50%`} icon={Wallet} tone="gold" />
          <StatTile label="Ora share" value={formatUsdFromCoins(today?.messageEarnings?.oraShare ?? 0)} hint={`${today?.messageEarnings?.oraShare ?? 0}c · 50%`} icon={Wallet} tone="lotus" />
          <StatTile label="Paid messages today" value={String(today?.messageEarnings?.todayPaidMessages ?? 0)} hint="UTC day" icon={MessageSquare} tone="blush" />
          <StatTile label="Earnings today" value={formatUsdFromCoins(today?.messageEarnings?.todayEarnings ?? 0)} hint={`${today?.messageEarnings?.todayEarnings ?? 0}c from messages`} icon={Wallet} tone="ok" />
        </div>
        <div className="mt-4">
          <p className="text-[10px] tracking-[0.14em] text-faint uppercase">Paid message history</p>
          {(today?.messageEarnings?.history ?? []).length ? (
            <ul className="mt-2 space-y-2">
              {(today?.messageEarnings?.history ?? []).map((row) => (
                <li key={`${row.customerId}-${row.at}`} className="rounded-xl bg-blush/50 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{row.customerName}</p>
                    <p className="shrink-0 text-xs text-muted">{formatWhen(row.at)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {row.paidCount} coin-paid · {row.charged}c charged · you {row.advisorShare}c
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No coin-paid messages yet.</p>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs tracking-wide text-faint uppercase">Follow-ups</p>
          <Link to="/advisor/todo" preload={false} className="text-xs text-primary">
            Open follow-ups
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <FollowCount label="Due" value={followUps.due.length} />
          <FollowCount label="Upcoming" value={followUps.upcoming.length} />
          <FollowCount label="Completed" value={followUps.completed.length} />
        </div>
        {followPreview.length ? (
          <ul className="mt-3 space-y-1.5">
            {followPreview.map((item) => (
              <li key={item.id} className="text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted"> · {formatWhen(item.dueAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No open follow-ups. Set one from a client or completed reading.</p>
        )}
      </section>

      <section className="mt-5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs tracking-wide text-faint uppercase">Favorites & returning</p>
          <Link to="/advisor/customers" preload={false} className="text-xs text-primary">
            Open clients
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <FollowCount label="Returning" value={clients.filter((c) => c.repeat).length} />
          <FollowCount label="Your favorites" value={clients.filter((c) => c.favorite).length} />
          <FollowCount label="Favorited you" value={clients.filter((c) => c.favoritedYou).length} />
        </div>
        <ClientPreview title="Returning" rows={clientBuckets.returning} empty="No returning clients yet." />
        <ClientPreview title="Your favorites" rows={clientBuckets.favorites} empty="Star a client from their profile." />
        <ClientPreview title="Favorited you" rows={clientBuckets.favoritedYou} empty="No clients have saved you yet." />
      </section>

      <div className="mt-6 space-y-3">
        <FilterChips
          value={range}
          onChange={(v) => {
            setDay("");
            setRange(v);
          }}
          options={[
            { id: "day", label: "Today" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
            { id: "all", label: "All time" },
          ]}
        />
        <label className="block text-xs tracking-wide text-faint uppercase">
          Specific day
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1" />
        </label>
      </div>

      {rangeEmpty ? (
        <div className="mt-4">
          <EmptyState title="Not enough activity yet" body="Performance stays blank until real sittings, presence, or reviews land." />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Online time" value={formatDuration(data.onlineSeconds)} hint={data.online ? "Includes the open session" : undefined} icon={Clock} tone="ok" />
          <StatTile label="Average online" value={formatDuration(data.averageOnlineSeconds)} hint="Per day with presence" icon={Timer} tone="lotus" />
          <StatTile label="Answer rate" value={formatPct(answer)} hint={`${data.accepted} accepted · ${data.declined} declined`} icon={PhoneIncoming} tone="primary" />
          <StatTile label="Completion rate" value={formatPct(complete)} hint={`${data.completed} completed · ${data.cancelled} cancelled`} icon={CheckCircle2} tone="ok" />
          <StatTile label="Repeat clients" value={formatPct(repeat)} hint={`${data.repeatClients} of ${data.totalClients}`} icon={Repeat} tone="blush" />
          <StatTile label="Total clients" value={String(data.totalClients)} icon={Users} tone="primary" />
          <StatTile label="First-time" value={String(data.firstTimeClients)} icon={UserPlus} tone="lotus" />
          <StatTile label="Repeat count" value={String(data.repeatClients)} icon={Heart} tone="blush" />
          <StatTile label="Paid readings" value={String(data.paidReadings)} icon={MessageSquare} tone="gold" />
          <StatTile label="Paid minutes" value={formatPaidMinuteValue(data.paidMinutes)} icon={Timer} tone="gold" />
          <StatTile
            label="Average rating"
            value={data.avgRating == null ? "—" : data.avgRating.toFixed(1)}
            hint={data.reviewCount ? `${data.reviewCount} review${data.reviewCount === 1 ? "" : "s"}` : "No reviews yet"}
            icon={Star}
            tone="lotus"
          />
          <StatTile
            label="Your earnings"
            value={formatUsdFromCoins(data.earnings)}
            hint={data.charged ? `20% of ${formatUsdFromCoins(data.charged)} charged` : "20% share"}
            icon={Wallet}
            tone="gold"
          />
        </div>
      )}

      <Link
        to="/advisor/earnings"
        preload={false}
        className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-surface text-sm text-primary shadow-[var(--shadow-border)]"
      >
        Open revenue detail
      </Link>
    </main>
  );
}

function FollowCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-blush/60 px-2.5 py-2">
      <p className="text-[10px] tracking-[0.14em] text-faint uppercase">{label}</p>
      <p className="mt-0.5 font-display text-xl tabular-nums">{value}</p>
    </div>
  );
}

function ClientPreview({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: CompactAdvisorClient[];
  empty: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-[10px] tracking-[0.14em] text-faint uppercase">{title}</p>
      {rows.length ? (
        <ul className="mt-1.5 space-y-1.5">
          {rows.map((row) => (
            <li key={`${title}-${row.id}`}>
              <Link
                to="/advisor/customers/$id"
                params={{ id: row.id }}
                preload={false}
                className="flex items-center gap-2 rounded-xl px-0.5 py-1"
              >
                <Initials name={row.name} photo={row.photoUrl} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                <span className="text-xs tabular-nums text-muted">{row.readings} readings</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

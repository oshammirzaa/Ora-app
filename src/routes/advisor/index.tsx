import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Heart, MessageSquare, PhoneIncoming, Repeat, Star, Timer, UserPlus, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, FilterChips, StatTile } from "@/components/advisor-desk";
import { advisorStatistics, listAdvisorReminders } from "@/lib/ora-advisor-desk";
import { answerRate, completionRate, formatPaidMinuteValue, formatPct, formatUsdFromCoins, repeatClientRate } from "@/lib/ora-advisor-desk-stats";
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
  const [reminders, setReminders] = useState<Awaited<ReturnType<typeof listAdvisorReminders>>["reminders"]>([]);
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
      .then((d) => setReminders(d.reminders))
      .catch(() => setReminders([]));
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
  const due = reminders.filter((r) => r.due);

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
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
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
            icon={UserPlus}
            tone="lotus"
          />
          <StatTile
            label="Repeat clients"
            value={String(today?.repeatClients ?? 0)}
            icon={Repeat}
            tone="blush"
          />
        </div>
      </section>

      {due.length ? (
        <section className="mt-5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs tracking-wide text-faint uppercase">Due follow-ups</p>
            <Link to="/advisor/todo" preload={false} className="text-xs text-primary">
              Things To Do
            </Link>
          </div>
          <ul className="mt-2 space-y-1.5">
            {due.slice(0, 4).map((item) => (
              <li key={item.id} className="text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted"> · {formatWhen(item.dueAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

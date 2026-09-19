import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Heart, MessageSquare, PhoneIncoming, Repeat, Timer, UserPlus, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FilterChips, StatTile } from "@/components/advisor-desk";
import { advisorStatistics } from "@/lib/ora-advisor-desk";
import { answerRate, completionRate, formatPct, formatUsdFromCoins, repeatClientRate } from "@/lib/ora-advisor-desk-stats";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/advisor/")({ component: StatisticsPage });

type Range = "day" | "week" | "month" | "all";

function StatisticsPage() {
  const [range, setRange] = useState<Range>("day");
  const [day, setDay] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorStatistics>> | null>(null);
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

  return (
    <main>
      <p className="text-xs tracking-wide text-faint uppercase">Calculated from your desk</p>
      <h1 className="mt-1 font-display text-3xl">Statistics</h1>
      <p className="mt-1 text-sm text-muted">No placeholders. Empty windows show a dash.</p>

      <div className="mt-4 space-y-3">
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

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Online time" value={formatDuration(data.onlineSeconds)} hint={data.online ? "Includes the open session" : undefined} icon={Clock} tone="ok" />
        <StatTile label="Average online" value={formatDuration(data.averageOnlineSeconds)} hint="Per day with presence" icon={Timer} tone="lotus" />
        <StatTile label="Answer rate" value={formatPct(answer)} hint={`${data.accepted} accepted · ${data.declined} declined`} icon={PhoneIncoming} tone="primary" />
        <StatTile label="Completion rate" value={formatPct(complete)} hint={`${data.completed} completed · ${data.cancelled} cancelled`} icon={CheckCircle2} tone="ok" />
        <StatTile label="Repeat clients" value={formatPct(repeat)} hint={`${data.repeatClients} of ${data.totalClients}`} icon={Repeat} tone="blush" />
        <StatTile label="Total clients" value={String(data.totalClients)} icon={Users} tone="primary" />
        <StatTile label="First-time" value={String(data.firstTimeClients)} icon={UserPlus} tone="lotus" />
        <StatTile label="Repeat count" value={String(data.repeatClients)} icon={Heart} tone="blush" />
        <StatTile label="Chat minutes" value={data.minutes.toFixed(1)} icon={MessageSquare} tone="gold" />
        <StatTile label="Your earnings" value={`${data.earnings}c`} hint={`${formatUsdFromCoins(data.earnings)} · 20% share`} icon={Wallet} tone="gold" />
      </div>

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

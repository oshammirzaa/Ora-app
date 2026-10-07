import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAdvisorHours, saveAdvisorHours } from "@/lib/ora-advisor-desk";
import { weekdayLabel, WEEKDAY_KEYS, type AdvisorHours } from "@/lib/ora-advisor-desk-stats";
import {
  ADVISOR_TIMEZONES,
  MAX_DAY_PERIODS,
  addDayPeriod,
  daySchedulePeriods,
  removeDayPeriod,
  scheduleFormDefaults,
} from "@/lib/ora-advisor-schedule";

export const Route = createFileRoute("/advisor/schedule")({ component: SchedulePage });

function SchedulePage() {
  const { user, isPending } = useCurrentUserState();
  const [hours, setHours] = useState<AdvisorHours | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getAdvisorHours()
      .then((hrs) => {
        const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
        setHours(scheduleFormDefaults(hrs.hours, hrs.hours.configured ? hrs.hours.timezone : browserTz || hrs.timezone));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load schedule"));
  }, [user]);

  async function saveHours() {
    if (!hours || savingHours) return;
    setSavingHours(true);
    try {
      await saveAdvisorHours({ data: { hours } });
      toast.success("Schedule saved. It never turns you online automatically.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save hours");
    } finally {
      setSavingHours(false);
    }
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;
  if (!hours) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main className="space-y-4">
      <Link to="/advisor/profile" preload={false} className="text-sm text-primary">
        Back to profile
      </Link>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="text-xs tracking-wide text-faint uppercase">Schedule & availability</p>
        <p className="mt-1 text-xs text-muted">
          Customers see Online only when you are in service, not away, and inside these hours. Saving a schedule never turns you online.
        </p>
        <label className="mt-3 block text-xs tracking-wide text-faint uppercase">
          Timezone
          <select
            value={hours.timezone}
            onChange={(e) => setHours({ ...hours, timezone: e.target.value })}
            className="mt-1 flex h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none"
          >
            {[hours.timezone, ...ADVISOR_TIMEZONES.filter((tz) => tz !== hours.timezone)].map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <ul className="mt-3 space-y-3">
          {WEEKDAY_KEYS.map((key) => {
            const row = hours[key];
            const periods = daySchedulePeriods(row);
            return (
              <li key={key} className="rounded-xl bg-elevated/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.on}
                    onClick={() => setHours({ ...hours, [key]: { ...row, on: !row.on } })}
                    className="text-left text-xs text-muted"
                  >
                    {weekdayLabel(key)} · {row.on ? "Available" : "Unavailable"}
                  </button>
                  {row.on && periods.length < MAX_DAY_PERIODS ? (
                    <button
                      type="button"
                      className="text-xs text-primary"
                      onClick={() => setHours({ ...hours, [key]: addDayPeriod(row) })}
                    >
                      Add period
                    </button>
                  ) : null}
                </div>
                {row.on ? (
                  <div className="mt-2 space-y-2">
                    {periods.map((period, index) => (
                      <div key={`${key}-${index}`} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={period.start}
                          onChange={(e) => {
                            const next = periods.map((p, i) => (i === index ? { ...p, start: e.target.value } : p));
                            setHours({
                              ...hours,
                              [key]: { ...row, start: next[0].start, end: next[0].end, periods: next },
                            });
                          }}
                          className="h-10"
                        />
                        <Input
                          type="time"
                          value={period.end}
                          onChange={(e) => {
                            const next = periods.map((p, i) => (i === index ? { ...p, end: e.target.value } : p));
                            setHours({
                              ...hours,
                              [key]: { ...row, start: next[0].start, end: next[0].end, periods: next },
                            });
                          }}
                          className="h-10"
                        />
                        {periods.length > 1 ? (
                          <button
                            type="button"
                            className="text-xs text-faint"
                            onClick={() => setHours({ ...hours, [key]: removeDayPeriod(row, index) })}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-faint">Marked unavailable for the whole day.</p>
                )}
              </li>
            );
          })}
        </ul>
        <Button className="mt-3 w-full" disabled={savingHours} onClick={() => void saveHours()}>
          {savingHours ? "Saving…" : "Save schedule"}
        </Button>
      </section>
    </main>
  );
}

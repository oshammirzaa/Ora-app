import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { decideBooking, getBookingAvailability, listAdvisorBookings, saveBookingAvailability } from "@/lib/ora-advanced-api";
import { formatWhen } from "@/lib/ora";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const Route = createFileRoute("/advisor/bookings")({ component: BookingsPage });

function BookingsPage() {
  const { user, isPending } = useCurrentUserState();
  const [timezone, setTimezone] = useState("UTC");
  const [days, setDays] = useState<Record<string, { start: string; end: string }>>({});
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdvisorBookings>>["bookings"]>([]);

  async function load() {
    const [avail, list] = await Promise.all([getBookingAvailability(), listAdvisorBookings()]);
    setTimezone(avail.timezone || "UTC");
    const next: Record<string, { start: string; end: string }> = {};
    for (const day of DAYS) {
      const window = avail.days?.[day]?.[0];
      next[day] = { start: window?.start || "09:00", end: window?.end || "17:00" };
    }
    setDays(next);
    setRows(list.bookings);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not load the schedule"));
  }, [user]);

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  return (
    <main className="space-y-4">
      <Link to="/advisor/settings" className="text-sm text-primary">Settings</Link>
      <h1 className="font-display text-3xl">Scheduled Readings</h1>
      <p className="text-sm text-muted">These appointments do not charge the customer. A live reading still starts only when someone requests chat.</p>
      <form
        className="space-y-2 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
        onSubmit={(event) => {
          event.preventDefault();
          const payload: Record<string, { start: string; end: string }[]> = {};
          for (const day of DAYS) payload[day] = days[day]?.start && days[day]?.end ? [days[day]] : [];
          void saveBookingAvailability({ data: { timezone, days: payload } })
            .then(() => toast.success("Availability saved."))
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
        }}
      >
        <label className="block text-sm">Timezone
          <input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-1 h-11 w-full rounded-md bg-elevated px-3 text-sm" />
        </label>
        {DAYS.map((day) => (
          <div key={day} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 text-sm">
            <span className="capitalize">{day}</span>
            <input type="time" value={days[day]?.start || "09:00"} onChange={(event) => setDays({ ...days, [day]: { ...days[day], start: event.target.value } })} className="h-11 rounded-md bg-elevated px-2" aria-label={`${day} start`} />
            <input type="time" value={days[day]?.end || "17:00"} onChange={(event) => setDays({ ...days, [day]: { ...days[day], end: event.target.value } })} className="h-11 rounded-md bg-elevated px-2" aria-label={`${day} end`} />
          </div>
        ))}
        <Button type="submit" className="w-full">Save weekly availability</Button>
      </form>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-sm">{row.customerName}</p>
            <p className="text-xs text-faint">{formatWhen(row.startAt)} · {row.durationMin} min · {row.status.replaceAll("_", " ")}</p>
            {row.note ? <p className="mt-1 text-sm text-muted">{row.note}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {["pending", "reschedule_requested"].includes(row.status) ? (
                <Button size="sm" onClick={() => void decideBooking({ data: { id: row.id, action: "accept" } }).then(load).catch((err) => toast.error(err instanceof Error ? err.message : "Could not accept"))}>Accept</Button>
              ) : null}
              {["pending", "accepted", "reschedule_requested"].includes(row.status) ? (
                <Button size="sm" variant="outline" onClick={() => void decideBooking({ data: { id: row.id, action: "decline" } }).then(load)}>Decline</Button>
              ) : null}
              {row.status === "accepted" ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => void decideBooking({ data: { id: row.id, action: "completed" } }).then(load)}>Completed</Button>
                  <Button size="sm" variant="ghost" onClick={() => void decideBooking({ data: { id: row.id, action: "missed" } }).then(load)}>Missed</Button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

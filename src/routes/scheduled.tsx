import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bookReading, cancelBooking, listBookingSlots, listMyBookings, requestReschedule } from "@/lib/ora-advanced-api";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/scheduled")({
  validateSearch: (search: Record<string, unknown>) => ({
    advisor: typeof search.advisor === "string" ? search.advisor.slice(0, 80) : "",
  }),
  component: ScheduledPage,
});

function ScheduledPage() {
  const { advisor } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof listMyBookings>>["bookings"]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(15);
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState<{ startAt: string; endAt: string }[]>([]);
  const [timezone, setTimezone] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await listMyBookings();
    setBookings(data.bookings);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not load bookings"));
  }, [user]);

  useEffect(() => {
    if (!user || !advisor) return;
    void listBookingSlots({ data: { advisorId: advisor, date, duration } })
      .then((data) => {
        setSlots(data.slots);
        setTimezone(data.timezone || "");
      })
      .catch(() => setSlots([]));
  }, [user, advisor, date, duration]);

  if (isPending) return <AppShell tab="you"><div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" /></AppShell>;
  if (!user) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl">Scheduled readings</h1>
          <Button asChild className="mt-4 rounded-full"><Link to="/login">Sign in</Link></Button>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" className="text-sm text-primary">Account</Link>
        <h1 className="mt-2 font-display text-3xl text-fg">My Scheduled Readings</h1>
        <p className="mt-1 text-sm text-muted">Booking a time does not spend coins or start a live reading. You start the chat yourself when it is time.</p>
        {advisor ? (
          <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs tracking-wide text-faint uppercase">Choose a time</p>
            <p className="mt-1 text-sm text-muted">{timezone ? `Advisor timezone ${timezone}. Times below are shown on this device.` : "If no times appear, this advisor has not opened a schedule."}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 rounded-md bg-elevated px-3 text-sm" aria-label="Date" />
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-11 rounded-md bg-elevated px-3 text-sm" aria-label="Duration">
                {[10, 15, 20, 30].map((min) => <option key={min} value={min}>{min} min</option>)}
              </select>
            </div>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Optional note for the advisor" className="mt-2 w-full rounded-md bg-elevated px-3 py-2 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              {slots.map((slot) => (
                <Button
                  key={slot.startAt}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void bookReading({
                      data: { advisorId: advisor, startAt: slot.startAt, duration, note, customerTz: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    })
                      .then(() => {
                        toast.success("Requested. The advisor still needs to accept.");
                        setNote("");
                        return load();
                      })
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not book"))
                      .finally(() => setBusy(false));
                  }}
                >
                  {new Date(slot.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Button>
              ))}
            </div>
          </section>
        ) : (
          <p className="mt-4 text-sm text-muted">Open an advisor profile and choose Schedule Reading to see open times.</p>
        )}
        <ul className="mt-6 space-y-2">
          {bookings.map((row) => (
            <li key={row.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-fg">{row.advisorName}</p>
                  <p className="text-xs text-faint">{formatWhen(row.startAt)} · {row.durationMin} min · {row.status.replaceAll("_", " ")}</p>
                </div>
              </div>
              {row.note ? <p className="mt-2 text-sm text-muted">{row.note}</p> : null}
              {["pending", "accepted", "reschedule_requested"].includes(row.status) ? (
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void cancelBooking({ data: { id: row.id } }).then(load).then(() => toast.success("Cancelled.")).catch((err) => toast.error(err instanceof Error ? err.message : "Could not cancel"))}>Cancel</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => {
                    const next = window.prompt("New start time (ISO), or leave a note with the advisor from Messages.");
                    if (!next) return;
                    void requestReschedule({ data: { id: row.id, startAt: next } }).then(load).then(() => toast.success("Reschedule requested.")).catch((err) => toast.error(err instanceof Error ? err.message : "Could not reschedule"));
                  }}>Request reschedule</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

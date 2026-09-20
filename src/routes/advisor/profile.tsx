import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Pencil, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DeskLinkRow, Initials, StatTile, ToggleRow } from "@/components/advisor-desk";
import { AdvisorMedia } from "@/components/advisor-media";
import { useAdvisorDeskStatus } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { advisorDeskHome, getAdvisorHours, getAdvisorProfileEdit, saveAdvisorHours, setAcceptsChat } from "@/lib/ora-advisor-desk";
import { answerRate, formatPct, formatUsdFromCoins, genderLabel, weekdayLabel, WEEKDAY_KEYS, type AdvisorHours } from "@/lib/ora-advisor-desk-stats";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { setBusy, setOnline } from "@/lib/ora";

export const Route = createFileRoute("/advisor/profile")({ component: ProfileLayout });

function ProfileLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path.startsWith("/advisor/profile/edit")) return <Outlet />;
  return <ProfilePage />;
}

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const deskStatus = useAdvisorDeskStatus();
  const [home, setHome] = useState<Awaited<ReturnType<typeof advisorDeskHome>> | null>(null);
  const [edit, setEdit] = useState<Awaited<ReturnType<typeof getAdvisorProfileEdit>> | null>(null);
  const [hours, setHours] = useState<AdvisorHours | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  const load = useCallback(async () => {
    const [h, e, hrs] = await Promise.all([advisorDeskHome(), getAdvisorProfileEdit(), getAdvisorHours()]);
    setHome(h);
    setEdit(e);
    setHours(hrs.hours);
  }, []);

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not load profile"));
  }, [user, load]);

  async function toggleOnline(next: boolean) {
    try {
      await setOnline({ data: { online: next } });
      deskStatus.setOnline(next);
      if (!next) deskStatus.setBusy(false);
      await load();
      toast.success(next ? "You are in service." : "You are offline.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  async function toggleBusy(next: boolean) {
    try {
      await setBusy({ data: { busy: next } });
      deskStatus.setBusy(next);
      await load();
      toast.success(next ? "Busy. Customers will see In Session." : "Ready for new chats.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update busy");
    }
  }

  async function toggleChat(next: boolean) {
    try {
      await setAcceptsChat({ data: { accepts: next } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update live chat");
    }
  }

  async function saveHours() {
    if (!hours || savingHours) return;
    setSavingHours(true);
    try {
      await saveAdvisorHours({ data: { hours } });
      toast.success("Hours saved. They never turn you online automatically.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save hours");
    } finally {
      setSavingHours(false);
    }
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;
  if (!home) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  const answer = answerRate(home.accepted, home.declined);
  const photo = edit?.photoUrl || home.photoUrl;
  const live = Boolean(home.inLiveReading);

  return (
    <main className="space-y-4">
      <section className="relative rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <Link
          to="/advisor/profile/edit"
          preload={false}
          aria-label="Edit profile"
          className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full bg-elevated text-primary"
        >
          <Pencil className="size-4" />
        </Link>
        <div className="flex items-start gap-3 pr-12">
          {photo ? (
            <div className="size-16 overflow-hidden rounded-full">
              <AdvisorMedia photo={photo} />
            </div>
          ) : (
            <Initials name={home.name} size="lg" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl leading-tight">{home.name}</p>
            {edit?.headline ? <p className="mt-1 text-sm text-muted">{edit.headline}</p> : null}
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-primary">
              <Star className="size-3 fill-primary" />
              {home.rating ? home.rating.toFixed(1) : "—"} · {home.reviews} reviews
            </p>
            <button
              type="button"
              className="mt-1 truncate text-xs text-faint"
              onClick={() => {
                void navigator.clipboard.writeText(home.advisorId).then(
                  () => toast.success("Advisor ID copied."),
                  () => toast.error("Could not copy ID"),
                );
              }}
            >
              ID {home.advisorId}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Online today" value={formatDuration(home.onlineToday)} />
        <StatTile label="Answer rate" value={formatPct(answer)} />
        <StatTile label="Today" value={`${home.earningsToday}c`} hint={formatUsdFromCoins(home.earningsToday)} />
      </div>

      <section className="rounded-2xl bg-surface px-4 shadow-[var(--shadow-border)]">
        <ToggleRow
          label="Service status"
          hint={live ? "Finish the live reading before going offline." : "Appear on the customer floor."}
          on={home.online}
          disabled={live}
          onToggle={(v) => void toggleOnline(v)}
        />
        <ToggleRow
          label="Busy"
          hint={
            live
              ? "You are in a live reading."
              : home.online
                ? "Customers see In Session. Incoming chats stay hidden."
                : "Go in service before setting busy."
          }
          on={home.busy}
          disabled={live || !home.online}
          onToggle={(v) => void toggleBusy(v)}
        />
        <ToggleRow
          label="Ready for live text chat"
          hint="When off, new paid chats cannot start even if you are in service."
          on={home.acceptsChat}
          onToggle={(v) => void toggleChat(v)}
        />
      </section>

      {hours ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Weekly hours</p>
          <p className="mt-1 text-xs text-muted">Display only. Saving hours never turns you online.</p>
          <ul className="mt-3 space-y-2">
            {WEEKDAY_KEYS.map((key) => {
              const row = hours[key];
              return (
                <li key={key} className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.on}
                    onClick={() => setHours({ ...hours, [key]: { ...row, on: !row.on } })}
                    className="w-12 shrink-0 text-left text-xs text-muted"
                  >
                    {weekdayLabel(key)}
                  </button>
                  <Input
                    type="time"
                    value={row.start}
                    disabled={!row.on}
                    onChange={(e) => setHours({ ...hours, [key]: { ...row, start: e.target.value } })}
                    className="h-10"
                  />
                  <Input
                    type="time"
                    value={row.end}
                    disabled={!row.on}
                    onChange={(e) => setHours({ ...hours, [key]: { ...row, end: e.target.value } })}
                    className="h-10"
                  />
                </li>
              );
            })}
          </ul>
          <Button className="mt-3 w-full" disabled={savingHours} onClick={() => void saveHours()}>
            {savingHours ? "Saving…" : "Save hours"}
          </Button>
        </section>
      ) : null}

      {edit ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Public listing</p>
          <p className="mt-2 text-sm text-muted">{edit.bio || "Add an About Me on Edit Profile so clients know how you read."}</p>
          <p className="mt-3 text-xs text-faint">
            {genderLabel(edit.gender)}
            {edit.specialties ? ` · ${edit.specialties}` : ""}
            {edit.years ? ` · ${edit.years} years` : ""}
          </p>
        </section>
      ) : null}

      <nav className="space-y-2">
        <DeskLinkRow to="/advisor/earnings" label="Revenue detail" />
        <DeskLinkRow to="/advisor/todo" label="Things To Do" hint="Private follow-up reminders" />
        <DeskLinkRow to="/advisor/settings/reviews" label="Rate & Review" />
        <DeskLinkRow to="/advisor/activity" label="Online history" />
        <DeskLinkRow to="/advisor/notes" label="Private notes" />
        <DeskLinkRow to="/advisor/settings" label="Desk settings" />
      </nav>
    </main>
  );
}

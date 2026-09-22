import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, LifeBuoy, LogOut } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorMedia } from "@/components/advisor-media";
import { ChatNow, PresenceBadge } from "@/components/chat-now";
import { MyPsychicCard, NotifySwitch } from "@/components/advisor-cards";
import { AppShell } from "@/components/app-shell";
import { BlockConfirmDialog } from "@/components/safety-dialogs";
import { SessionHistoryCard } from "@/components/session-history-card";
import { Button } from "@/components/ui/button";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { MembershipStatusCard } from "@/components/membership-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readImageFile } from "@/lib/file-data";
import {
  formatClock,
  formatMoney,
  formatWhen,
  getCustomer,
  includedSeconds,
  setOutreachOptOut,
  toggleFavorite,
  updateProfile,
  type Customer,
} from "@/lib/ora";
import { updateCustomerPhoto } from "@/lib/ora-photo-nudge-api";
import { listMyTickets } from "@/lib/ora-support";
import { cancelMembership } from "@/lib/ora-membership";
import { listMyFollowUps, setFavoriteNotify } from "@/lib/ora-favorites";
import { listCustomerBlocks, setCustomerBlock } from "@/lib/ora-safety-api";
import { setFavoriteId } from "@/lib/favorite-store";
import { ADVISOR_GENDERS, genderLabel } from "@/lib/ora-advisor-desk-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me")({ component: MePage });

function MePage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("unspecified");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [out, setOut] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const [followUps, setFollowUps] = useState<Awaited<ReturnType<typeof listMyFollowUps>>["messages"]>([]);
  const [blockedAdvisors, setBlockedAdvisors] = useState<Awaited<ReturnType<typeof listCustomerBlocks>>["blocked"]>([]);
  const [blockTarget, setBlockTarget] = useState<{ advisorId: string; name: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function load() {
    const next = await getCustomer();
    setData(next);
    setName(next.me.displayName);
    setGender(next.me.gender || "unspecified");
    setDateOfBirth(next.me.dateOfBirth || "");
    try {
      const support = await listMyTickets();
      setSupportUnread(support.unread);
    } catch {
      setSupportUnread(0);
    }
    try {
      const inbox = await listMyFollowUps();
      setFollowUps(inbox.messages);
    } catch {
      setFollowUps([]);
    }
    try {
      const blocks = await listCustomerBlocks();
      setBlockedAdvisors(blocks.blocked);
    } catch {
      setBlockedAdvisors([]);
    }
  }

  useEffect(() => {
    if (!user) return;
    void load().catch(() => setData(null));
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#profile-photo") return;
    document.getElementById("profile-photo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data]);

  async function onPhoto(file: File | undefined) {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    try {
      const image = await readImageFile(file);
      const saved = await updateCustomerPhoto({ data: { image } });
      try {
        await authClient.updateUser({ image: saved.image });
      } catch {
        await authClient.getSession().catch(() => {});
      }
      toast.success("Profile picture saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const next = await updateProfile({ data: { displayName: name, gender, dateOfBirth } });
    setData((d) => (d ? { ...d, me: next } : d));
    setGender(next.gender || "unspecified");
    setDateOfBirth(next.dateOfBirth || "");
    toast.success("Profile saved.");
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    const client = authClient as typeof authClient & {
      changePassword?: (opts: { currentPassword: string; newPassword: string }) => Promise<{ error?: { message?: string } }>;
    };
    if (!client.changePassword) {
      toast.error("Password change is not available for this sign-in method.");
      return;
    }
    const { error } = await client.changePassword({ currentPassword: currentPw, newPassword: newPw });
    if (error) {
      toast.error(error.message || "Could not update password");
      return;
    }
    setCurrentPw("");
    setNewPw("");
    toast.success("Password updated.");
  }

  async function unsave(id: string) {
    await toggleFavorite({ data: { advisorId: id } });
    setFavoriteId(id, false);
    await load();
  }

  async function toggleNotify(id: string, notify: boolean) {
    try {
      const res = await setFavoriteNotify({ data: { advisorId: id, notify } });
      if (res.saved) setFavoriteId(id, true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update alert");
    }
  }

  if (isPending) {
    return (
      <AppShell tab="you">
        <div className="mx-4 mt-8 h-48 animate-pulse rounded-xl bg-elevated" />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">Account</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in for three free minutes, your wallet, past readings, and saved advisors.
          </p>
          <Button asChild className="mt-6 w-full rounded-full">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="mt-3 w-full rounded-full">
            <Link to="/signup">Create account</Link>
          </Button>
        </main>
      </AppShell>
    );
  }

  const me = data?.me;
  const w = me?.wallet;

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <p className="text-xs tracking-wide text-faint uppercase">Customer account</p>
        <h1 className="mt-2 font-display text-3xl text-fg">Account</h1>
        {me?.status === "suspended" ? (
          <p className="mt-4 rounded-xl bg-surface p-4 text-sm text-danger shadow-[var(--shadow-border)]">
            This account is suspended. Readings and purchases are paused.
          </p>
        ) : null}

        <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Profile</p>
          <ClientNameWithBadge
            as="p"
            name={me?.displayName || user.displayName || "Member"}
            tier={me?.loyaltyTier}
            className="mt-1 font-display text-2xl"
            nameClassName="font-display text-2xl text-primary"
          />
          <p className="mt-1 text-sm text-muted">{me?.email || user.primaryEmail || "Email on file after first sign-in"}</p>
        </section>

        <section className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Advisor messages</p>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm text-fg">
            <span>Allow follow-up messages from advisors</span>
            <button
              type="button"
              role="switch"
              aria-checked={!me?.outreachOptOut}
              aria-label="Allow follow-up messages from advisors"
              onClick={() => {
                const optedOut = !me?.outreachOptOut ? true : false;
                void setOutreachOptOut({ data: { optedOut } })
                  .then((next) => {
                    setData((cur) => (cur ? { ...cur, me: next } : cur));
                    toast.success(next.outreachOptOut ? "Advisor outreach is off." : "Advisor outreach is on.");
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not update"));
              }}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                !me?.outreachOptOut ? "bg-primary" : "bg-[#d9d2d6]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                  !me?.outreachOptOut ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </label>
          <p className="mt-2 text-xs text-muted">
            Advisors you have already sat with may send a short follow-up. This never uses your free or paid message allowance.
          </p>
        </section>

        <section className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Wallet</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{w ? w.coins : "—"} coins</p>
          <p className="mt-1 text-sm text-muted">
            Promo {w ? formatClock(w.bonusSeconds) : "—"} · This week {w ? formatClock(w.weeklySeconds) : "—"}
            {w?.subscribed ? " · subscribed" : ""}
          </p>
          <p className="mt-1 text-sm text-primary">
            Included time {w ? formatClock(includedSeconds(w)) : "—"}
          </p>
          <Button asChild className="mt-4 w-full rounded-full">
            <Link to="/account">Add funds</Link>
          </Button>
        </section>

        {w?.membershipActive ? (
          <div className="mt-4">
            <MembershipStatusCard
              wallet={w}
              onCancel={() => {
                void cancelMembership()
                  .then(() => load())
                  .then(() => toast.success("Membership stays on until the paid period ends."))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not cancel"));
              }}
            />
          </div>
        ) : null}

        <Link
          to="/support"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]"
        >
          <div className="flex items-center gap-3">
            <LifeBuoy className="size-5 text-primary" />
            <div>
              <p className="font-display text-xl">Support / Help</p>
              <p className="text-sm text-muted">Open a private ticket with Ora staff.</p>
            </div>
          </div>
          {supportUnread ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg">
              {supportUnread} new
            </span>
          ) : null}
        </Link>

        {w && w.bonusSeconds > 0 ? (
          <section className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <p className="text-sm text-primary">Free promotional minutes</p>
            <p className="mt-1 text-sm text-muted">
              {formatClock(w.bonusSeconds)} left from first login. Use them with any advisor before coins.
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link to="/">Start a reading</Link>
            </Button>
          </section>
        ) : null}

        <section id="my-psychics" className="mt-8">
          <h2 className="font-display text-xl text-fg">My Psychics</h2>
          <p className="mt-0.5 text-xs text-muted">Advisors you have already had a reading with.</p>
          {!data?.psychics.length ? (
            <p className="mt-2 text-sm text-muted">Finish a reading and they will appear here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.psychics.map((a) => (
                <li key={a.id}>
                  <MyPsychicCard
                    advisor={a}
                    lastAt={a.lastReadingAt}
                    lastSeconds={a.lastReadingSeconds}
                    lastCoins={a.lastReadingCoins}
                    notifyWhenOnline={a.notifyWhenOnline}
                    onNotify={(next) => void toggleNotify(a.id, next)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="reading-history" className="mt-8">
          <h2 className="font-display text-xl">Reading History</h2>
          {!data?.sessions.length ? (
            <p className="mt-2 text-sm text-muted">No readings yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.sessions.map((s) => (
                <li key={s.id}>
                  <SessionHistoryCard session={s} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {followUps.length ? (
          <section id="follow-ups" className="mt-8">
            <h2 className="font-display text-xl text-fg">Messages</h2>
            <p className="mt-0.5 text-xs text-muted">Follow-ups from advisors after a sitting.</p>
            <ul className="mt-3 space-y-2">
              {followUps.map((m) => (
                <li key={m.id} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
                  <Link to="/advisors/$id" params={{ id: m.advisorSlug }} preload={false} className="block">
                    <p className="font-display text-fg">{m.advisorName}</p>
                    <p className="mt-1 text-sm text-muted">{m.body}</p>
                    <p className="mt-1 text-xs text-faint">{formatWhen(m.at)}</p>
                  </Link>
                  <Link
                    to="/messages/$id"
                    params={{ id: m.advisorSlug }}
                    preload={false}
                    className="mt-2 inline-flex text-xs text-primary"
                  >
                    Reply
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl">Transactions</h2>
          {!data?.ledger.length && !data?.payments.length ? (
            <p className="mt-2 text-sm text-muted">No movement yet. Add funds or start a reading.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
              {(data?.payments ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm">
                      Purchase · {p.coins}c · {formatMoney(p.amountCents, p.currency)}
                    </p>
                    <p className="text-xs text-faint">
                      {p.status} · {p.id} · {formatWhen(p.paidAt || p.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums text-primary">
                    {p.status === "succeeded" ? `+${p.coins}c` : "0c"}
                  </p>
                </li>
              ))}
              {(data?.ledger ?? []).map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm">{row.note}</p>
                    <p className="text-xs text-faint">{formatWhen(row.createdAt)}</p>
                  </div>
                  <p className="text-sm tabular-nums text-primary">
                    {row.amountCoins !== 0 ? `${row.amountCoins > 0 ? "+" : ""}${row.amountCoins}c` : formatClock(row.seconds)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="favorite-psychics" className="mt-8">
          <h2 className="font-display text-xl text-fg">Favorite Psychics</h2>
          <p className="mt-0.5 text-xs text-muted">Saved advisors stay on your account across devices.</p>
          {!data?.favorites.length ? (
            <p className="mt-2 text-sm text-muted">Tap the heart on a psychic to save them here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.favorites.map((a) => (
                <li key={a.id} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
                  <div className="flex items-center gap-3">
                    <Link
                      to="/advisors/$id"
                      params={{ id: a.slug }}
                      preload={false}
                      className="size-12 overflow-hidden rounded-full bg-elevated"
                    >
                      <AdvisorMedia photo={a.photoUrl} />
                    </Link>
                    <Link to="/advisors/$id" params={{ id: a.slug }} preload={false} className="min-w-0 flex-1">
                      <p className="truncate font-display text-fg">{a.name}</p>
                      <p className="truncate text-xs text-muted">{a.specialties}</p>
                      <PresenceBadge advisor={a} className="mt-1" />
                    </Link>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center text-primary"
                      onClick={() => void unsave(a.id)}
                      aria-label="Remove favorite"
                    >
                      <Heart className="size-4 fill-primary text-primary" />
                    </button>
                  </div>
                  <NotifySwitch
                    className="mt-3 rounded-xl bg-elevated/80 px-3 py-2.5"
                    checked={Boolean(a.notifyWhenOnline)}
                    onChange={(next) => void toggleNotify(a.id, next)}
                  />
                  <div className="mt-2">
                    <ChatNow advisor={a} className="h-9 w-full rounded-full px-3 text-xs" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="blocked-advisors" className="mt-8">
          <h2 className="font-display text-xl text-fg">Blocked advisors</h2>
          <p className="mt-0.5 text-xs text-muted">
            Blocked advisors cannot start new messages or live readings with you. Past chats and payments stay in history.
          </p>
          {!blockedAdvisors.length ? (
            <p className="mt-2 text-sm text-muted">You have not blocked anyone.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {blockedAdvisors.map((row) => (
                <li key={row.advisorId} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
                  <Link to="/advisors/$id" params={{ id: row.slug }} preload={false} className="min-w-0">
                    <p className="truncate font-display text-fg">{row.name}</p>
                    <p className="text-xs text-faint">Blocked {formatWhen(row.at)}</p>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBlockTarget({ advisorId: row.advisorId, name: row.name })}
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="profile-photo" className="mt-8 scroll-mt-20 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Account settings</h2>
          <div className="mt-4 flex items-center gap-4">
            <span className="size-16 overflow-hidden rounded-full bg-blush shadow-[var(--shadow-border)]">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="size-16 object-cover outline-none" />
              ) : (
                <span className="grid size-16 place-items-center font-display text-2xl text-primary">
                  {(name || user.displayName || "M").trim().slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <Label htmlFor="profile-photo-file">Profile picture</Label>
              <Input
                id="profile-photo-file"
                type="file"
                accept="image/*"
                className="mt-1"
                disabled={photoBusy}
                onChange={(e) => {
                  void onPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <p className="mt-1 text-xs text-faint">
                {photoBusy ? "Saving…" : "A small photo advisors can see on incoming readings."}
              </p>
            </div>
          </div>
          <form onSubmit={(e) => void saveName(e)} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                aria-label="Gender"
                className="flex h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none"
              >
                {ADVISOR_GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {genderLabel(g)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-faint">Used only for your crown badge at the top loyalty tier. We never guess.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                aria-label="Date of birth"
              />
              <p className="text-xs text-faint">Optional. Advisors you have sat with can see this on their client profile. Leave blank to hide it.</p>
            </div>
            <Button type="submit" variant="outline">
              Save profile
            </Button>
          </form>
          <form onSubmit={(e) => void savePassword(e)} className="mt-6 space-y-3">
            <p className="text-xs tracking-wide text-faint uppercase">Change password</p>
            <div className="space-y-1.5">
              <Label htmlFor="cpw">Current password</Label>
              <Input id="cpw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} minLength={8} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="npw">New password</Label>
              <Input id="npw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required />
            </div>
            <Button type="submit" variant="outline">
              Update password
            </Button>
          </form>
        </section>

        {me?.advisorId ? (
          <Button asChild className="mt-3 w-full rounded-full">
            <Link to="/advisor">Open advisor desk</Link>
          </Button>
        ) : me?.pendingApplication ? (
          <Button asChild className="mt-3 w-full rounded-full">
            <Link to="/advisor/applied">Advisor application status</Link>
          </Button>
        ) : (
          <Button asChild className="mt-3 w-full rounded-full">
            <Link to="/apply">Apply as Advisor</Link>
          </Button>
        )}

        <Button
          variant="outline"
          className="mt-8 w-full rounded-full"
          disabled={out}
          onClick={() => {
            setOut(true);
            void signOut().catch(() => setOut(false));
          }}
        >
          <LogOut className="size-4" />
          {out ? "Signing out…" : "Log out"}
        </Button>
      </main>
      <BlockConfirmDialog
        open={Boolean(blockTarget)}
        name={blockTarget?.name || "Advisor"}
        blocking={false}
        onConfirm={async () => {
          if (!blockTarget) return;
          await setCustomerBlock({ data: { advisorId: blockTarget.advisorId, blocked: false } });
          toast.success("Advisor unblocked.");
          setBlockedAdvisors((rows) => rows.filter((row) => row.advisorId !== blockTarget.advisorId));
        }}
        onOpenChange={(open) => {
          if (!open) setBlockTarget(null);
        }}
      />
    </AppShell>
  );
}

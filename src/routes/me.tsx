import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, LogOut } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorMedia } from "@/components/advisor-media";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  formatClock,
  formatMoney,
  formatWhen,
  getCustomer,
  includedSeconds,
  toggleFavorite,
  updateProfile,
  type Customer,
} from "@/lib/ora";

export const Route = createFileRoute("/me")({ component: MePage });

function MePage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [out, setOut] = useState(false);

  async function load() {
    const next = await getCustomer();
    setData(next);
    setName(next.me.displayName);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch(() => setData(null));
  }, [user]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const next = await updateProfile({ data: { displayName: name } });
    setData((d) => (d ? { ...d, me: next } : d));
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
    await load();
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
          <h1 className="font-display text-3xl">Account</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in for three free minutes, your wallet, past readings, and saved advisors.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="mt-3 w-full">
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
        <h1 className="mt-2 font-display text-3xl">Account</h1>
        {me?.status === "suspended" ? (
          <p className="mt-4 rounded-xl bg-surface p-4 text-sm text-danger shadow-[var(--shadow-border)]">
            This account is suspended. Readings and purchases are paused.
          </p>
        ) : null}

        <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Profile</p>
          <p className="mt-1 font-display text-2xl">{me?.displayName || user.displayName}</p>
          <p className="mt-1 text-sm text-muted">{me?.email || user.primaryEmail || "Email on file after first sign-in"}</p>
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
          <Button asChild className="mt-4 w-full">
            <Link to="/account">Add funds</Link>
          </Button>
        </section>

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

        <section className="mt-8">
          <h2 className="font-display text-xl">Previous sessions</h2>
          {!data?.sessions.length ? (
            <p className="mt-2 text-sm text-muted">No readings yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/reading/$id"
                    params={{ id: s.id }}
                    className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]"
                  >
                    <div className="size-12 overflow-hidden rounded-lg bg-elevated">
                      <AdvisorMedia photo={s.photoUrl} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display">{s.advisorName}</p>
                      <p className="text-xs text-muted">
                        {formatWhen(s.startedAt)}
                        {s.endedAt ? ` – ${formatWhen(s.endedAt)}` : ""} · {formatClock(s.seconds)} · {s.coinsSpent}c ·{" "}
                        {s.rateCoins}c/min
                      </p>
                      <p className="text-xs text-faint">
                        {s.status === "ended" ? (s.reviewed ? "Reviewed" : "Rate this reading") : "Live"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

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

        <section className="mt-8">
          <h2 className="font-display text-xl">Saved advisors</h2>
          {!data?.favorites.length ? (
            <p className="mt-2 text-sm text-muted">Save someone from their profile. They show up here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.favorites.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
                  <Link to="/advisors/$id" params={{ id: a.slug }} className="size-12 overflow-hidden rounded-lg bg-elevated">
                    <AdvisorMedia photo={a.photoUrl} />
                  </Link>
                  <Link to="/advisors/$id" params={{ id: a.slug }} className="min-w-0 flex-1">
                    <p className="truncate font-display">{a.name}</p>
                    <p className="truncate text-xs text-muted">{a.specialties}</p>
                  </Link>
                  <button
                    type="button"
                    className="flex size-10 items-center justify-center text-primary"
                    onClick={() => void unsave(a.id)}
                    aria-label="Remove saved advisor"
                  >
                    <Heart className="size-4 fill-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Account settings</h2>
          <form onSubmit={(e) => void saveName(e)} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
            </div>
            <Button type="submit" variant="outline">
              Save name
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

        {me?.role === "admin" ? (
          <Link className="mt-4 block rounded-xl bg-surface px-4 py-4 text-sm shadow-[var(--shadow-border)]" to="/admin">
            Owner panel
          </Link>
        ) : null}
        <Link className="mt-3 block rounded-xl bg-surface px-4 py-4 text-sm shadow-[var(--shadow-border)]" to="/advisor">
          {me?.advisorId
            ? "Advisor desk"
            : me?.pendingApplication
              ? "Advisor application status"
              : "Work as an advisor"}
        </Link>

        <Button
          variant="outline"
          className="mt-8 w-full"
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
    </AppShell>
  );
}

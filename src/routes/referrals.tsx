import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { applyReferralCode, referralHome } from "@/lib/ora-advanced-api";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/referrals")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code.slice(0, 16) : "",
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Awaited<ReturnType<typeof referralHome>> | null>(null);
  const [failed, setFailed] = useState("");
  const [code, setCode] = useState(search.code);
  const [origin, setOrigin] = useState("");

  async function load() {
    setData(await referralHome());
  }

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => setFailed(err instanceof Error ? err.message : "Could not load referrals"));
  }, [user]);

  if (isPending || (user && !data && !failed)) return <AppShell tab="you"><div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" /></AppShell>;
  if (!user || !data) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">Invite Friends</h1>
          <p className="mt-1 text-sm text-muted">{failed || "Bonus promo coins after a friend’s first paid reading. Sign in for your code."}</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/login">Sign in</Link></Button>
        </main>
      </AppShell>
    );
  }

  const link = data.code && origin ? `${origin}/referrals?code=${data.code}` : "";

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" className="text-sm text-primary">Account</Link>
        <h1 className="mt-2 font-display text-3xl text-fg">Invite Friends</h1>
        <p className="mt-1 text-sm text-muted">
          You receive {data.referrerCoins} promo coins and your friend receives {data.referredCoins} after their first paid reading.
          Self-referrals, unpaid sittings, and refunded readings do not qualify.
        </p>
        <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Your code</p>
          <p className="mt-1 font-display text-3xl tracking-wide text-primary">{data.enabled ? data.code : "Paused"}</p>
          {link ? (
            <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copied."))}>Copy link</Button>
          ) : null}
        </section>
        <form
          className="mt-4 space-y-2 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]"
          onSubmit={(event) => {
            event.preventDefault();
            void applyReferralCode({ data: { code } })
              .then(() => toast.success("Code saved. The reward waits for your first paid reading."))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not apply"));
          }}
        >
          <p className="text-sm text-fg">Have a friend's code?</p>
          <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="CODE" aria-label="Referral code" />
          <Button type="submit" className="w-full rounded-full" disabled={!data.enabled}>Apply code</Button>
        </form>
        <ul className="mt-4 space-y-2">
          {data.referrals.map((row) => (
            <li key={row.id} className="rounded-xl bg-surface px-4 py-3 text-sm shadow-[var(--shadow-border)]">
              <span className="capitalize">{row.status}</span>
              <span className="text-faint"> · {formatWhen(row.at)}</span>
              {row.coins ? <span className="text-primary"> · +{row.coins}c</span> : null}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

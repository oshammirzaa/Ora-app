import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ManageCoinsDialog } from "@/components/admin-coin-desk";
import { EmptyNote, InfoNote, PageHeader, Panel, Stat } from "@/components/admin-shell";
import { PrivateReadingsDesk } from "@/components/admin-private-reading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCustomerActivity, adminCustomerProfile } from "@/lib/ora-admin-customer-profile-api";
import { filterCustomerActivity, type CustomerActivity, type CustomerProfile } from "@/lib/ora-admin-customer-profile";
import { adminCoinHistory } from "@/lib/ora-admin-wallet-api";
import { durationLabel } from "@/lib/ora-private-readings";
import { formatMoney, formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/admin/customer/$userId")({ component: CustomerProfilePage });

const TABS = ["Overview", "Activity", "Wallet", "Private readings"] as const;

function CustomerProfilePage() {
  const { userId } = Route.useParams();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [activity, setActivity] = useState<CustomerActivity[] | null>(null);
  const [activityError, setActivityError] = useState("");
  const [type, setType] = useState("all");
  const [advisor, setAdvisor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof adminCoinHistory>>>([]);

  async function loadProfile() {
    setError("");
    setProfile(await adminCustomerProfile({ data: { userId, t: Date.now() } }));
  }

  useEffect(() => {
    void loadProfile().catch((err) => setError(err instanceof Error ? err.message : "Could not open this customer."));
  }, [userId]);

  useEffect(() => {
    if (tab !== "Activity" || activity) return;
    void adminCustomerActivity({ data: { userId, t: Date.now() } })
      .then(setActivity)
      .catch((err) => setActivityError(err instanceof Error ? err.message : "Could not load activity."));
  }, [tab, userId, activity]);

  useEffect(() => {
    if (tab !== "Wallet") return;
    void adminCoinHistory({ data: { userId, t: Date.now() } })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [tab, userId, profile?.coins]);

  const filtered = useMemo(
    () => filterCustomerActivity(activity || [], { type: type as CustomerActivity["kind"] | "all", advisor, from, to }),
    [activity, type, advisor, from, to],
  );
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  if (error && !profile) {
    return (
      <main>
        <PageHeader icon={UserRound} title="Customer" description="This profile could not be opened." />
        <p className="text-sm text-danger">{error}</p>
        <Link to="/admin/customers" className="mt-3 inline-block text-sm text-primary">
          Back to customers
        </Link>
      </main>
    );
  }
  if (!profile) return <div className="h-40 animate-pulse rounded-2xl border border-dash-note-line bg-dash-violet" />;

  const initial = profile.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <main>
      <PageHeader icon={UserRound} title={profile.name} description="Signed-in admin view. The customer password is not used or shown." />
      <InfoNote>
        Figures come from stored account, wallet, payment, and reading rows. Referral rewards and daily reward claims are not stored, so those lists stay empty.
      </InfoNote>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button key={item} size="sm" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
            {item}
          </Button>
        ))}
        <Link to="/admin/customers" className="self-center text-sm text-primary">
          All customers
        </Link>
      </div>

      {tab === "Overview" ? (
        <div className="space-y-4">
          <Panel title="Account">
            <div className="flex flex-wrap items-center gap-4">
              {profile.image ? (
                <img src={profile.image} alt="" className="size-16 rounded-full object-cover" />
              ) : (
                <span className="grid size-16 place-items-center rounded-full bg-dash-sand font-display text-2xl text-primary">{initial}</span>
              )}
              <div>
                <h2 className="font-display text-3xl">{profile.name}</h2>
                <p className="text-xs break-all text-faint">{profile.userId}</p>
                <p className="mt-1 text-sm text-muted">{profile.email || "No email stored"}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Fact label="Registered" value={profile.createdAt ? formatWhen(profile.createdAt) : "Not recorded"} />
              <Fact label="Status" value={profile.status || "active"} />
              <Fact label="Last activity" value={profile.lastActivityAt ? formatWhen(profile.lastActivityAt) : "Not recorded"} />
              <Fact label="Coin balance" value={`${profile.coins}c`} />
              <Fact
                label="Membership"
                value={
                  profile.membershipName === "None"
                    ? "None"
                    : profile.membershipActive
                      ? profile.membershipName
                      : `${profile.membershipName} · not active`
                }
              />
              <Fact label="Membership expiry" value={profile.membershipExpiresAt ? formatWhen(profile.membershipExpiresAt) : "Not stored"} />
              <Fact label="Money spent" value={formatMoney(profile.spendCents)} />
              <Fact label="Role" value={profile.role} />
            </dl>
          </Panel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Readings" value={String(profile.readings)} hint="Stored sessions" tone="violet" />
            <Stat label="Free time" value={durationLabel(profile.freeSeconds)} hint="Included minutes used" tone="mint" />
            <Stat label="Paid time" value={durationLabel(profile.paidSeconds)} hint="Time after included minutes" tone="sand" />
            <Stat label="Coins spent" value={`${profile.coinsSpent}c`} hint="Stored on readings" icon={Coins} tone="sky" />
          </div>
        </div>
      ) : null}

      {tab === "Activity" ? (
        <div>
          {activityError ? <p className="mb-3 text-sm text-danger">{activityError}</p> : null}
          {!activity && !activityError ? <div className="h-32 animate-pulse rounded-2xl bg-dash-violet" /> : null}
          {activity ? (
            <>
              <form
                className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                }}
              >
                <select className="h-11 rounded-md border border-dash-note-line bg-surface px-3 text-sm" value={type} aria-label="Activity type" onChange={(e) => { setType(e.target.value); setPage(1); }}>
                  <option value="all">All activity</option>
                  <option value="reading">Readings</option>
                  <option value="message">Paid messages</option>
                  <option value="tip">Tips</option>
                  <option value="purchase">Coin purchases</option>
                  <option value="membership">Membership</option>
                  <option value="adjustment">Coin adjustments</option>
                  <option value="refund">Refunds</option>
                  <option value="ticket">Support</option>
                  <option value="login">Sign-ins</option>
                </select>
                <Input value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="Advisor" aria-label="Advisor" />
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              </form>
              {!visible.length ? <EmptyNote>No stored activity matches these filters.</EmptyNote> : null}
              <ul className="divide-y divide-dash-note-line rounded-2xl border border-dash-note-line bg-surface">
                {visible.map((row) => (
                  <li key={row.id} className="px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {row.label}
                        {row.advisorName ? ` · ${row.advisorName}` : ""}
                      </p>
                      <p className="text-xs text-faint">{row.at ? formatWhen(row.at) : "Time not recorded"}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {row.kind === "reading" ? `${durationLabel(row.seconds)} · free ${durationLabel(row.freeSeconds)} · paid ${durationLabel(row.paidSeconds)} · ${row.coins}c` : null}
                      {row.kind !== "reading" && row.coins ? ` ${row.coins}c` : ""}
                      {row.status ? ` · ${row.status}` : ""}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end gap-2 text-sm">
                <Button size="sm" variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                  Previous
                </Button>
                <span className="self-center text-muted">
                  {current} / {pages}
                </span>
                <Button size="sm" variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>
                  Next
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <EmptyNote>Referral rewards are not stored.</EmptyNote>
                <EmptyNote>Daily reward claims are not stored.</EmptyNote>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "Wallet" ? (
        <Panel title="Wallet">
          <p className="font-display text-3xl">{profile.coins}c</p>
          <p className="text-sm text-muted">
            Current balance{profile.promoCoins > 0 ? ` · ${profile.promoCoins}c of it is promotional` : ""}. Add and deduct use the existing audited wallet update.
          </p>
          <Button className="mt-3" onClick={() => setCoinsOpen(true)}>
            <Coins className="size-4" />
            Add or deduct coins
          </Button>
          <h3 className="mt-6 font-display text-xl">Adjustment history</h3>
          {!history.length ? <p className="mt-2 text-sm text-muted">No coin adjustments stored.</p> : null}
          <ul className="mt-2 divide-y divide-dash-note-line">
            {history.map((row) => (
              <li key={row.id} className="py-2 text-sm">
                <span className="font-medium">{row.direction === "deduct" ? "Deduct" : "Add"} {row.coins}c</span>
                <span className="mt-0.5 block text-xs text-muted">{row.reason || "No reason stored"}</span>
                <span className="mt-0.5 block text-xs text-faint">
                  {formatWhen(row.at)}
                  {row.actorId ? ` · admin ${row.actorId}` : ""}
                  {row.previous != null && row.next != null ? ` · ${row.previous} → ${row.next}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {tab === "Private readings" ? <PrivateReadingsDesk clientId={profile.userId} /> : null}

      <ManageCoinsDialog
        userId={profile.userId}
        name={profile.name}
        balance={profile.coins}
        open={coinsOpen}
        onOpenChange={setCoinsOpen}
        onChanged={loadProfile}
      />
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

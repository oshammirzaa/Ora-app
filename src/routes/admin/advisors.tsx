import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel, PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminDecide, formatWhen } from "@/lib/ora";
import { adminAdvisors, adminUpdateAdvisor } from "@/lib/ora-admin";
import { applicationBucket } from "@/lib/ora-advisor-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/advisors")({ component: AdvisorsPage });

type AdvisorRow = Awaited<ReturnType<typeof adminAdvisors>>["advisors"][number];
type AppRow = Awaited<ReturnType<typeof adminAdvisors>>["applications"][number];
type Tab = "all" | "pending" | "approved" | "rejected";

function AdvisorsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAdvisors>> | null>(null);
  const [edit, setEdit] = useState<AdvisorRow | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const next = await adminAdvisors({ data: { t: Date.now() } });
    setData(next);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load advisors."));
  }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    try {
      await adminDecide({ data: { id, decision } });
      toast.success(decision === "approved" ? "Advisor approved. They can now sign in to the desk." : "Application rejected.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  if (error && !data) {
    return (
      <main>
        <PageHeader title="Advisors" description="Review applications, then approve or reject." />
        <p className="text-sm text-danger">{error}</p>
        <Button className="mt-3" onClick={() => void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load advisors."))}>
          Retry
        </Button>
      </main>
    );
  }
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  const pending = data.applications.filter((a) => applicationBucket(a.status) === "pending");
  const approvedApps = data.applications.filter((a) => applicationBucket(a.status) === "approved");
  const rejectedApps = data.applications.filter((a) => applicationBucket(a.status) === "rejected");

  return (
    <main>
      <PageHeader
        title="Advisors"
        description="Review applications, then approve or reject. Approving creates the advisor desk. Accounts are never permanently deleted."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <TabBtn id="all" tab={tab} onClick={setTab} label={`All Advisors (${data.advisors.length})`} />
        <TabBtn id="pending" tab={tab} onClick={setTab} label={`Applications / Pending (${pending.length})`} />
        <TabBtn id="approved" tab={tab} onClick={setTab} label={`Approved (${approvedApps.length})`} />
        <TabBtn id="rejected" tab={tab} onClick={setTab} label={`Rejected (${rejectedApps.length})`} />
      </div>

      {tab === "pending" ? (
        <Panel title="Pending applications">
          <ApplicationList apps={pending} empty="No pending applications." onDecide={decide} />
        </Panel>
      ) : null}
      {tab === "approved" ? (
        <Panel title="Approved applications">
          <ApplicationList apps={approvedApps} empty="No approved applications yet." />
        </Panel>
      ) : null}
      {tab === "rejected" ? (
        <Panel title="Rejected applications">
          <ApplicationList apps={rejectedApps} empty="No rejected applications." />
        </Panel>
      ) : null}
      {tab === "all" ? (
      <Panel title="On the floor">
        <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => e.preventDefault()}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or specialty" />
        </form>
        <ul className="space-y-2">
          {data.advisors
            .filter((a) => {
              const needle = q.trim().toLowerCase();
              return (
                !needle ||
                a.name.toLowerCase().includes(needle) ||
                a.specialties.toLowerCase().includes(needle) ||
                a.status.toLowerCase().includes(needle)
              );
            })
            .map((a) => {
              const row = data.ranking?.find((r) => r.advisorId === a.id);
              return (
            <li key={a.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-3">
                  {a.photoUrl ? <img src={a.photoUrl} alt="" className="size-10 rounded-md object-cover" /> : null}
                  <span>
                    <span className="font-medium">{a.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            a.busy ? "bg-warn" : a.online ? "bg-ok" : "bg-faint",
                          )}
                        />
                        {a.busy ? "In a reading" : a.online ? "Online" : "Offline"}
                      </span>
                      <span>· {a.status}</span>
                      {a.monthlyRank ? <span>· Trusted #{a.monthlyRank}</span> : null}
                      <span>· {a.rateCoins}c/min</span>
                      {a.specialties ? <span>· {a.specialties}</span> : null}
                    </span>
                    <span className="mt-1 block text-xs text-faint">
                      Rating {a.rating.toFixed(1)} · {a.reviews} reviews · {a.sessionCount} sessions · earnings {a.earnedCoins}c
                      {row
                        ? ` · conversion ${(row.conversionRate * 100).toFixed(1)}% (${row.convertedPaidClients}/${row.eligibleFreeClients})`
                        : ""}
                    </span>
                    <span className="mt-1 block text-xs text-faint">
                      Online this month {Math.floor((a.onlineMonthSeconds || 0) / 60)}m · text {Number(a.panelReadingMinutes || 0).toFixed(1)} min · advisor 20% {a.panelAdvisorEarnings || 0}c · Ora 80% {a.panelPlatformRevenue || 0}c
                    </span>
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setEdit(edit?.id === a.id ? null : a)}>
                  {edit?.id === a.id ? "Close" : "Open profile"}
                </Button>
              </div>
              {edit?.id === a.id ? <EditAdvisor advisor={a} onSaved={() => void load().then(() => setEdit(null))} /> : null}
            </li>
              );
            })}
        </ul>
      </Panel>
      ) : null}
    </main>
  );
}

function TabBtn({
  id,
  tab,
  onClick,
  label,
}: {
  id: Tab;
  tab: Tab;
  onClick: (t: Tab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full px-4 text-sm",
        tab === id ? "bg-primary text-primary-fg" : "bg-surface text-muted shadow-[var(--shadow-border)]",
      )}
    >
      {label}
    </button>
  );
}

function ApplicationList({
  apps,
  empty,
  onDecide,
}: {
  apps: AppRow[];
  empty: string;
  onDecide?: (id: string, decision: "approved" | "rejected") => void;
}) {
  if (!apps.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {apps.map((a) => (
        <li key={a.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex gap-3">
            {a.photo_url ? <img src={a.photo_url} alt="" className="size-16 rounded-md object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {a.legal_name || a.name}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    applicationBucket(a.status) === "pending" && "bg-warn/15 text-warn",
                    applicationBucket(a.status) === "approved" && "bg-ok/15 text-ok",
                    applicationBucket(a.status) === "rejected" && "bg-danger/15 text-danger",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      applicationBucket(a.status) === "pending" && "bg-warn",
                      applicationBucket(a.status) === "approved" && "bg-ok",
                      applicationBucket(a.status) === "rejected" && "bg-danger",
                    )}
                  />
                  {a.status}
                </span>
              </p>
              <p className="text-xs text-faint">
                Submitted {formatWhen(a.created_at)}
                {a.email ? ` · ${a.email}` : ""}
                {a.phone ? ` · ${a.phone}` : ""}
                {a.country ? ` · ${a.country}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">
                Specialties: {a.specialties || "—"} · requested {a.rate_coins}c/min · {a.years} yrs
              </p>
              <p className="mt-1 text-sm text-muted">{a.experience || a.bio}</p>
              {a.availability ? <p className="mt-1 text-xs text-faint">Availability: {a.availability}</p> : null}
              {a.status === "pending" && onDecide ? (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => onDecide(a.id, "approved")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDecide(a.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EditAdvisor({ advisor, onSaved }: { advisor: AdvisorRow; onSaved: () => void }) {
  const [name, setName] = useState(advisor.name);
  const [bio, setBio] = useState(advisor.bio);
  const [specialties, setSpecialties] = useState(advisor.specialties);
  const [rate, setRate] = useState(advisor.rateCoins);
  const [status, setStatus] = useState(advisor.status);
  const [years, setYears] = useState(advisor.years);
  const [languages, setLanguages] = useState(advisor.languages);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await adminUpdateAdvisor({
        data: {
          id: advisor.id,
          name,
          bio,
          specialties,
          rateCoins: rate,
          status,
          trusted: advisor.trusted,
          years,
          languages,
        },
      });
      toast.success("Advisor saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="mt-4 space-y-3 border-t border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display name" value={name} onChange={setName} />
        <Field label="Specialties / categories" value={specialties} onChange={setSpecialties} />
        <div className="space-y-1.5">
          <Label>Coins / min</Label>
          <Input type="number" min={8} max={80} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select
            className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="live">Active (live)</option>
            <option value="paused">Deactivated (paused)</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <Field label="Languages" value={languages} onChange={setLanguages} />
        <div className="space-y-1.5">
          <Label>Years</Label>
          <Input type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Bio</Label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1200} />
      </div>
      <p className="text-xs text-faint">
        Conversion ranking is calculated monthly in Trusted Psychics and cannot be edited here.
      </p>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save psychic"}
      </Button>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel, PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readImageFile } from "@/lib/file-data";
import { adminDecide, formatWhen } from "@/lib/ora";
import { adminAdvisors, adminUpdateAdvisor } from "@/lib/ora-admin";
import { AdvisorOpsButtons, ViewAsButton } from "@/components/admin-advisor-ops";
import { matchesAdvisorQuery } from "@/lib/ora-advisor-admin-search";
import { advisorEditDefaults, type AdvisorApproval } from "@/lib/ora-admin-advisor-edit";
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
  const [savedNote, setSavedNote] = useState("");

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
        description="Review applications, then approve or reject. Edit updates the existing psychic profile. Accounts are never permanently deleted."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {savedNote ? <p className="mb-3 text-sm text-ok">{savedNote}</p> : null}

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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search advisor by name, email or Advisor ID" />
        </form>
        <ul className="space-y-2">
          {data.advisors
            .filter((a) => matchesAdvisorQuery({ name: a.name, email: a.accountEmail || "", id: a.id }, q))
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
                    <span className="mt-1 block text-xs text-muted">Registered Email: {a.accountEmail || "—"}</span>
                    <span className="mt-1 block text-xs text-faint">Advisor ID: {a.id}</span>
                    <span className="mt-1 block text-xs text-faint">
                      Rating {(Number(a.rating) || 0).toFixed(1)} · {a.reviews} reviews · {a.sessionCount} sessions · earnings {a.earnedCoins}c
                      {row
                        ? ` · conversion ${(row.conversionRate * 100).toFixed(1)}% (${row.convertedPaidClients}/${row.eligibleFreeClients})`
                        : ""}
                    </span>
                    <span className="mt-1 block text-xs text-faint">
                      Online this month {Math.floor((a.onlineMonthSeconds || 0) / 60)}m · text {Number(a.panelReadingMinutes || 0).toFixed(1)} min · advisor 20% {a.panelAdvisorEarnings || 0}c · Ora 80% {a.panelPlatformRevenue || 0}c
                    </span>
                    <span className="mt-1 block text-xs text-faint">
                      Outreach today {a.outreachToday ?? 0} sent · {a.outreachRemaining ?? 0} / 30 remaining
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <ViewAsButton advisorId={a.id} name={a.name} />
                  <Button size="sm" variant="outline" onClick={() => setEdit(a)}>
                    Edit
                  </Button>
                </span>
              </div>
            </li>
              );
            })}
        </ul>
      </Panel>
      ) : null}
      <Dialog open={Boolean(edit)} onOpenChange={(open) => { if (!open) setEdit(null); }}>
        {edit ? (
          <EditPsychicDialog
            advisor={edit}
            onCancel={() => setEdit(null)}
            onSaved={async (name) => {
              setSavedNote(`${name} saved. Refresh the customer listing to see this profile.`);
              setEdit(null);
              await load();
            }}
          />
        ) : null}
      </Dialog>
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

function EditPsychicDialog({
  advisor,
  onCancel,
  onSaved,
}: {
  advisor: AdvisorRow;
  onCancel: () => void;
  onSaved: (name: string) => Promise<void>;
}) {
  const start = advisorEditDefaults(advisor.status);
  const [name, setName] = useState(advisor.name);
  const [bio, setBio] = useState(advisor.bio);
  const [specialties, setSpecialties] = useState(advisor.specialties);
  const [rate, setRate] = useState(String(advisor.rateCoins));
  const [years, setYears] = useState(String(advisor.years));
  const [languages, setLanguages] = useState(advisor.languages || "English");
  const [photo, setPhoto] = useState(advisor.photoUrl);
  const [online, setOnline] = useState(advisor.online ? "online" : "offline");
  const [visible, setVisible] = useState(start.visible ? "active" : "inactive");
  const [featured, setFeatured] = useState(advisor.trusted ? "featured" : "standard");
  const [approval, setApproval] = useState<AdvisorApproval>(start.approval);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const canBeOnline = approval === "approved" && visible === "active";
  const canBeVisible = approval === "approved";

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await readImageFile(file));
      setFormError("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not read that photo.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function save() {
    setFormError("");
    setBusy(true);
    try {
      await adminUpdateAdvisor({
        data: {
          id: advisor.id,
          name,
          bio,
          specialties,
          years: Number(years),
          languages,
          rateCoins: Number(rate),
          online: canBeOnline && online === "online",
          visible: canBeVisible && visible === "active",
          featured: featured === "featured",
          approval,
          photoUrl: photo,
        },
      });
      toast.success("Psychic profile saved.");
      await onSaved(name.trim() || advisor.name);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save this psychic.";
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-h-[min(100%-1.5rem,44rem)] w-[min(100%-1.5rem,36rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit psychic</DialogTitle>
        <DialogDescription>
          Updates {advisor.name} on the existing profile. Earnings, payouts, and customer balances stay as they are.
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted">Registered Email: {advisor.accountEmail || "—"}</p>
      <p className="text-xs text-faint">Advisor ID: {advisor.id}</p>
      <AdvisorOpsButtons advisorId={advisor.id} name={advisor.name} />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex items-center gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-md bg-elevated">
            {photo ? (
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-xs text-faint">No photo</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="psychic-photo">Profile photo</Label>
            <Input
              id="psychic-photo"
              type="file"
              accept="image/*"
              onChange={(e) => {
                void onPhoto(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
        {photo && !photo.startsWith("data:") ? (
          <Field label="Photo URL" value={photo} onChange={setPhoto} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name" value={name} onChange={setName} maxLength={80} />
          <Field label="Specialties / categories" value={specialties} onChange={setSpecialties} maxLength={120} />
          <div className="space-y-1.5">
            <Label htmlFor="psychic-rate">Per minute rate (coins)</Label>
            <Input id="psychic-rate" type="number" min={8} max={80} value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="psychic-years">Years of experience</Label>
            <Input id="psychic-years" type="number" min={0} max={60} value={years} onChange={(e) => setYears(e.target.value)} />
          </div>
          <Field label="Languages" value={languages} onChange={setLanguages} maxLength={80} />
          <SelectField
            id="psychic-online"
            label="Online status"
            value={canBeOnline ? online : "offline"}
            disabled={!canBeOnline}
            onChange={setOnline}
            options={[
              ["online", "Online"],
              ["offline", "Offline"],
            ]}
          />
          <SelectField
            id="psychic-visibility"
            label="Profile visibility"
            value={canBeVisible ? visible : "inactive"}
            disabled={!canBeVisible}
            onChange={setVisible}
            options={[
              ["active", "Active"],
              ["inactive", "Inactive"],
            ]}
          />
          <SelectField
            id="psychic-featured"
            label="Featured status"
            value={featured}
            onChange={setFeatured}
            options={[
              ["featured", "Featured"],
              ["standard", "Not featured"],
            ]}
          />
          <SelectField
            id="psychic-approval"
            label="Approval status"
            value={approval}
            onChange={(value) => setApproval(value as AdvisorApproval)}
            options={[
              ["approved", "Approved"],
              ["suspended", "Suspended"],
              ["pending", "Pending"],
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="psychic-bio">Short bio / about me</Label>
          <Textarea id="psychic-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1200} rows={5} />
        </div>
        <p className="text-xs text-faint">
          Active, approved psychics appear on the customer listing. Featured shows the trusted badge. Recommended Psychics is ranked from genuine reviews, so there is no separate recommended switch. Monthly Trusted rank is calculated and is not edited here. The 20% advisor / 80% Ora split is unchanged.
        </p>
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        disabled={disabled}
        className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

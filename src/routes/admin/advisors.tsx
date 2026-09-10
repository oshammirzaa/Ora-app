import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel, PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminDecide, type Advisor } from "@/lib/ora";
import { adminAdvisors, adminUpdateAdvisor } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/advisors")({ component: AdvisorsPage });

function AdvisorsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAdvisors>> | null>(null);
  const [edit, setEdit] = useState<Advisor | null>(null);

  async function load() {
    setData(await adminAdvisors({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setData(null));
  }, []);

  async function decide(id: string, decision: "approved" | "declined") {
    try {
      await adminDecide({ data: { id, decision } });
      toast.success(decision === "approved" ? "Advisor is live." : "Declined.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <PageHeader
        title="Advisors"
        description="Applications, profiles, categories (specialties), and per-minute rates."
      />

      <Panel title="Applications">
        {!data.applications.length ? (
          <p className="text-sm text-muted">None waiting.</p>
        ) : (
          <ul className="space-y-3">
            {data.applications.map((a) => (
              <li key={a.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex gap-3">
                  {a.photo_url ? <img src={a.photo_url} alt="" className="size-16 rounded-md object-cover" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {a.name} · {a.status} · {a.rate_coins}c/min
                    </p>
                    <p className="text-xs text-faint">
                      {a.legal_name} · {a.languages} · {a.years} yrs · {a.specialties}
                    </p>
                    <p className="mt-1 text-sm text-muted">{a.bio}</p>
                    {a.status === "pending" ? (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => void decide(a.id, "approved")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void decide(a.id, "declined")}>
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="On the floor">
        <ul className="space-y-2">
          {data.advisors.map((a) => (
            <li key={a.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-3">
                  {a.photoUrl ? <img src={a.photoUrl} alt="" className="size-10 rounded-md object-cover" /> : null}
                  <span>
                    <span className="font-medium">{a.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {a.status}
                      {a.online ? " · Live" : ""}
                      {a.busy ? " · Busy" : ""}
                      {a.trusted ? " · Trusted" : ""} · {a.rateCoins}c/min · {a.specialties}
                    </span>
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setEdit(edit?.id === a.id ? null : a)}>
                  {edit?.id === a.id ? "Close" : "Edit"}
                </Button>
              </div>
              {edit?.id === a.id ? <EditAdvisor advisor={a} onSaved={() => void load().then(() => setEdit(null))} /> : null}
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}

function EditAdvisor({ advisor, onSaved }: { advisor: Advisor; onSaved: () => void }) {
  const [name, setName] = useState(advisor.name);
  const [bio, setBio] = useState(advisor.bio);
  const [specialties, setSpecialties] = useState(advisor.specialties);
  const [rate, setRate] = useState(advisor.rateCoins);
  const [status, setStatus] = useState(advisor.status);
  const [trusted, setTrusted] = useState(advisor.trusted);
  const [years, setYears] = useState(advisor.years);
  const [languages, setLanguages] = useState(advisor.languages);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await adminUpdateAdvisor({
        data: { id: advisor.id, name, bio, specialties, rateCoins: rate, status, trusted, years, languages },
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
            <option value="live">Live</option>
            <option value="paused">Paused</option>
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} />
        Top trusted
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save advisor"}
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

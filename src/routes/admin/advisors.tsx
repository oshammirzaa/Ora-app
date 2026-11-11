import { createFileRoute } from "@tanstack/react-router";
import { Award, Radio, Sparkles, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdvisorPayDialog } from "@/components/admin-advisor-pay";
import { InfoNote, PageHeader, Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readImageFile } from "@/lib/file-data";
import { adminAdvisors, adminUpdateAdvisor } from "@/lib/ora-admin";
import { AdvisorOpsButtons, ViewAsButton } from "@/components/admin-advisor-ops";
import { matchesAdvisorQuery } from "@/lib/ora-advisor-admin-search";
import { advisorEditDefaults, type AdvisorApproval } from "@/lib/ora-admin-advisor-edit";
import { READING_LISTINGS } from "@/lib/ora-reading-listings";
import { PSYCHIC_CATEGORIES } from "@/lib/ora-psychic-categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/advisors")({ component: AdvisorsPage });

type AdvisorRow = Awaited<ReturnType<typeof adminAdvisors>>["advisors"][number];

function AdvisorsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAdvisors>> | null>(null);
  const [edit, setEdit] = useState<AdvisorRow | null>(null);
  const [pay, setPay] = useState<AdvisorRow | null>(null);
  const [q, setQ] = useState("");
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

  if (error && !data) {
    return (
      <main>
        <PageHeader icon={Users} title="All Advisors" description="Advisor accounts on the floor." />
        <p className="text-sm text-danger">{error}</p>
        <Button className="mt-3" onClick={() => void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load advisors."))}>
          Retry
        </Button>
      </main>
    );
  }

  const advisors = data?.advisors ?? [];
  const filtered = advisors.filter((a) => matchesAdvisorQuery(a, q));

  return (
    <main>
      <PageHeader icon={Users} title="All Advisors" description="Advisor accounts on the floor." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Advisors" value={String(advisors.length)} />
        <Stat icon={Radio} label="Online" value={String(advisors.filter((a) => a.status === "online").length)} />
        <Stat icon={Wallet} label="Wallet" value={String(advisors.reduce((s, a) => s + (a.balance ?? 0), 0))} />
      </div>
      <div className="mb-3 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, specialty..." className="max-w-sm" />
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {savedNote ? <p className="mb-2 text-sm text-success">{savedNote}</p> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Rate</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2">{a.status}</td>
                <td className="px-3 py-2">{a.rate}</td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => setEdit(a)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {edit?.name}</DialogTitle>
            <DialogDescription>Update profile, rates, and categories.</DialogDescription>
          </DialogHeader>
          {edit ? <AdvisorEditForm advisor={edit} onClose={() => setEdit(null)} onSaved={() => { setSavedNote("Saved"); void load(); }} /> : null}
        </DialogContent>
      </Dialog>

      {pay ? <AdvisorPayDialog advisor={pay} onClose={() => setPay(null)} /> : null}
    </main>
  );
}

function AdvisorEditForm({ advisor, onClose, onSaved }: { advisor: AdvisorRow; onClose: () => void; onSaved: () => void }) {
  const defaults = advisorEditDefaults(advisor);
  const [name, setName] = useState(defaults.name);
  const [bio, setBio] = useState(defaults.bio);
  const [rate, setRate] = useState(String(defaults.rate ?? ""));
  const [specialties, setSpecialties] = useState(defaults.specialties);
  const [approval, setApproval] = useState<AdvisorApproval>(defaults.approval);
  const [listingCats, setListingCats] = useState(defaults.listingCategories || []);
  const [psychicCats, setPsychicCats] = useState<string[]>(advisor.psychicCategories || []);
  const [busy, setBusy] = useState(false);

  function togglePsychic(id: string) {
    setPsychicCats((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function save() {
    setBusy(true);
    try {
      await adminUpdateAdvisor({
        data: {
          id: advisor.id,
          name,
          bio,
          rate: Number(rate) || 0,
          specialties,
          approval,
          listingCategories: listingCats,
          psychicCategories: psychicCats,
        },
      });
      toast.success("Advisor updated");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Bio</Label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
      </div>
      <div>
        <Label>Rate (coins/min)</Label>
        <Input value={rate} onChange={(e) => setRate(e.target.value)} />
      </div>
      <div>
        <Label>Specialties</Label>
        <Input value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">Psychic Categories</p>
        <p className="text-xs text-muted-fg">Assign one or more. Online advisors appear first in each section.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PSYCHIC_CATEGORIES.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={psychicCats.includes(cat.id)}
                onChange={() => togglePsychic(cat.id)}
              />
              <span style={{ color: cat.color }}>{cat.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

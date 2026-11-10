import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApplicationList } from "@/components/admin-applications";
import { InfoNote, PageHeader, Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminDecide } from "@/lib/ora";
import { adminAdvisors } from "@/lib/ora-admin";
import { applicationBucket } from "@/lib/ora-advisor-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/applications")({ component: ApplicationsPage });

type Tab = "pending" | "approved" | "rejected";

function ApplicationsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAdvisors>> | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setData(await adminAdvisors({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load applications."));
  }, []);

  const apps = useMemo(() => {
    const rows = data?.applications ?? [];
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (applicationBucket(row.status) !== tab) return false;
      if (!needle) return true;
      const blob = `${row.name} ${row.legal_name || ""} ${row.email || ""} ${row.phone || ""} ${row.specialties || ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [data, q, tab]);

  async function decide(id: string, decision: "approved" | "rejected", reason: string) {
    try {
      const result = await adminDecide({ data: { id, decision, reason } });
      toast.success(
        decision === "approved"
          ? result.live
            ? "Advisor approved. They can now sign in to the desk."
            : "Application approved. The profile stays private until government ID is verified."
          : "Application rejected.",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  if (error && !data) {
    return (
      <main>
        <PageHeader icon={ClipboardList} title="Advisor Applications" description="Pending, approved, and rejected applications." />
        <p className="text-sm text-danger">{error}</p>
        <Button className="mt-3" onClick={() => void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load applications."))}>
          Retry
        </Button>
      </main>
    );
  }
  if (!data) return <div className="h-40 animate-pulse rounded-2xl border border-dash-note-line bg-dash-violet" />;

  const counts = {
    pending: data.applications.filter((row) => applicationBucket(row.status) === "pending").length,
    approved: data.applications.filter((row) => applicationBucket(row.status) === "approved").length,
    rejected: data.applications.filter((row) => applicationBucket(row.status) === "rejected").length,
  };

  return (
    <main>
      <PageHeader
        icon={ClipboardList}
        title="Advisor Applications"
        description="Review profile, experience, and government ID, then approve or reject. Advisor accounts stay in All Advisors."
      />
      <InfoNote>
        ID photos open only for a signed-in owner. Approval still uses the existing live-or-hold rules. Nothing here deletes an application.
      </InfoNote>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Pending" value={String(counts.pending)} tone="warn" />
        <Stat label="Approved" value={String(counts.approved)} tone="mint" />
        <Stat label="Rejected" value={String(counts.rejected)} tone="rose" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm capitalize",
              tab === id ? "bg-dash-violet font-semibold text-primary" : "border border-dash-note-line bg-surface text-muted",
            )}
          >
            {id} ({counts[id]})
          </button>
        ))}
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, or specialty" />
      {data.applications.length >= 80 ? (
        <p className="mt-2 text-xs text-faint">Showing the latest 80 applications. Older rows stay in the database.</p>
      ) : null}
      <div className="mt-4">
        <ApplicationList
          apps={apps}
          empty={q ? "No applications match this search." : `No ${tab} applications.`}
          onDecide={tab === "pending" ? decide : undefined}
          onReload={load}
        />
      </div>
    </main>
  );
}

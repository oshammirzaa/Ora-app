import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyNote, PageHeader, Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen } from "@/lib/ora";
import { adminSafetyReports, adminSetSafetyReportStatus } from "@/lib/ora-admin";
import {
  SAFETY_REPORT_STATUSES,
  safetyReportReasonLabel,
  safetyReportStatusLabel,
  type SafetyReportStatus,
} from "@/lib/ora-safety";

export const Route = createFileRoute("/admin/safety")({ component: SafetyReportsPage });

const FILTERS: Array<{ id: "all" | SafetyReportStatus; label: string }> = [
  { id: "open", label: "Open" },
  { id: "reviewing", label: "Reviewing" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

function SafetyReportsPage() {
  const [status, setStatus] = useState<"all" | SafetyReportStatus>("open");
  const [data, setData] = useState<Awaited<ReturnType<typeof adminSafetyReports>> | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState("");

  async function load(nextStatus = status) {
    const next = await adminSafetyReports({ data: { status: nextStatus, t: Date.now() } });
    setData(next);
    setNotes((cur) => {
      const merged = { ...cur };
      for (const row of next.rows) {
        if (merged[row.id] == null) merged[row.id] = row.adminNote;
      }
      return merged;
    });
  }

  useEffect(() => {
    void load("open").catch(() =>
      setData({ rows: [], counts: { open: 0, reviewing: 0, resolved: 0 } }),
    );
  }, []);

  async function setReportStatus(id: string, next: SafetyReportStatus) {
    if (working) return;
    setWorking(id);
    try {
      await adminSetSafetyReportStatus({ data: { id, status: next, note: notes[id] || "" } });
      toast.success(`${safetyReportStatusLabel(next)}.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update report");
    } finally {
      setWorking("");
    }
  }

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? { open: 0, reviewing: 0, resolved: 0 };

  return (
    <main>
      <PageHeader
        title="Safety reports"
        description="Block and report escalation. Open, reviewing, and resolved cases with chat and session context. Reporter notes and admin notes stay private — the reported person never sees them."
      />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Open" value={String(counts.open)} tone="warn" />
        <Stat label="Reviewing" value={String(counts.reviewing)} tone="gold" />
        <Stat label="Resolved" value={String(counts.resolved)} tone="ok" />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={status === s.id ? "default" : "outline"}
            onClick={() => {
              setStatus(s.id);
              void load(s.id).catch(() => {});
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <ul className="mt-6 space-y-3">
        {!rows.length ? (
          <li>
            <EmptyNote>No reports in this view.</EmptyNote>
          </li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {safetyReportReasonLabel(r.reason)}
                    <span className="ml-2 text-xs font-normal text-primary">{safetyReportStatusLabel(r.status)}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {r.reporterRole === "customer" ? r.customerName : r.advisorName} reported{" "}
                    {r.reporterRole === "customer" ? r.advisorName : r.customerName}
                    <span className="text-faint"> · {r.reporterRole === "customer" ? "customer" : "advisor"}</span>
                  </p>
                </div>
                <span className="text-xs text-faint">{formatWhen(r.createdAt)}</span>
              </div>
              {r.body ? <p className="mt-3 text-sm text-fg">{r.body}</p> : <p className="mt-3 text-sm text-faint">No description.</p>}
              <p className="mt-2 text-xs text-muted">
                {r.readingId ? (
                  <>
                    Session{" "}
                    <Link to="/admin/sessions" className="text-primary" preload={false}>
                      {r.readingId}
                    </Link>
                  </>
                ) : (
                  "No session linked"
                )}
                {r.lastSessionAt ? ` · last sitting ${formatWhen(r.lastSessionAt)}${r.lastSessionStatus ? ` · ${r.lastSessionStatus}` : ""}` : ""}
              </p>
              <p className="mt-3 text-[11px] tracking-wide text-faint uppercase">Admin note</p>
              <Textarea
                className="mt-1 min-h-20"
                value={notes[r.id] ?? r.adminNote}
                onChange={(e) => setNotes((cur) => ({ ...cur, [r.id]: e.target.value }))}
                placeholder="Private follow-up. Never shown to advisors or customers."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {SAFETY_REPORT_STATUSES.filter((s) => s.id !== r.status).map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant={s.id === "resolved" ? "default" : "outline"}
                    disabled={working === r.id}
                    onClick={() => void setReportStatus(r.id, s.id)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

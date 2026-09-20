import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, EmptyNote } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWhen } from "@/lib/ora";
import { adminAdvisorReports, adminResolveAdvisorReport } from "@/lib/ora-admin";
import { adminTickets, SUPPORT_STATUSES, statusLabel } from "@/lib/ora-support";
import { advisorReportReasonLabel } from "@/lib/ora-advisor-desk-stats";

export const Route = createFileRoute("/admin/support/")({ component: AdminSupportPage });

function AdminSupportPage() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof adminTickets>> | null>(null);
  const [reports, setReports] = useState<Awaited<ReturnType<typeof adminAdvisorReports>>>([]);
  const [resolving, setResolving] = useState("");

  async function load(nextStatus = status, query = q) {
    setData(await adminTickets({ data: { status: nextStatus, q: query, t: Date.now() } }));
  }

  async function loadReports() {
    setReports(await adminAdvisorReports({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load("all", "").catch(() => setData({ open: 0, unread: 0, tickets: [] }));
    void loadReports().catch(() => setReports([]));
  }, []);

  async function resolve(id: string) {
    if (resolving) return;
    setResolving(id);
    try {
      await adminResolveAdvisorReport({ data: { id } });
      toast.success("Report resolved.");
      await loadReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resolve");
    } finally {
      setResolving("");
    }
  }

  const rows = data?.tickets ?? [];

  return (
    <main>
      <PageHeader
        title="Customer Support"
        description="Private tickets from customers. Advisors cannot see this desk."
      />
      <p className="text-sm text-muted">
        {data ? `${data.unread} unread · ${data.open} open or in progress` : "Loading…"}
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ticket no, name, or email" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }, ...SUPPORT_STATUSES].map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={status === s.id ? "default" : "outline"}
            onClick={() => {
              setStatus(s.id);
              void load(s.id);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <ul className="mt-6 space-y-2">
        {!rows.length ? (
          <li>
            <EmptyNote>No tickets in this view.</EmptyNote>
          </li>
        ) : (
          rows.map((t) => (
            <li key={t.id}>
              <Link
                to="/admin/support/$id"
                params={{ id: t.id }}
                className="block rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium tabular-nums">
                      {t.ticketNo}
                      {t.adminUnread ? (
                        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-fg">New</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {t.clientName || "Customer"}
                      {t.clientEmail ? ` · ${t.clientEmail}` : ""} · {t.reasonLabel}
                      {t.advisorName ? ` · ${t.advisorName}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-primary">{statusLabel(t.status)}</span>
                </div>
                <p className="mt-1 text-xs text-faint">{formatWhen(t.lastMessageAt)}</p>
              </Link>
            </li>
          ))
        )}
      </ul>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Advisor reports</h2>
        <p className="mt-1 text-sm text-muted">Internal reports and escalations. Customers never see these.</p>
        <ul className="mt-4 space-y-2">
          {!reports.length ? (
            <li>
              <EmptyNote>No advisor reports yet.</EmptyNote>
            </li>
          ) : (
            reports.map((r) => (
              <li key={r.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium capitalize">
                      {r.kind} · {advisorReportReasonLabel(r.reason)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {r.advisorName} · {r.customerName}
                    </p>
                    <p className="mt-2 text-sm">{r.body}</p>
                    <p className="mt-1 text-xs text-faint">{formatWhen(r.createdAt)}</p>
                  </div>
                  {r.status === "open" ? (
                    <Button size="sm" variant="outline" disabled={resolving === r.id} onClick={() => void resolve(r.id)}>
                      Resolve
                    </Button>
                  ) : (
                    <span className="text-xs text-ok">Resolved</span>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

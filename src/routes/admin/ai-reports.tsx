import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWhen } from "@/lib/ora";
import { adminAiReportAction, adminAiReports, adminAiReportThread } from "@/lib/ora-compliance-api";
import { COMPLIANCE_CATEGORIES, complianceCategoryLabel } from "@/lib/ora-compliance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/ai-reports")({ component: AiReportInboxPage });

const STATUSES = [
  { id: "new", label: "New" },
  { id: "reviewing", label: "Under Review" },
  { id: "resolved", label: "Resolved" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
] as const;

function AiReportInboxPage() {
  const [status, setStatus] = useState("new");
  const [category, setCategory] = useState("all");
  const [risk, setRisk] = useState("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAiReports>> | null>(null);
  const [openId, setOpenId] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; role: string; body: string; at: string }>>([]);
  const [working, setWorking] = useState("");

  async function load() {
    const next = await adminAiReports({ data: { status, category, risk, query, from, to } });
    setData(next);
  }

  useEffect(() => {
    void load().catch(() => setData({ counts: { new: 0, reviewing: 0, resolved: 0, dismissed: 0 }, rows: [] }));
    // Search text and dates apply when the admin submits the filter form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, risk]);

  useEffect(() => {
    const openFromHash = () => {
      const id = window.location.hash.replace(/^#/, "").slice(0, 80);
      if (!id) return;
      setOpenId(id);
      void adminAiReportThread({ data: { id } })
        .then((next) => setMessages(next.messages))
        .catch(() => {});
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  async function act(id: string, action: string) {
    setWorking(id + action);
    try {
      await adminAiReportAction({ data: { id, action } });
      toast.success("Saved.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the report");
    } finally {
      setWorking("");
    }
  }

  async function openThread(id: string) {
    setOpenId(id);
    try {
      const next = await adminAiReportThread({ data: { id } });
      setMessages(next.messages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the conversation");
    }
  }

  const counts = data?.counts ?? { new: 0, reviewing: 0, resolved: 0, dismissed: 0 };

  return (
    <main>
      <PageHeader
        title="AI Report Inbox"
        description="AI-detected compliance reports. High-confidence messages can be blocked. Advisors are not suspended automatically."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((item) => (
          <Button key={item.id} size="sm" variant={status === item.id ? "default" : "outline"} onClick={() => setStatus(item.id)}>
            {item.label}
            {item.id !== "all" ? ` (${counts[item.id]})` : ""}
          </Button>
        ))}
      </div>
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Advisor name, email, or customer" />
        <select className="h-10 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {COMPLIANCE_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <select className="h-10 rounded-md bg-surface px-3 text-sm shadow-[var(--shadow-border)]" value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="all">All risk</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <ul className="space-y-3">
        {(data?.rows || []).map((row) => (
          <li
            key={row.id}
            className={cn(
              "rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]",
              row.risk === "high" && row.status === "new" && "ring-1 ring-warn",
              openId === row.id && "ring-1 ring-primary",
            )}
          >
            <p className="font-medium">
              {row.advisorName} · {row.customerName}
            </p>
            <p className="mt-1 text-xs text-muted">
              {row.sender === "advisor" ? "Advisor sent it" : "Customer sent it"} · {complianceCategoryLabel(row.category)} · {row.risk.toUpperCase()} · {formatWhen(row.at)}
            </p>
            <p className="mt-1 text-xs text-faint">{row.advisorEmail || "No advisor email"} · {row.customerId}</p>
            {row.context.map((line) => (
              <p key={line} className="mt-2 text-xs text-faint">Context: {line}</p>
            ))}
            <p className="mt-2 whitespace-pre-wrap text-sm">{row.excerpt}</p>
            {row.linkId ? <p className="mt-1 text-xs text-faint">Linked to an earlier report in this conversation.</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void openThread(row.id)}>Open conversation</Button>
              <Button size="sm" variant="outline" disabled={Boolean(working)} onClick={() => void act(row.id, "reviewing")}>Mark Under Review</Button>
              <Button size="sm" variant="outline" disabled={Boolean(working)} onClick={() => void act(row.id, "warning")}>Issue Warning</Button>
              <Button size="sm" variant="outline" disabled={Boolean(working)} onClick={() => void act(row.id, "dismiss")}>Dismiss</Button>
              <Button size="sm" variant="outline" disabled={Boolean(working)} onClick={() => void act(row.id, "resolve")}>Resolve</Button>
              {row.advisorStatus === "suspended" ? (
                <Button size="sm" variant="outline" disabled={Boolean(working)} onClick={() => void act(row.id, "unsuspend")}>Unsuspend Advisor</Button>
              ) : (
                <Button size="sm" variant="outline" disabled={Boolean(working)} onClick={() => void act(row.id, "suspend")}>Suspend Advisor</Button>
              )}
            </div>
            {openId === row.id ? (
              <ul className="mt-3 space-y-2">
                {messages.map((message) => (
                  <li key={message.id} className="rounded-xl bg-elevated p-2 text-sm">
                    <span className="text-xs text-faint">{message.role === "advisor" ? "Advisor" : "Client"} · {formatWhen(message.at)}</span>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </li>
                ))}
                {!messages.length ? <li className="text-sm text-muted">No saved messages in this conversation.</li> : null}
              </ul>
            ) : null}
          </li>
        ))}
        {data && !data.rows.length ? <li className="text-sm text-muted">No reports in this view.</li> : null}
      </ul>
    </main>
  );
}

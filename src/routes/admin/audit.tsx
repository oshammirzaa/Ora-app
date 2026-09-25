import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/ora";
import { adminAudit } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

const ACTION: Record<string, string> = {
  claim_owner: "Claimed owner",
  save_settings: "Saved settings",
  add_category: "Added category",
  edit_category: "Edited category",
  delete_category: "Removed category",
  reorder_category: "Reordered category",
  edit_advisor: "Edited advisor",
  approve_advisor: "Approved advisor",
  decline_advisor: "Declined advisor",
  set_advisor_status: "Set advisor status",
  suspend_user: "Suspended account",
  reactivate_user: "Reactivated account",
  set_role: "Changed role",
  end_session: "Forced session end",
  refund: "Refund",
  adjustment: "Wallet adjustment",
  adjust_minutes: "Included minutes adjustment",
  gift: "Gifted coins",
  refund_payment: "Refunded payment",
  gift_coins: "Gifted coins",
  payout_paid: "Approved payout",
  advisor_earnings_paid: "Recorded advisor earnings payment",
  rank_advisors: "Changed advisor ranking",
  payout_processing: "Payout processing",
  payout_rejected: "Rejected payout",
  save_promo: "Saved offer",
  grant_promo: "Granted offer",
  hide_review: "Hid review",
  show_review: "Restored review",
  review_add: "Added advisor review",
  review_edit: "Edited advisor review",
  review_delete: "Deleted advisor review",
  view_as_start: "Started viewing as advisor",
  view_as_end: "Stopped viewing as advisor",
  ai_report_reviewing: "Marked AI report under review",
  ai_report_warning: "Issued AI report warning",
  ai_report_dismiss: "Dismissed AI report",
  ai_report_resolve: "Resolved AI report",
  ai_report_suspend: "Suspended advisor from AI report",
  ai_report_unsuspend: "Unsuspended advisor from AI report",
  safety_report_open: "Reopened safety report",
  safety_report_reviewing: "Marked safety report reviewing",
  safety_report_resolved: "Resolved safety report",
  resolve_advisor_report: "Resolved advisor report",
};

function AuditPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAudit>> | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    void adminAudit({ data: { t: Date.now() } })
      .then((r) => {
        setData(r);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Audit log"
          description="Owner actions: approvals, payouts, wallet and included-minute edits, settings, reviews."
        />
        <Button size="sm" variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>
      {err ? <p className="mt-4 text-sm text-danger">{err}</p> : null}
      <p className="mt-2 text-xs text-faint">{data ? `${data.total} recorded` : "Loading…"}</p>
      <ul className="mt-6 ora-rows">
        {!rows.length ? (
          <li className="px-4 py-6 text-center text-sm text-muted">No owner actions recorded yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <p>
                {r.actor} · {ACTION[r.action] || r.action.replace(/_/g, " ")}
                {r.detail ? ` · ${r.detail}` : ""}
              </p>
              <p className="text-xs text-faint">
                {r.targetType} {r.targetId} · {formatWhen(r.createdAt)}
              </p>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

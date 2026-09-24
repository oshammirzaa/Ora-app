import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Stat, EmptyNote } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/ora";
import {
  adminAdvisorPayoutDetail,
  adminDecidePayout,
  adminMarkAvailablePaid,
  adminMarkPayoutProcessing,
  adminPayoutBoard,
} from "@/lib/ora-admin";
import { type EarningHistoryRow } from "@/lib/ora-admin-payouts";
import { filterAdvisorEarnings, type AdvisorListFilter, type AdvisorListSort } from "@/lib/ora-admin-payouts";
import { formatPaidMinuteValue } from "@/lib/ora-advisor-desk-stats";
import { formatCoinUnitsFromCents, formatUsdFromCents } from "@/lib/ora-paid-messages";

export const Route = createFileRoute("/admin/payouts")({ component: PayoutsPage });

type Board = Awaited<ReturnType<typeof adminPayoutBoard>>;
type AdvisorRow = Board["advisors"][number];
type Detail = Awaited<ReturnType<typeof adminAdvisorPayoutDetail>>;

function money(cents: number) {
  const negative = cents < 0;
  const abs = Math.abs(Math.floor(cents) || 0);
  const text = `${formatCoinUnitsFromCents(abs)} · ${formatUsdFromCents(abs)}`;
  return negative ? `-${text}` : text;
}

function usd(cents: number) {
  const negative = cents < 0;
  const text = formatUsdFromCents(Math.abs(Math.floor(cents) || 0));
  return negative ? `-${text}` : text;
}

function statusClass(status: string) {
  if (status === "paid") return "text-ok";
  if (status === "processing") return "text-primary";
  if (status === "pending") return "text-warn";
  if (status === "refunded" || status === "rejected" || status === "failed") return "text-danger";
  return "text-muted";
}

function statusLabel(status: string) {
  if (!status || status === "none") return "—";
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

function PayoutsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [busy, setBusy] = useState("");
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdvisorListFilter>("all");
  const [sort, setSort] = useState<AdvisorListSort>("pending");

  async function load() {
    const next = await adminPayoutBoard({ data: { t: Date.now() } });
    setBoard(next);
    return next;
  }

  async function loadDetail(advisorId: string) {
    const next = await adminAdvisorPayoutDetail({ data: { advisorId, t: Date.now() } });
    setDetail(next);
  }

  useEffect(() => {
    void load().catch(() => setBoard(null));
  }, []);

  async function run(key: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await work();
      await load();
      if (openId) await loadDetail(openId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update payout");
    } finally {
      setBusy("");
    }
  }

  const summary = board?.summary;
  const advisors = filterAdvisorEarnings(board?.advisors ?? [], { query, filter, sort });
  const requests = advisors.flatMap((advisor) =>
    advisor.requests.map((request) => ({ ...request, name: advisor.name, advisorId: advisor.id })),
  );

  return (
    <main>
      <PageHeader
        title="Payouts"
        description="Each advisor’s stored share, what has been paid, and what is still pending. Payouts are not revenue."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!board ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-elevated" />
          ))
        ) : (
          <>
            <Stat
              label="Total advisor earnings"
              value={usd(summary?.earnedCents ?? 0)}
              hint={money(summary?.earnedCents ?? 0)}
              tone="gold"
            />
            <Stat
              label="Total paid out"
              value={usd(summary?.paidOutCents ?? 0)}
              hint="Completed payouts only"
              tone="ok"
            />
            <Stat
              label="Total pending payouts"
              value={usd(summary?.pendingBalanceCents ?? 0)}
              hint="Earned minus paid"
              tone="warn"
            />
            <Stat
              label="Advisors pending"
              value={String(summary?.advisorsWithPending ?? 0)}
              hint="Pending balance above zero"
              tone="primary"
            />
          </>
        )}
      </div>

      <h2 className="mt-8 font-display text-xl">Advisors</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5 text-sm sm:col-span-2">
          <span className="text-muted">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, or id"
            className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted">Filter</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as AdvisorListFilter)}
            className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          >
            <option value="all">All advisors</option>
            <option value="pending">Pending payout</option>
            <option value="paid">Paid</option>
            <option value="none">No balance</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-muted">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as AdvisorListSort)}
            className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          >
            <option value="pending">Highest pending balance</option>
            <option value="lifetime">Highest lifetime earnings</option>
            <option value="recent">Most recent payout</option>
            <option value="name">Advisor name</option>
          </select>
        </label>
      </div>
      {!board ? (
        <div className="mt-3 h-40 animate-pulse rounded-2xl bg-elevated" />
      ) : !advisors.length ? (
        <EmptyNote>No advisors in this view.</EmptyNote>
      ) : (
        <ul className="mt-3 space-y-2">
          {advisors.map((advisor) => (
            <AdvisorCard
              key={advisor.id}
              advisor={advisor}
              open={openId === advisor.id}
              detail={openId === advisor.id ? detail : null}
              busy={busy}
              onToggle={() => {
                if (openId === advisor.id) {
                  setOpenId("");
                  setDetail(null);
                  return;
                }
                setOpenId(advisor.id);
                setDetail(null);
                void loadDetail(advisor.id).catch(() => setDetail(null));
              }}
              onPayAvailable={() =>
                void run(`avail:${advisor.id}`, async () => {
                  const result = await adminMarkAvailablePaid({ data: { advisorId: advisor.id } });
                  toast.success(`Marked paid · ${result.id} · ${result.coins}c`);
                })
              }
              onProcessing={(id) =>
                void run(`proc:${id}`, async () => {
                  await adminMarkPayoutProcessing({ data: { id } });
                  toast.success("Marked processing.");
                })
              }
              onPaid={(id) =>
                void run(`paid:${id}`, async () => {
                  await adminDecidePayout({ data: { id, accept: true, note: "Marked paid" } });
                  toast.success(`Marked paid · ${id}`);
                })
              }
              onReject={(id) =>
                void run(`no:${id}`, async () => {
                  await adminDecidePayout({ data: { id, accept: false, note: "Rejected" } });
                  toast.success("Rejected. Coins returned.");
                })
              }
            />
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-display text-xl">Requested</h2>
      {!requests.length ? (
        <EmptyNote>None waiting.</EmptyNote>
      ) : (
        <ul className="mt-3 space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="font-medium">
                {request.name} · {request.coins}c · ${(request.coins / 10).toFixed(2)}
              </p>
              <p className="text-xs text-faint">
                {request.id} · {formatWhen(request.createdAt)} · {statusLabel(request.label)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {request.label !== "processing" ? (
                  <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void run(`proc:${request.id}`, async () => {
                    await adminMarkPayoutProcessing({ data: { id: request.id } });
                    toast.success("Marked processing.");
                  })}>
                    Mark processing
                  </Button>
                ) : null}
                <Button size="sm" disabled={Boolean(busy)} onClick={() => void run(`paid:${request.id}`, async () => {
                  await adminDecidePayout({ data: { id: request.id, accept: true, note: "Marked paid" } });
                  toast.success(`Marked paid · ${request.id}`);
                })}>
                  {busy === `paid:${request.id}` ? "Saving…" : "Mark as paid"}
                </Button>
                <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void run(`no:${request.id}`, async () => {
                  await adminDecidePayout({ data: { id: request.id, accept: false, note: "Rejected" } });
                  toast.success("Rejected. Coins returned.");
                })}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function AdvisorCard({
  advisor,
  open,
  detail,
  busy,
  onToggle,
  onPayAvailable,
  onProcessing,
  onPaid,
  onReject,
}: {
  advisor: AdvisorRow;
  open: boolean;
  detail: Detail | null;
  busy: string;
  onToggle: () => void;
  onPayAvailable: () => void;
  onProcessing: (id: string) => void;
  onPaid: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <li className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        {advisor.photoUrl ? (
          <img src={advisor.photoUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-blush text-sm font-medium text-primary">
            {(advisor.name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium">{advisor.name}</p>
            <p className={`text-sm ${statusClass(advisor.balanceStatus)}`}>{statusLabel(advisor.balanceStatus)}</p>
          </div>
          <p className="mt-0.5 break-all text-xs text-faint">
            {advisor.email || "No email on file"} · {advisor.id}
          </p>
          <p className="mt-0.5 text-xs text-muted">Status {advisor.status}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
        <Field label="Paid reading minutes" value={formatPaidMinuteValue(advisor.paidMinutes)} />
        <Field label="Live readings" value={money(advisor.readingCents)} />
        <Field label="Paid messages" value={money(advisor.messageCents)} />
        <Field label="Tips & gifts" value={money(advisor.tipCents)} />
        <Field label="Lifetime earnings" value={money(advisor.lifetimeCents)} />
        <Field label="Already paid out" value={money(advisor.paidCents)} />
        <Field label="Pending payout" value={money(advisor.pendingBalanceCents)} />
        <Field label="Last payout" value={advisor.lastPayoutAt ? formatWhen(advisor.lastPayoutAt) : "—"} />
      </dl>
      <p className="mt-2 text-xs text-faint">
        Available {advisor.availableCoins}c · hold {advisor.holdCoins}c · in an open payout {advisor.openCoins}c
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onToggle}>
          {open ? "Hide details" : "View details"}
        </Button>
        {advisor.availableCoins > 0 ? (
          <Button size="sm" disabled={Boolean(busy)} onClick={onPayAvailable}>
            {busy === `avail:${advisor.id}` ? "Saving…" : `Mark ${advisor.availableCoins}c as paid`}
          </Button>
        ) : null}
      </div>
      {advisor.requests.length ? (
        <ul className="mt-3 space-y-2">
          {advisor.requests.map((request) => (
            <li key={request.id} className="rounded-xl bg-blush/40 px-3 py-2 text-sm">
              <p>
                {request.coins}c · {request.id}
              </p>
              <p className="text-xs text-faint">
                {formatWhen(request.createdAt)} · {statusLabel(request.label)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {request.label !== "processing" ? (
                  <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => onProcessing(request.id)}>
                    Mark processing
                  </Button>
                ) : null}
                <Button size="sm" disabled={Boolean(busy)} onClick={() => onPaid(request.id)}>
                  Mark as paid
                </Button>
                <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => onReject(request.id)}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? <DetailList detail={detail} /> : null}
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-wide text-faint uppercase">{label}</dt>
      <dd className="text-sm break-words text-fg">{value}</dd>
    </div>
  );
}

function DetailList({ detail }: { detail: Detail | null }) {
  if (!detail) return <p className="mt-4 text-sm text-muted">Loading details…</p>;
  const summary = detail.summary;
  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <p className="text-xs tracking-wide text-faint uppercase">Earnings summary</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Field label="Live readings" value={money(summary.readingCents)} />
        <Field label="Paid messages" value={money(summary.messageCents)} />
        <Field label="Tips / gifts" value={money(summary.tipCents)} />
        <Field label="Adjustments" value={money(summary.adjustmentCents)} />
        <Field label="Total earned" value={money(summary.earnedCents)} />
        <Field label="Already paid" value={money(summary.paidCents)} />
        <Field label="Pending payout" value={money(summary.pendingCents)} />
      </dl>
      {summary.refundedCents > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Refunded sittings {money(summary.refundedCents)} are already left out of live readings, so they are not subtracted again.
        </p>
      ) : null}
      <p className="mt-4 text-xs tracking-wide text-faint uppercase">Earnings</p>
      {!detail.history.length && !detail.adjustments.length ? (
        <p className="mt-2 text-sm text-muted">No recorded earnings yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {detail.history.map((row) => (
            <HistoryRow key={`${row.type}-${row.id}`} row={row} />
          ))}
          {detail.adjustments.map((row) => (
            <HistoryRow
              key={`adjustment-${row.id}`}
              row={{
                ...row,
                type: "adjustment",
              }}
            />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs tracking-wide text-faint uppercase">Payout history</p>
      {!detail.payouts.length ? (
        <p className="mt-2 text-sm text-muted">No payouts recorded.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {detail.payouts.map((row) => {
            const label = row.workflow === "processing" && row.status === "requested" ? "processing" : row.status === "paid" ? "paid" : row.status === "rejected" ? "rejected" : row.status === "failed" || row.status === "cancelled" || row.status === "canceled" || row.status === "reversed" ? "rejected" : "pending";
            return (
              <li key={row.id} className="rounded-xl bg-blush/40 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 break-all font-medium">{money(row.cents)}</p>
                  <p className={statusClass(label)}>{statusLabel(label)}</p>
                </div>
                <p className="mt-1 break-all text-xs text-faint">{row.id}</p>
                <p className="mt-1 text-xs text-muted">{formatWhen(row.at)}</p>
                {row.note ? <p className="mt-1 text-xs text-muted">{row.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({ row }: { row: EarningHistoryRow | { id: string; at: string; customer: string; reference: string; type: "adjustment"; grossCents: number; advisorCents: number; payoutStatus: "refunded" } }) {
  const type = row.type === "live reading" ? "Live reading" : row.type === "paid message" ? "Paid message" : row.type === "adjustment" ? "Adjustment" : "Tip/gift";
  return (
    <li className="rounded-xl bg-blush/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 font-medium">{type}</p>
        <p className={statusClass(row.payoutStatus)}>{statusLabel(row.payoutStatus)}</p>
      </div>
      <p className="mt-1 break-all text-xs text-faint">{row.reference}</p>
      <p className="mt-1 text-xs text-muted">{formatWhen(row.at)}</p>
      <p className="mt-1 text-xs text-muted">Customer amount {money(row.grossCents)}</p>
      <p className="text-xs text-muted">Advisor earning {money(row.advisorCents)}</p>
    </li>
  );
}

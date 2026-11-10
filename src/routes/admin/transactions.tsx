import { createFileRoute } from "@tanstack/react-router";
import { Clock, Coins, Download, MessageSquare, Radio, Receipt, Timer, Wallet } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyNote, InfoNote, PageHeader, Stat } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminTransactionDetail, adminTransactions } from "@/lib/ora-admin-transactions-api";
import {
  durationLabel,
  filterTransactions,
  paginateTransactions,
  summarizeTransactions,
  transactionsCsv,
  type AdminTransaction,
  type TransactionDetail,
  type TransactionFilters,
} from "@/lib/ora-admin-transactions";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/admin/transactions")({ component: TransactionsPage });

const emptyFilters: TransactionFilters = {
  client: "",
  advisor: "",
  from: "",
  to: "",
  type: "all",
  status: "all",
  minCoins: null,
  maxCoins: null,
};

function TransactionsPage() {
  const [rows, setRows] = useState<AdminTransaction[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AdminTransaction | null>(null);

  async function load() {
    setError("");
    const next = await adminTransactions({ data: { t: Date.now() } });
    setRows(next);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Could not load transactions."));
  }, []);

  const filtered = useMemo(() => (rows ? filterTransactions(rows, filters) : []), [rows, filters]);
  const stats = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const view = useMemo(() => paginateTransactions(filtered, page, 25), [filtered, page]);

  function apply(event: FormEvent) {
    event.preventDefault();
    setFilters(draft);
    setPage(1);
  }

  function exportCsv() {
    const csv = transactionsCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ora-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error && !rows) {
    return (
      <main>
        <PageHeader icon={Receipt} title="Transactions" description="Every stored client chat, including free sessions." />
        <p className="text-sm text-danger">{error}</p>
        <Button className="mt-3" onClick={() => void load().catch((err) => setError(err instanceof Error ? err.message : "Could not load transactions."))}>
          Retry
        </Button>
      </main>
    );
  }
  if (!rows) return <div className="h-40 animate-pulse rounded-2xl border border-dash-note-line bg-dash-violet" />;

  return (
    <main>
      <PageHeader
        icon={Receipt}
        title="Transactions"
        description="Each client chat is its own record, including free sessions that charged zero coins."
      />
      <InfoNote>
        Coins, advisor earnings, and Ora commission are the amounts stored on the session. They are not calculated from the length of the chat. Paid messages are listed separately and are not added into the chat totals.
      </InfoNote>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total chats today" value={String(stats.chatsToday)} hint="UTC day, matching filters" icon={MessageSquare} tone="violet" />
        <Stat label="Free chats today" value={String(stats.freeToday)} hint="No coins charged" icon={Timer} tone="mint" />
        <Stat label="Paid chats today" value={String(stats.paidToday)} hint="Paid and mixed" icon={Coins} tone="sand" />
        <Stat label="Total chat minutes" value={durationLabel(stats.chatSeconds)} hint="Stored duration" icon={Clock} tone="teal" />
        <Stat label="Total coins spent" value={`${stats.coins}c`} hint="Reading charges only" icon={Coins} tone="rose" />
        <Stat label="Advisor earnings" value={`${stats.advisorEarnings}c`} hint="Stored advisor share" icon={Wallet} tone="sand" />
        <Stat label="Ora revenue" value={`${stats.platformFee}c`} hint="Stored commission" icon={Receipt} tone="violet" />
        <Stat label="Active chats" value={String(stats.active)} hint="Live right now" icon={Radio} tone="sky" pulse={stats.active > 0} />
      </div>
      <p className="mb-3 text-xs text-muted">
        Paid messages in this list: {stats.paidMessages} · {stats.paidMessageCoins}c. Those coins are not included above.
      </p>
      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" onSubmit={apply}>
        <Input value={draft.client || ""} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Client name" />
        <Input value={draft.advisor || ""} onChange={(e) => setDraft({ ...draft, advisor: e.target.value })} placeholder="Advisor name" />
        <Input type="date" value={draft.from || ""} onChange={(e) => setDraft({ ...draft, from: e.target.value })} aria-label="From date" />
        <Input type="date" value={draft.to || ""} onChange={(e) => setDraft({ ...draft, to: e.target.value })} aria-label="To date" />
        <Select
          label="Type"
          value={draft.type || "all"}
          onChange={(type) => setDraft({ ...draft, type: type as TransactionFilters["type"] })}
          options={[
            ["all", "All types"],
            ["free", "Free"],
            ["paid", "Paid"],
            ["mixed", "Mixed"],
            ["message", "Paid message"],
          ]}
        />
        <Select
          label="Status"
          value={draft.status || "all"}
          onChange={(status) => setDraft({ ...draft, status: status as TransactionFilters["status"] })}
          options={[
            ["all", "All statuses"],
            ["live", "Live"],
            ["historical", "Historical"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
          ]}
        />
        <Input
          type="number"
          min={0}
          value={draft.minCoins ?? ""}
          onChange={(e) => setDraft({ ...draft, minCoins: e.target.value === "" ? null : Number(e.target.value) })}
          placeholder="Min coins"
          aria-label="Minimum coins"
        />
        <Input
          type="number"
          min={0}
          value={draft.maxCoins ?? ""}
          onChange={(e) => setDraft({ ...draft, maxCoins: e.target.value === "" ? null : Number(e.target.value) })}
          placeholder="Max coins"
          aria-label="Maximum coins"
        />
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(emptyFilters);
              setFilters(emptyFilters);
              setPage(1);
            }}
          >
            Clear
          </Button>
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </form>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-dash-note-line bg-surface">
        <table className="w-full min-w-[68rem] text-left text-sm">
          <thead className="text-xs tracking-wide text-muted uppercase">
            <tr>
              {[
                "Client",
                "Client ID",
                "Advisor",
                "Advisor ID",
                "When",
                "Type",
                "Duration",
                "Free",
                "Paid",
                "Coins",
                "Advisor",
                "Ora",
                "Status",
                "",
              ].map((label) => (
                <th key={label || "action"} className="px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!view.rows.length ? (
              <tr>
                <td colSpan={14} className="px-3 py-6">
                  <EmptyNote>No transactions match these filters.</EmptyNote>
                </td>
              </tr>
            ) : (
              view.rows.map((row) => (
                <tr key={row.key} className="border-t border-dash-note-line">
                  <td className="px-3 py-3 font-medium">{row.clientName}</td>
                  <td className="px-3 py-3 text-xs break-all text-faint">{row.clientId}</td>
                  <td className="px-3 py-3">{row.advisorName}</td>
                  <td className="px-3 py-3 text-xs break-all text-faint">{row.advisorId}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatWhen(row.at)}</td>
                  <td className="px-3 py-3">{row.chatTypeLabel}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.kind === "chat" ? durationLabel(row.seconds) : "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.kind === "chat" ? durationLabel(row.freeSeconds) : "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.kind === "chat" ? durationLabel(row.paidSeconds) : "—"}</td>
                  <td className="px-3 py-3 tabular-nums">{row.coins}c</td>
                  <td className="px-3 py-3 tabular-nums">{row.advisorEarnings}c</td>
                  <td className="px-3 py-3 tabular-nums">{row.platformFee}c</td>
                  <td className="px-3 py-3">{row.statusLabel}</td>
                  <td className="px-3 py-3">
                    <Button size="sm" variant="outline" onClick={() => setOpen(row)}>
                      View details
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          {view.total} records · page {view.page} of {view.pages}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={view.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </Button>
          <Button size="sm" variant="outline" disabled={view.page >= view.pages} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </div>
      </div>
      <DetailDialog row={open} onOpenChange={(next) => { if (!next) setOpen(null); }} />
    </main>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      aria-label={label}
      className="h-11 rounded-2xl border border-dash-note-line bg-white px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([id, text]) => (
        <option key={id} value={id}>
          {text}
        </option>
      ))}
    </select>
  );
}

function DetailDialog({ row, onOpenChange }: { row: AdminTransaction | null; onOpenChange: (open: boolean) => void }) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!row) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setError("");
    void adminTransactionDetail({ data: { kind: row.kind, id: row.id } })
      .then(setDetail)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load details.");
        toast.error(err instanceof Error ? err.message : "Could not load details.");
      });
  }, [row]);

  const shown = detail?.row || row;
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(100%-1.5rem,46rem)] w-[min(100%-1.5rem,40rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction details</DialogTitle>
          <DialogDescription>
            {shown ? `${shown.clientName} · ${shown.advisorName}` : "Stored billing for this record."}
          </DialogDescription>
        </DialogHeader>
        {!shown ? null : (
          <div className="mt-3 space-y-4 text-sm">
            {error ? <p className="text-danger">{error}</p> : null}
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Client" value={shown.clientName} />
              <Field label="Client ID" value={shown.clientId} />
              <Field label="Advisor" value={shown.advisorName} />
              <Field label="Advisor ID" value={shown.advisorId} />
              <Field label="Started" value={formatWhen(shown.at) || "—"} />
              <Field label="Ended" value={shown.endedAt ? formatWhen(shown.endedAt) : "—"} />
              <Field label="Duration" value={shown.kind === "chat" ? durationLabel(shown.seconds) : "Not a timed chat"} />
              <Field label="Type" value={shown.chatTypeLabel} />
              <Field label="Free time" value={shown.kind === "chat" ? durationLabel(shown.freeSeconds) : "—"} />
              <Field label="Paid time" value={shown.kind === "chat" ? durationLabel(shown.paidSeconds) : "—"} />
              <Field label="Coins charged" value={`${shown.coins}c`} />
              <Field label="Advisor earnings" value={`${shown.advisorEarnings}c`} />
              <Field label="Ora commission" value={`${shown.platformFee}c`} />
              <Field label="Status" value={shown.statusLabel} />
            </dl>
            {shown.kind === "chat" ? (
              <p className="text-xs text-muted">
                Welcome or trial time stored: {durationLabel(shown.bonusSeconds)}. Membership and weekly included time stored: {durationLabel(shown.weeklySeconds)}. Rate on the session: {shown.rateCoins}c/min.
              </p>
            ) : null}
            <p className="text-sm">
              <span className="text-xs tracking-wide text-faint uppercase">Ending reason</span>
              <span className="mt-1 block">{shown.endReason || "Not recorded"}</span>
            </p>
            {detail?.earning ? (
              <p className="text-sm">
                <span className="text-xs tracking-wide text-faint uppercase">Earning record</span>
                <span className="mt-1 block">
                  {detail.earning.status} · gross {detail.earning.gross}c · commission {detail.earning.commission}c · net {detail.earning.net}c
                </span>
              </p>
            ) : null}
            <section>
              <h3 className="font-display text-lg">Refunds and adjustments</h3>
              {!detail?.adjustments.length ? (
                <p className="mt-1 text-muted">No refunds or adjustments are stored for this record.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {detail.adjustments.map((item) => (
                    <li key={item.id}>
                      {item.kind} · {item.coins}c · {item.note || "No note"} · {formatWhen(item.at)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="font-display text-lg">Wallet ledger</h3>
              {!detail?.ledger.length ? (
                <p className="mt-1 text-muted">No wallet ledger line is stored for this record.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {detail.ledger.map((item) => (
                    <li key={item.id}>
                      {item.kind} · {item.coins}c · {item.note} · {formatWhen(item.at)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs tracking-wide text-faint uppercase">{label}</dt>
      <dd className="mt-0.5 break-all">{value}</dd>
    </div>
  );
}

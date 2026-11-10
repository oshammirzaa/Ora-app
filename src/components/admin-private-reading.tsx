import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyNote } from "@/components/admin-shell";
import { Input } from "@/components/ui/input";
import { adminPrivateReadingImage, adminPrivateReadingPdf, adminPrivateReadings, adminPrivateTranscript } from "@/lib/ora-private-readings-api";
import { durationLabel, type PrivateReading, type TranscriptMessage } from "@/lib/ora-private-readings";
import { formatWhen } from "@/lib/ora";

function whenParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "—" };
  return {
    date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}
function pdfBlob(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

export async function openReadingPdf(readingId: string, mode: "view" | "download", regenerate = false) {
  const file = await adminPrivateReadingPdf({ data: { readingId, regenerate } });
  const blob = pdfBlob(file.pdfBase64);
  const url = URL.createObjectURL(blob);
  if (mode === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
  }
  return { url, generatedAt: file.generatedAt, regenerated: file.regenerated, filename: file.filename };
}

function LazyPhoto({ readingId, messageId }: { readingId: string; messageId: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void adminPrivateReadingImage({ data: { readingId, messageId } })
        .then((row) => {
          if (row.image) setSrc(row.image);
          else setFailed(true);
        })
        .catch(() => setFailed(true));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [readingId, messageId]);
  return (
    <div ref={ref} className="mt-2">
      {src ? <img src={src} alt="" loading="lazy" className="max-h-64 rounded-xl object-contain" /> : null}
      {!src && !failed ? <p className="text-xs text-faint">Photo loads when this message is on screen.</p> : null}
      {failed ? <p className="text-xs text-faint">Photo attached. Preview is not available.</p> : null}
    </div>
  );
}

export function PrivateReadingDialog({
  reading,
  open,
  onOpenChange,
}: {
  reading: PrivateReading | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [access, setAccess] = useState<Array<{ id: string; adminName: string; action: string; at: string }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfNote, setPdfNote] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!open || !reading) return;
    setMessages([]);
    setTotal(0);
    setError("");
    setPdfUrl("");
    setPdfNote("");
    setLoading(true);
    void adminPrivateTranscript({ data: { readingId: reading.id, offset: 0, limit: 40 } })
      .then((page) => {
        setMessages(page.messages);
        setTotal(page.total);
        setAccess(page.access);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not open this reading."))
      .finally(() => setLoading(false));
  }, [open, reading]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function more() {
    if (!reading || loading) return;
    setLoading(true);
    try {
      const page = await adminPrivateTranscript({ data: { readingId: reading.id, offset: messages.length, limit: 40 } });
      setMessages((current) => [...current, ...page.messages]);
      setTotal(page.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load more messages.");
    } finally {
      setLoading(false);
    }
  }

  async function pdf(mode: "view" | "download", regenerate = false) {
    if (!reading) return;
    setBusy(mode);
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const file = await openReadingPdf(reading.id, mode, regenerate);
      setPdfUrl(file.url);
      setPdfNote(file.regenerated ? `New copy saved ${formatWhen(file.generatedAt)}.` : `Saved copy ${formatWhen(file.generatedAt)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the PDF.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(100%-1.5rem,52rem)] w-[min(100%-1.5rem,46rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Private reading</DialogTitle>
          <DialogDescription>Stored messages, in the order they were saved. This does not change the chat.</DialogDescription>
        </DialogHeader>
        {!reading ? null : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 rounded-2xl bg-dash-sand/40 p-3 sm:grid-cols-2">
              <p>
                <span className="text-faint">Customer</span>
                <span className="mt-0.5 block font-medium">{reading.clientName}</span>
                <span className="block text-xs break-all text-faint">{reading.clientId}</span>
              </p>
              <p>
                <span className="text-faint">Advisor</span>
                <span className="mt-0.5 block font-medium">{reading.advisorName}</span>
                <span className="block text-xs break-all text-faint">{reading.advisorId}</span>
              </p>
              <p>
                <span className="text-faint">Reading</span>
                <span className="mt-0.5 block text-xs break-all">{reading.id}</span>
              </p>
              <p>
                <span className="text-faint">When</span>
                <span className="mt-0.5 block">
                  {formatWhen(reading.startedAt)}
                  {reading.endedAt ? ` – ${formatWhen(reading.endedAt)}` : ""}
                </span>
              </p>
              <p>
                Duration {durationLabel(reading.seconds)} · Free {durationLabel(reading.freeSeconds)} · Paid{" "}
                {durationLabel(reading.paidSeconds)}
              </p>
              <p>
                {reading.coins}c · {reading.chatTypeLabel} · {reading.statusLabel}
                {reading.endReason ? ` · ${reading.endReason}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={Boolean(busy)} onClick={() => void pdf("view")}>
                {busy === "view" ? "Opening…" : "View PDF"}
              </Button>
              <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void pdf("download")}>
                Download PDF
              </Button>
              <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void pdf("view", true)}>
                Regenerate PDF
              </Button>
            </div>
            {pdfNote ? <p className="text-xs text-muted">{pdfNote} The message list is the current record.</p> : null}
            {pdfUrl ? <iframe title="Private reading PDF" src={pdfUrl} className="h-80 w-full rounded-xl border border-dash-note-line bg-white" /> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {loading && !messages.length ? <div className="h-24 animate-pulse rounded-xl bg-dash-violet" /> : null}
            <ol className="space-y-3">
              {messages.map((message) => (
                <li key={message.id} className="rounded-2xl border border-dash-note-line bg-surface px-3 py-2">
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {message.senderName}{" "}
                      <span className="text-xs font-normal text-faint">{message.senderRole}</span>
                    </span>
                    <span className="text-xs text-faint">{message.createdAt ? formatWhen(message.createdAt) : "Time not recorded"}</span>
                  </p>
                  {message.body ? <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.body}</p> : <p className="mt-1 text-faint">(No text stored)</p>}
                  {message.attachment ? <p className="mt-1 text-xs text-muted">{message.attachment}</p> : null}
                  {message.tipGift ? <p className="mt-1 text-xs text-muted">Tip: {message.tipGift}</p> : null}
                  {message.recalled ? <p className="mt-1 text-xs text-primary">Recalled. The stored text is shown here and is not rewritten.</p> : null}
                  {message.hasImage && reading ? <LazyPhoto readingId={reading.id} messageId={message.id} /> : null}
                </li>
              ))}
            </ol>
            {!loading && !error && !messages.length ? <p className="text-sm text-muted">No messages were stored for this reading.</p> : null}
            {messages.length < total ? (
              <Button variant="outline" size="sm" disabled={loading} onClick={() => void more()}>
                {loading ? "Loading…" : `Show more (${messages.length} of ${total})`}
              </Button>
            ) : null}
            {access.length ? (
              <div>
                <h3 className="font-display text-lg">Access log</h3>
                <ul className="mt-2 divide-y divide-dash-note-line">
                  {access.map((row) => (
                    <li key={row.id} className="flex justify-between gap-3 py-2 text-xs">
                      <span>
                        {row.adminName} · {row.action}
                      </span>
                      <span className="text-faint">{formatWhen(row.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PrivateReadingsDesk({ clientId = "" }: { clientId?: string }) {
  const [draft, setDraft] = useState({ client: "", advisor: "", from: "", to: "", type: "all", status: "all" });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PrivateReading[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<PrivateReading | null>(null);
  const [busyId, setBusyId] = useState("");

  async function load(nextPage = page, nextFilters = filters) {
    setError("");
    const result = await adminPrivateReadings({
      data: {
        ...nextFilters,
        clientId,
        type: nextFilters.type as "all" | "free" | "paid" | "mixed",
        status: nextFilters.status as "all" | "live" | "completed" | "cancelled" | "historical",
        page: nextPage,
      },
    });
    setRows(result.rows);
    setTotal(result.total);
    setPages(result.pages);
  }

  useEffect(() => {
    void load(1, filters).catch((err) => {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load private readings.");
    });
    // The desk reloads when the locked customer or the applied filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, filters]);

  function apply(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters(draft);
  }

  async function download(row: PrivateReading) {
    setBusyId(row.id);
    try {
      const file = await openReadingPdf(row.id, "download");
      window.setTimeout(() => URL.revokeObjectURL(file.url), 1500);
      toast.success(file.regenerated ? "PDF saved from the stored messages." : "PDF downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download the PDF.");
    } finally {
      setBusyId("");
    }
  }

  if (!rows && !error) return <div className="h-40 animate-pulse rounded-2xl border border-dash-note-line bg-dash-violet" />;

  return (
    <div>
      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" onSubmit={apply}>
        {clientId ? null : (
          <Input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Customer name or ID" aria-label="Customer" />
        )}
        <Input value={draft.advisor} onChange={(e) => setDraft({ ...draft, advisor: e.target.value })} placeholder="Advisor name or ID" aria-label="Advisor" />
        <Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} aria-label="From date" />
        <Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} aria-label="To date" />
        <select className="h-11 rounded-md border border-dash-note-line bg-surface px-3 text-sm" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} aria-label="Reading type">
          <option value="all">All types</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
          <option value="mixed">Mixed</option>
        </select>
        <select className="h-11 rounded-md border border-dash-note-line bg-surface px-3 text-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} aria-label="Reading status">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="live">Live</option>
          <option value="cancelled">Cancelled</option>
          <option value="historical">Not live</option>
        </select>
        <div className="flex gap-2">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const cleared = { client: "", advisor: "", from: "", to: "", type: "all", status: "all" };
              setDraft(cleared);
              setPage(1);
              setFilters(cleared);
            }}
          >
            Clear
          </Button>
        </div>
      </form>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-dash-note-line bg-surface">
        <table className="w-full min-w-[76rem] text-left text-sm">
          <thead className="text-xs tracking-wide text-muted uppercase">
            <tr>
              {["Customer", "Customer ID", "Advisor", "Advisor ID", "Date", "Start", "End", "Duration", "Free", "Paid", "Coins", "Status", ""].map((label) => (
                <th key={label || "actions"} className="px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rows?.length ? (
              <tr>
                <td colSpan={13} className="px-3 py-6">
                  <EmptyNote>No private readings match these filters.</EmptyNote>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-dash-note-line align-top">
                  <td className="px-3 py-3 font-medium">{row.clientName}</td>
                  <td className="px-3 py-3 text-xs break-all text-faint">{row.clientId}</td>
                  <td className="px-3 py-3">{row.advisorName}</td>
                  <td className="px-3 py-3 text-xs break-all text-faint">{row.advisorId}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{whenParts(row.startedAt).date}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{whenParts(row.startedAt).time}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.endedAt ? whenParts(row.endedAt).time : "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{durationLabel(row.seconds)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{durationLabel(row.freeSeconds)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{durationLabel(row.paidSeconds)}</td>
                  <td className="px-3 py-3">{row.coins}c</td>
                  <td className="px-3 py-3">
                    {row.chatTypeLabel} · {row.statusLabel}
                    {row.endReason ? <span className="mt-0.5 block text-xs text-faint">{row.endReason}</span> : null}
                    <span className="mt-0.5 block text-xs text-faint">{row.messageCount} stored messages{row.archived ? " · PDF saved" : ""}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={() => setOpen(row)}>
                        View reading
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => void download(row)}>
                        {busyId === row.id ? "Saving…" : "Download PDF"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>
          {total} reading{total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              void load(next).catch((err) => setError(err instanceof Error ? err.message : "Could not load private readings."));
            }}
          >
            Previous
          </Button>
          <span className="self-center">
            {page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void load(next).catch((err) => setError(err instanceof Error ? err.message : "Could not load private readings."));
            }}
          >
            Next
          </Button>
        </div>
      </div>
      <PrivateReadingDialog reading={open} open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpen(null); }} />
    </div>
  );
}

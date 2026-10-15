import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  advisorHighlight,
  advisorQueueBoard,
  extensionStatus,
  listAdvisorVault,
  saveHighlight,
  scheduleFutureMessage,
} from "@/lib/ora-premium-api";

export function AdvisorQueueChip() {
  const [board, setBoard] = useState<Awaited<ReturnType<typeof advisorQueueBoard>> | null>(null);
  useEffect(() => {
    void advisorQueueBoard().then(setBoard).catch(() => setBoard(null));
  }, []);
  if (!board?.enabled) return null;
  return (
    <section className="mt-4 rounded-2xl bg-surface px-3 py-3 text-sm shadow-[var(--shadow-border)]">
      <p className="text-[11px] tracking-[0.14em] text-[#8d6b32] uppercase">Waiting queue</p>
      <p className="mt-1">
        {board.waiting} waiting · next {board.next || "—"} · {board.status}
      </p>
    </section>
  );
}

export function AdvisorSessionPremium({ readingId, ended }: { readingId: string; ended: boolean }) {
  const [days, setDays] = useState(7);
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [insights, setInsights] = useState(["", "", ""]);
  const [topics, setTopics] = useState("");
  const [steps, setSteps] = useState("");
  const [reflection, setReflection] = useState("");
  const [credit, setCredit] = useState(0);
  const [vault, setVault] = useState<Awaited<ReturnType<typeof listAdvisorVault>>>([]);

  useEffect(() => {
    void extensionStatus({ data: { readingId } }).then((row) => setCredit(row?.creditSeconds || 0)).catch(() => {});
    void listAdvisorVault().then(setVault).catch(() => {});
    if (ended) {
      void advisorHighlight({ data: { readingId } }).then((row) => {
        if (!row) return;
        setInsights([row.insights[0] || "", row.insights[1] || "", row.insights[2] || ""]);
        setTopics(row.topics);
        setSteps(row.nextSteps);
        setReflection(row.reflection);
      }).catch(() => {});
    }
  }, [readingId, ended]);

  return (
    <div className="space-y-3">
      {credit > 0 ? <p className="text-xs text-[#8d6b32]">Client added time · {Math.ceil(credit / 60)} min still credited</p> : null}
      <form
        className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]"
        onSubmit={(event) => {
          event.preventDefault();
          void scheduleFutureMessage({ data: { readingId, body, days } })
            .then(() => {
              setBody("");
              setPreview(false);
              toast.success("Future message scheduled. The client is not charged.");
              return listAdvisorVault().then(setVault);
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not schedule"));
        }}
      >
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">Future message</p>
        <div className="mt-2 flex gap-2">
          {[7, 15, 30].map((option) => (
            <button key={option} type="button" className="rounded-full bg-elevated px-3 py-1 text-xs" onClick={() => setDays(option)}>
              {option}d{days === option ? " ·" : ""}
            </button>
          ))}
        </div>
        <Textarea className="mt-2" aria-label="Future message" value={body} onChange={(event) => setBody(event.target.value)} placeholder="A personal note. No payment requests." />
        {preview ? <p className="mt-2 rounded-xl bg-[#fbf6ea] p-2 text-xs">Opens in {days} days: {body}</p> : null}
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setPreview(true)}>Preview</Button>
          <Button type="submit" size="sm" disabled={!preview || body.trim().length < 2}>Confirm schedule</Button>
        </div>
      </form>
      {ended ? (
        <form
          className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]"
          onSubmit={(event) => {
            event.preventDefault();
            const share = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-share") === "1";
            void saveHighlight({ data: { readingId, insights, topics, nextSteps: steps, reflection, share } })
              .then(() => toast.success(share ? "Shared with your client." : "Draft saved."))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
          }}
        >
          <p className="text-[11px] tracking-[0.14em] text-muted uppercase">Reading highlights</p>
          {insights.map((value, index) => (
            <Input
              key={index}
              className="mt-2"
              aria-label={`Insight ${index + 1}`}
              placeholder={`Insight ${index + 1}`}
              value={value}
              onChange={(event) => setInsights((rows) => rows.map((row, i) => (i === index ? event.target.value : row)))}
            />
          ))}
          <Input className="mt-2" aria-label="Topics" placeholder="Topics discussed" value={topics} onChange={(event) => setTopics(event.target.value)} />
          <Textarea className="mt-2" aria-label="Next steps" placeholder="Suggested next steps" value={steps} onChange={(event) => setSteps(event.target.value)} />
          <Textarea className="mt-2" aria-label="Reflection" placeholder="Optional reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} />
          <div className="mt-2 flex gap-2">
            <Button type="submit" size="sm" variant="outline">Save draft</Button>
            <Button type="submit" size="sm" data-share="1">Share with client</Button>
          </div>
        </form>
      ) : null}
      {vault.length ? (
        <ul className="space-y-1 text-xs text-muted">
          {vault.slice(0, 4).map((row) => (
            <li key={row.id}>{row.customer} · {row.status} · {new Date(row.unlockAt).toLocaleDateString()}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

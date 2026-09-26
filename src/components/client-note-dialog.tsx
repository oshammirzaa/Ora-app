import { FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAdvisorPrivateNote, saveAdvisorPrivateNote } from "@/lib/ora-advisor-desk";
import { PRIVATE_NOTE_MAX } from "@/lib/ora-private-notes";
import { cn } from "@/lib/utils";

export function ClientNoteButton({
  customerId,
  className,
}: {
  customerId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [hasNote, setHasNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const dirtyRef = useRef(false);
  const loadSeq = useRef(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const seq = ++loadSeq.current;
    dirtyRef.current = false;
    setReady(false);
    setDraft("");
    setHasNote(false);
    if (!customerId) return;
    let cancelled = false;
    void getAdvisorPrivateNote({ data: { customerId } })
      .then((res) => {
        if (cancelled || loadSeq.current !== seq || dirtyRef.current) return;
        const body = String(res?.body || "");
        setDraft(body);
        setHasNote(Boolean(body.trim()));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled && loadSeq.current === seq) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!open || !ready) return;
    const id = window.setTimeout(() => areaRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, ready]);

  async function save() {
    if (busy || !ready || !customerId) return;
    setBusy(true);
    const seq = ++loadSeq.current;
    try {
      const res = await saveAdvisorPrivateNote({ data: { customerId, body: draft } });
      if (loadSeq.current !== seq) return;
      const body = String(res?.body ?? draft).slice(0, PRIVATE_NOTE_MAX);
      dirtyRef.current = false;
      setDraft(body);
      setHasNote(Boolean(body.trim()));
      toast.success("Note saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the note");
    } finally {
      setBusy(false);
    }
  }

  if (!customerId) return null;

  return (
    <>
      <button
        type="button"
        aria-label={hasNote ? "Client note, saved" : "Client note"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={hasNote ? "Private note saved" : "Client note"}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl text-primary shadow-[var(--shadow-border)]",
          hasNote ? "bg-gold/25 ring-1 ring-gold/80" : "bg-surface/90",
          className,
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <FileText className="size-4" strokeWidth={1.75} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center" role="presentation">
              <button
                type="button"
                aria-label="Close client note"
                className="absolute inset-0 bg-blush/80 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ora-client-note-title"
                className="relative z-10 w-full max-w-md rounded-[1.5rem] bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border-hover)]"
              >
                <button
                  type="button"
                  className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
                <h2 id="ora-client-note-title" className="pr-10 font-display text-2xl text-fg">
                  Client Note
                </h2>
                <p className="mt-1 text-sm text-muted">Private note — only visible to you</p>
                <Textarea
                  ref={areaRef}
                  value={draft}
                  maxLength={PRIVATE_NOTE_MAX}
                  placeholder={ready ? "Type your note here..." : "Loading note..."}
                  className="mt-4 min-h-32"
                  disabled={!ready || busy}
                  onChange={(event) => {
                    dirtyRef.current = true;
                    setDraft(event.target.value.slice(0, PRIVATE_NOTE_MAX));
                  }}
                />
                <p className="mt-1 text-right text-[11px] text-faint tabular-nums">
                  {draft.length}/{PRIVATE_NOTE_MAX}
                </p>
                <Button type="button" className="mt-3 h-12 w-full rounded-full" disabled={busy || !ready} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save Note"}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

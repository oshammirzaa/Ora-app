import { Check, Pencil, Trash2, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listAdvisorQuickReplies, saveAdvisorQuickReplies } from "@/lib/ora-advisor-desk";
import { insertAtCursor } from "@/lib/ora-message-media";

export function AdvisorQuickMessages({
  draft,
  setDraft,
  inputRef,
  disabled,
}: {
  draft: string;
  setDraft: (value: string) => void;
  inputRef: { current: HTMLInputElement | HTMLTextAreaElement | null };
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<string[]>([]);
  const [draftReply, setDraftReply] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listAdvisorQuickReplies()
      .then((data) => setReplies(data.replies.map((row) => String(row.body))))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load quick messages"));
  }, [open]);

  async function persist(next: string[], success: string) {
    setSaving(true);
    try {
      const saved = await saveAdvisorQuickReplies({ data: { replies: next } });
      setReplies(saved.replies.map((row: { body?: unknown }) => String(row.body || "")));
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save quick messages");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function useMessage(body: string) {
    const field = inputRef.current;
    const start = field?.selectionStart ?? draft.length;
    const end = field?.selectionEnd ?? draft.length;
    const needsSpace = start > 0 && draft[start - 1] && !/\s/.test(draft[start - 1]);
    const next = insertAtCursor(draft, start, end, `${needsSpace ? " " : ""}${body}`);
    setDraft(next.value);
    setOpen(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(next.cursor, next.cursor);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Quick messages"
        disabled={disabled}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-elevated text-primary shadow-[var(--shadow-border)] disabled:opacity-40"
        onClick={() => setOpen(true)}
      >
        <Zap className="size-4" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2a2430]/35 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Quick messages"
            className="mb-[max(0.25rem,env(safe-area-inset-bottom))] max-h-[min(32rem,80dvh)] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-xl text-fg">Quick messages</p>
                <p className="text-xs text-muted">Saved on your advisor account. Tap one to place it in the message.</p>
              </div>
              <button type="button" aria-label="Close quick messages" className="grid size-8 place-items-center rounded-full bg-elevated text-fg" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const body = draftReply.trim();
                if (!body) return;
                void persist([...replies, body], "Quick message saved.").then((ok) => {
                  if (ok) setDraftReply("");
                });
              }}
            >
              <Textarea
                value={draftReply}
                onChange={(event) => setDraftReply(event.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Add a message you send often"
              />
              <Button type="submit" className="w-full" disabled={saving || !draftReply.trim()}>
                Save quick message
              </Button>
            </form>
            {!replies.length ? (
              <p className="mt-4 text-sm text-muted">No quick messages yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {replies.map((body, index) => (
                  <li key={`${index}-${body.slice(0, 24)}`} className="rounded-xl bg-elevated p-3">
                    {editing === index ? (
                      <form
                        className="space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const nextBody = editBody.trim();
                          if (!nextBody) return;
                          const next = replies.map((row, rowIndex) => (rowIndex === index ? nextBody : row));
                          void persist(next, "Quick message updated.").then((ok) => {
                            if (ok) setEditing(null);
                          });
                        }}
                      >
                        <Textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength={280} rows={3} />
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={saving || !editBody.trim()}>
                            <Check className="size-3.5" />
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <button type="button" className="w-full text-left text-sm text-fg" onClick={() => useMessage(body)}>
                          {body}
                        </button>
                        <div className="mt-2 flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => useMessage(body)}>
                            Use
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(index);
                              setEditBody(body);
                            }}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={saving}
                            onClick={() => void persist(replies.filter((_, rowIndex) => rowIndex !== index), "Quick message removed.")}
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

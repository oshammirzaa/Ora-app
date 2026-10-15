import { Check, Pencil, Search, Trash2, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listSmartReplies, saveSmartReplies } from "@/lib/ora-advanced-api";
import { insertAtCursor } from "@/lib/ora-message-media";
import { SMART_REPLY_CATEGORIES, type SmartReplyCategory } from "@/lib/ora-advanced-rules";

const LABELS: Record<SmartReplyCategory, string> = {
  greetings: "Greetings",
  followups: "Follow-ups",
  thanks: "Thank You",
  general: "General",
};

type Reply = { body: string; category: SmartReplyCategory };

export function SmartQuickMessages({
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
            className="mb-[max(0.25rem,env(safe-area-inset-bottom))] max-h-[min(34rem,80dvh)] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-xl text-fg">Quick messages</p>
                <p className="text-xs text-muted">Tap a reply to place it in the message. Nothing sends until you do.</p>
              </div>
              <button type="button" aria-label="Close quick messages" className="grid size-8 place-items-center rounded-full bg-elevated" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <SmartReplyEditor
              onUse={(body) => {
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
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SmartReplyEditor({ onUse }: { onUse?: (body: string) => void }) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SmartReplyCategory>("general");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listSmartReplies()
      .then((data) => setReplies(data.replies as Reply[]))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load replies"));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return replies
      .map((reply, index) => ({ reply, index }))
      .filter((row) => !q || row.reply.body.toLowerCase().includes(q) || LABELS[row.reply.category].toLowerCase().includes(q));
  }, [replies, query]);

  async function persist(next: Reply[], success: string) {
    setSaving(true);
    try {
      const saved = await saveSmartReplies({ data: { replies: next } });
      setReplies(saved.replies as Reply[]);
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save replies");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-faint" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search replies" className="pl-9" />
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          void persist([...replies, { body: draft.trim(), category }], "Reply saved.").then((ok) => {
            if (ok) setDraft("");
          });
        }}
      >
        <select
          aria-label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value as SmartReplyCategory)}
          className="h-11 w-full rounded-md bg-elevated px-3 text-sm"
        >
          {SMART_REPLY_CATEGORIES.map((id) => (
            <option key={id} value={id}>{LABELS[id]}</option>
          ))}
        </select>
        <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} rows={2} placeholder="I'm with you — tell me what you need." />
        <Button type="submit" className="w-full" disabled={saving || !draft.trim() || replies.length >= 30}>
          {replies.length >= 30 ? "30 replies saved" : "Save reply"}
        </Button>
      </form>
      <ul className="space-y-2">
        {shown.map(({ reply, index }) => (
          <li key={`${index}-${reply.body.slice(0, 12)}`} className="rounded-2xl bg-elevated p-3">
            {editing === index ? (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = editBody.trim();
                  if (!body) return;
                  void persist(replies.map((row, i) => (i === index ? { ...row, body } : row)), "Reply updated.").then((ok) => {
                    if (ok) setEditing(null);
                  });
                }}
              >
                <Textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength={280} rows={2} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={saving}><Check className="size-4" /> Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-[11px] tracking-wide text-primary uppercase">{LABELS[reply.category] || "General"}</p>
                <p className="mt-1 text-sm">{reply.body}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {onUse ? (
                    <Button type="button" size="sm" onClick={() => onUse(reply.body)}>Insert</Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(index); setEditBody(reply.body); }}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={index === 0 || saving} onClick={() => {
                    const next = replies.slice();
                    const [row] = next.splice(index, 1);
                    next.splice(index - 1, 0, row);
                    void persist(next, "Order saved.");
                  }}>Up</Button>
                  <Button type="button" size="sm" variant="outline" disabled={index === replies.length - 1 || saving} onClick={() => {
                    const next = replies.slice();
                    const [row] = next.splice(index, 1);
                    next.splice(index + 1, 0, row);
                    void persist(next, "Order saved.");
                  }}>Down</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void persist(replies.filter((_, i) => i !== index), "Reply removed.")}>
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

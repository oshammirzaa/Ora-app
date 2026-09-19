import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/advisor-desk";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listAdvisorQuickReplies, saveAdvisorQuickReplies } from "@/lib/ora-advisor-desk";

export const Route = createFileRoute("/advisor/settings/replies")({ component: QuickReplyPage });

function QuickReplyPage() {
  const { user, isPending } = useCurrentUserState();
  const [replies, setReplies] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void listAdvisorQuickReplies()
      .then((d) => setReplies(d.replies.map((r) => r.body)))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load replies"));
  }, [user]);

  async function persist(next: string[]) {
    setSaving(true);
    try {
      const saved = await saveAdvisorQuickReplies({ data: { replies: next } });
      setReplies(saved.replies.map((r) => r.body));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save replies");
    } finally {
      setSaving(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const next = [...replies, body];
    setDraft("");
    await persist(next);
    toast.success("Reply saved.");
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  return (
    <main className="space-y-4">
      <Link to="/advisor/settings" preload={false} className="text-sm text-primary">
        Back to Settings
      </Link>
      <p className="text-sm text-muted">Saved phrases you can copy into Messages. They stay on this desk only.</p>
      <form onSubmit={(e) => void add(e)} className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <Textarea
          id="qr"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="I'm with you — tell me what you need."
        />
        <Button type="submit" className="w-full" disabled={saving || !draft.trim()}>
          Save reply
        </Button>
      </form>
      {!replies.length ? (
        <EmptyState title="No quick replies yet" body="Add a phrase you use often. You can copy it from this list." />
      ) : (
        <ul className="space-y-2">
          {replies.map((body, i) => (
            <li key={`${i}-${body.slice(0, 12)}`} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="text-sm">{body}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(body).then(
                      () => toast.success("Copied."),
                      () => toast.error("Could not copy"),
                    );
                  }}
                >
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => void persist(replies.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

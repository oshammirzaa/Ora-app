import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorShell } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  endReading,
  formatClock,
  getReading,
  mergeMessages,
  sameMessages,
  parseRate,
  sendAdvisorMessage,
  syncReading,
  type ChatMsg,
} from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/advisor/session/$id")({ component: SessionPage });

function SessionPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const navigate = useNavigate();
  const [clientName, setClientName] = useState("Client");
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<"live" | "ended">("live");
  const [rate, setRate] = useState(0);
  const [earned, setEarned] = useState(0);
  const [fee, setFee] = useState(0);
  const [charged, setCharged] = useState(0);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getReading({ data: { id } }).then((r) => {
      if (cancelled || !r) return;
      setClientName(r.clientName || "Client");
      setSeconds(Number(r.seconds) || 0);
      setStatus(r.status === "ended" ? "ended" : "live");
      setRate(parseRate(r.rateCoins) ?? 0);
      setEarned(Number(r.advisorEarned) || 0);
      setFee(Number(r.platformFee) || 0);
      setCharged(Number(r.coinsSpent) || 0);
    });
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  useVisibleInterval(
    () => {
      void syncReading({ data: { id } })
        .then((res) => {
          if (!res) return;
          const nextSeconds = Number(res.seconds);
          if (Number.isFinite(nextSeconds)) setSeconds((s) => Math.max(s, nextSeconds));
          if (res.status === "ended" || res.status === "live") setStatus(res.status);
          const nextRate = parseRate(res.rateCoins);
          if (nextRate) setRate(nextRate);
          if (Number.isFinite(Number(res.advisorEarned))) setEarned(Number(res.advisorEarned));
          if (Number.isFinite(Number(res.platformFee))) setFee(Number(res.platformFee));
          if (Number.isFinite(Number(res.coinsSpent))) setCharged(Number(res.coinsSpent));
          const incoming = Array.isArray(res.messages) ? res.messages : null;
          if (incoming) {
            setMsgs((cur) => {
              const next = mergeMessages([], incoming);
              if (next.length === 0 && cur.length > 0) return cur;
              return sameMessages(cur, next) ? cur : next;
            });
          }
        })
        .catch(() => {});
    },
    3500,
    Boolean(userId) && status === "live",
  );

  useVisibleInterval(
    () => {
      setSeconds((s) => s + 1);
    },
    1000,
    status === "live",
    false,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy || status !== "live") return;
    setBusy(true);
    setDraft("");
    try {
      const msg = await sendAdvisorMessage({ data: { id, body } });
      setMsgs((m) => mergeMessages(m, [msg]));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
      if (err instanceof Error && err.message.toLowerCase().includes("ended")) setStatus("ended");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    await endReading({ data: { id } });
    await navigate({ to: "/advisor" });
  }

  if (isPending) {
    return (
      <AdvisorShell tab="desk">
        <div className="h-40 animate-pulse rounded-xl bg-elevated" />
      </AdvisorShell>
    );
  }
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  return (
    <AdvisorShell tab="desk" busy={status === "live"} online>
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
        <header className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-muted uppercase">Live with</p>
          <h1 className="font-display text-2xl text-fg">{clientName}</h1>
          <p className="font-display text-3xl tabular-nums text-primary">{formatClock(seconds)}</p>
          <p className="mt-1 text-sm text-muted">
            {rate}c / min · client {charged}c · you {earned}c · house {fee}c
          </p>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "advisor" ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "advisor"
                    ? "bg-primary text-primary-fg"
                    : "bg-surface text-fg shadow-[var(--shadow-border)]",
                )}
              >
                {m.body}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="rounded-2xl bg-surface px-4 py-4 shadow-[var(--shadow-border)]">
          {status === "ended" ? (
            <p className="text-sm text-muted">
              Session ended. {formatClock(seconds)} · you earned {earned}c.
            </p>
          ) : (
            <form onSubmit={send} className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Reply…"
                maxLength={800}
                className="h-11 min-w-0 flex-1 rounded-full bg-elevated px-4 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
              />
              <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="Send">
                <Send />
              </Button>
            </form>
          )}
          {status === "live" ? (
            <button type="button" className="mt-3 text-xs text-muted hover:text-fg" onClick={() => void stop()}>
              End session
            </button>
          ) : null}
        </div>
      </div>
    </AdvisorShell>
  );
}

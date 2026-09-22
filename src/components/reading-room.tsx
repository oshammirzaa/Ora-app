import { Link, useNavigate } from "@tanstack/react-router";
import { Send, Star } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorMedia } from "@/components/advisor-media";
import { ChatWordMeter } from "@/components/chat-word-meter";
import { BlockConfirmDialog, SafetyReportDialog } from "@/components/safety-dialogs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  COIN_PACKS,
  formatClock,
  includedSeconds,
  leaveReview,
  mergeMessages,
  parseRate,
  sameMessages,
  sendMessage,
  syncReading,
  type Advisor,
  type ChatMsg,
  type Wallet,
} from "@/lib/ora";
import { startCheckout } from "@/lib/ora-pay";
import { getPairSafety, setCustomerBlock } from "@/lib/ora-safety-api";
import { chatDraftFromInput, chatMessageOverLimit } from "@/lib/ora-chat-words";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

const CHIPS = [
  "A relationship I can't read.",
  "Work is stuck. What am I missing?",
  "A yes or no I've been avoiding.",
  "Someone I keep thinking about.",
];

export function ReadingRoom({
  readingId,
  advisor,
  initialSeconds,
  initialStatus,
  initialReviewed,
  initialRate,
  initialCoinsSpent,
  onEnd,
}: {
  readingId: string;
  advisor: Advisor;
  initialSeconds: number;
  initialStatus: "live" | "ended";
  initialReviewed?: boolean;
  initialRate?: number;
  initialCoinsSpent?: number;
  onEnd: () =>
    | void
    | Promise<{
        seconds?: number;
        coinsSpent?: number;
        rateCoins?: number;
        wallet?: Wallet | null;
        status?: string;
      } | null | void>;
}) {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(initialSeconds);
  const [status, setStatus] = useState<"live" | "ended">(initialStatus);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [coinsSpent, setCoinsSpent] = useState(() => {
    const n = Number(initialCoinsSpent);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const [rate, setRate] = useState(
    () => parseRate(initialRate) ?? parseRate(advisor.rateCoins) ?? 0,
  );
  const [remaining, setRemaining] = useState(0);
  const [lowBalance, setLowBalance] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState("");
  const [ending, setEnding] = useState(false);
  const [rating, setRating] = useState(5);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewed, setReviewed] = useState(Boolean(initialReviewed));
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const warned = useRef(false);

  useEffect(() => {
    const spent = Number(initialCoinsSpent);
    if (Number.isFinite(spent) && spent >= 0) setCoinsSpent((c) => Math.max(c, spent));
    const secs = Number(initialSeconds);
    if (Number.isFinite(secs) && secs >= 0) setSeconds((s) => Math.max(s, secs));
    if (initialStatus === "ended") setStatus("ended");
    const nextRate = parseRate(initialRate) ?? parseRate(advisor.rateCoins);
    if (nextRate) setRate(nextRate);
    setReviewed((r) => r || Boolean(initialReviewed));
  }, [initialCoinsSpent, initialSeconds, initialStatus, initialRate, initialReviewed, advisor.rateCoins]);

  useEffect(() => {
    if (!advisor?.id) return;
    void getPairSafety({ data: { advisorId: advisor.id } })
      .then((r) => setBlockedByMe(Boolean(r.blockedByMe)))
      .catch(() => setBlockedByMe(false));
  }, [advisor?.id]);

  useVisibleInterval(
    () => {
      void syncReading({ data: { id: readingId } })
        .then((res) => {
          if (!res) return;
          const nextSeconds = Number(res.seconds);
          if (Number.isFinite(nextSeconds)) setSeconds((s) => Math.max(s, nextSeconds));
          if (res.status === "ended" || res.status === "live") setStatus(res.status);
          if (Number.isFinite(Number(res.coinsSpent))) setCoinsSpent(Number(res.coinsSpent));
          const nextRate = parseRate(res.rateCoins);
          if (nextRate) setRate(nextRate);
          if (Number.isFinite(Number(res.remainingSeconds))) setRemaining(Number(res.remainingSeconds));
          setLowBalance(Boolean(res.lowBalance));
          if (res.wallet) setWallet(res.wallet);
          const incoming = Array.isArray(res.messages) ? res.messages : null;
          if (incoming) {
            setMsgs((cur) => {
              const next = mergeMessages([], incoming);
              if (next.length === 0 && cur.length > 0) return cur;
              return sameMessages(cur, next) ? cur : next;
            });
          }
          if (res.lowBalance && !warned.current) {
            warned.current = true;
            toast.message("Balance is running out. Add coins to stay in the reading.");
          }
          if (!res.lowBalance) warned.current = false;
        })
        .catch(() => {});
    },
    3500,
    status === "live",
  );

  useVisibleInterval(
    () => {
      setSeconds((s) => s + 1);
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    },
    1000,
    status === "live",
    false,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  async function send(body: string) {
    const text = body.trim();
    if (!text || busy || sendingRef.current || status !== "live" || chatMessageOverLimit(text)) return;
    sendingRef.current = true;
    setBusy(true);
    setDraft("");
    try {
      const res = await sendMessage({ data: { id: readingId, body: text } });
      setMsgs((m) => mergeMessages(m, [res?.client, res?.advisor]));
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (e) {
      setDraft(text);
      toast.error(e instanceof Error ? e.message : "Could not send");
      if (e instanceof Error && e.message.toLowerCase().includes("ended")) setStatus("ended");
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  async function addPack(id: string) {
    setBuying(id);
    try {
      const res = await startCheckout({
        data: {
          packId: id,
          returnTo: `/reading/${readingId}`,
          origin: window.location.origin,
        },
      });
      if (res.provider === "stripe" && res.url.startsWith("https://")) {
        window.location.assign(res.url);
        return;
      }
      await navigate({ to: "/account", search: { pay: res.paymentId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open checkout");
    } finally {
      setBuying("");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  const included = wallet ? includedSeconds(wallet) : null;
  const asked = msgs.some((m) => m.role === "client");

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <aside>
        <div className="relative h-52 overflow-hidden bg-elevated">
          <AdvisorMedia photo={advisor.photoUrl} video={advisor.videoUrl} alt="" eager />
        </div>
        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-xs tracking-wide text-muted uppercase">{advisor.specialties || "Reading"}</p>
          <h1 className="font-display text-3xl text-fg">{advisor.name || "Advisor"}</h1>
          <div className="mt-2 flex gap-3">
            <button type="button" className="text-xs text-muted" onClick={() => setBlockOpen(true)}>
              {blockedByMe ? "Unblock" : "Block"}
            </button>
            <button type="button" className="text-xs text-muted" onClick={() => setReportOpen(true)}>
              Report
            </button>
          </div>
          <p className="mt-3 font-display text-5xl tabular-nums text-fg">{formatClock(seconds)}</p>
          <p className="mt-1 text-sm text-primary">
            {coinsSpent}c charged · {rate}c / min
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {status === "ended"
              ? "Session closed."
              : included !== null && included > 0
                ? `Included left ${formatClock(included)} · then ${rate}c / min`
                : remaining > 0
                  ? `${formatClock(remaining)} of paid time left`
                  : "Included minutes first, then coins."}
          </p>
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col bg-bg">
        {status === "live" && lowBalance ? (
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm text-warn">Balance is almost gone. Add coins or this sitting ends.</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {COIN_PACKS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline"
                  disabled={Boolean(buying)}
                  onClick={() => void addPack(p.id)}
                >
                  {buying === p.id ? "Opening…" : `${p.coins}c · $${p.usd}`}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "client" ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                  m.role === "client" ? "bg-primary text-primary-fg" : "bg-elevated text-fg",
                )}
              >
                {m.body}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border px-4 py-4">
          {status === "ended" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                This reading ended. {formatClock(seconds)} · {coinsSpent}c charged at {rate}c / min.
              </p>
              <Button asChild className="w-full rounded-full">
                <Link to="/">Back to advisors</Link>
              </Button>
              {reviewed ? (
                <p className="text-sm text-ok">Review saved.</p>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void leaveReview({ data: { readingId, rating, body: reviewBody } })
                      .then(() => {
                        setReviewed(true);
                        toast.success("Review saved.");
                      })
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
                  }}
                >
                  <p className="font-display text-lg">How was this sitting?</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="p-1"
                        onClick={() => setRating(n)}
                        aria-label={`${n} stars`}
                      >
                        <Star
                          className={cn("size-6", n <= rating ? "fill-primary text-primary" : "text-faint")}
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Optional. A sentence is enough."
                    maxLength={400}
                    className="min-h-24"
                  />
                  <Button type="submit" className="w-full rounded-full">
                    Leave review
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <>
              {!asked ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="rounded-full bg-elevated px-3 py-2 text-left text-xs text-muted"
                      onClick={() => void send(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
              <form onSubmit={onSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(chatDraftFromInput(draft, e))}
                  placeholder="Ask what you need to know"
                  className="h-11 min-w-0 flex-1 rounded-full bg-elevated px-4 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
                />
                <Button type="submit" size="icon" className="rounded-full" disabled={busy || !draft.trim() || chatMessageOverLimit(draft)} aria-label="Send">
                  <Send />
                </Button>
              </form>
              <ChatWordMeter value={draft} />
            </>
          )}
          {status === "live" ? (
            <button
              type="button"
              className="mt-3 text-xs text-muted hover:text-fg"
              disabled={ending}
              onClick={() => {
                if (ending) return;
                setEnding(true);
                void Promise.resolve(onEnd())
                  .then((bill) => {
                    if (bill && typeof bill === "object") {
                      if (Number.isFinite(Number(bill.seconds))) setSeconds((s) => Math.max(s, Number(bill.seconds)));
                      if (Number.isFinite(Number(bill.coinsSpent))) setCoinsSpent(Number(bill.coinsSpent));
                      const endedRate = parseRate(bill.rateCoins);
                      if (endedRate) setRate(endedRate);
                      if (bill.wallet) setWallet(bill.wallet);
                    }
                    setStatus("ended");
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not end"))
                  .finally(() => setEnding(false));
              }}
            >
              {ending ? "Ending…" : "End reading"}
            </button>
          ) : null}
        </div>
      </section>
      <BlockConfirmDialog
        open={blockOpen}
        name={advisor.name || "Advisor"}
        blocking={!blockedByMe}
        onConfirm={async () => {
          await setCustomerBlock({ data: { advisorId: advisor.id, blocked: !blockedByMe } });
          setBlockedByMe(!blockedByMe);
          toast.success(
            blockedByMe
              ? "Advisor unblocked."
              : "Advisor blocked. They cannot start new messages or live readings after this session.",
          );
        }}
        onOpenChange={setBlockOpen}
      />
      <SafetyReportDialog
        open={reportOpen}
        name={advisor.name || "Advisor"}
        advisorId={advisor.id}
        readingId={readingId}
        onOpenChange={setReportOpen}
      />
    </div>
  );
}

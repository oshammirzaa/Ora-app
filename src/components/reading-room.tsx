import { Link, useNavigate } from "@tanstack/react-router";
import { Send, Star } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorMedia } from "@/components/advisor-media";
import { ChatWordMeter } from "@/components/chat-word-meter";
import { LiveChatFrame, LiveChatComposer, LiveChatReplyInput, keepChatKeyboard, refocusChatInput } from "@/components/live-chat-frame";
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  async function send(body: string) {
    const text = body.trim();
    if (!text || busy || sendingRef.current || status !== "live" || chatMessageOverLimit(text)) return;
    sendingRef.current = true;
    setBusy(true);
    setDraft("");
    refocusChatInput(inputRef.current);
    try {
      const res = await sendMessage({ data: { id: readingId, body: text } });
      setMsgs((m) => mergeMessages(m, [res?.client, res?.advisor]));
    } catch (e) {
      setDraft(text);
      toast.error(e instanceof Error ? e.message : "Could not send");
      if (e instanceof Error && e.message.toLowerCase().includes("ended")) setStatus("ended");
    } finally {
      sendingRef.current = false;
      setBusy(false);
      refocusChatInput(inputRef.current);
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
    <>
    <LiveChatFrame
      scrollKey={msgs.length}
      header={
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="size-9 shrink-0 overflow-hidden rounded-full bg-elevated">
              <AdvisorMedia photo={advisor.photoUrl} video="" alt="" eager />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-ok" />
                <h1 className="truncate font-display text-base leading-tight text-fg">{advisor.name || "Advisor"}</h1>
              </div>
              <p className="truncate text-[11px] text-muted">
                {rate}c / min · {coinsSpent}c charged
                {status === "ended"
                  ? " · Session closed"
                  : included !== null && included > 0
                    ? ` · included ${formatClock(included)}`
                    : remaining > 0
                      ? ` · ${formatClock(remaining)} left`
                      : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <p className="font-display text-lg leading-none tabular-nums text-primary">{formatClock(seconds)}</p>
            <div className="flex gap-2">
              <button type="button" className="text-[11px] text-muted" onClick={() => setBlockOpen(true)}>
                {blockedByMe ? "Unblock" : "Block"}
              </button>
              <button type="button" className="text-[11px] text-muted" onClick={() => setReportOpen(true)}>
                Report
              </button>
            </div>
          </div>
        </div>
      }
      banner={
        status === "live" && lowBalance ? (
          <div>
            <p className="text-xs text-warn">Balance is almost gone. Add coins or this sitting ends.</p>
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-0.5">
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
        ) : undefined
      }
      footer={
        status === "ended" ? (
          <div className="space-y-3 py-1">
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
          <LiveChatComposer>
            {!asked ? (
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-left text-[11px] text-muted"
                    onPointerDown={keepChatKeyboard}
                    onMouseDown={keepChatKeyboard}
                    onClick={() => void send(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <LiveChatReplyInput
                inputRef={inputRef}
                value={draft}
                onChange={(e) => setDraft(chatDraftFromInput(draft, e))}
                placeholder="Ask what you need to know"
              />
              <Button
                type="submit"
                size="icon"
                className="size-11 shrink-0 rounded-full"
                disabled={!draft.trim() || chatMessageOverLimit(draft)}
                aria-label="Send"
                onPointerDown={keepChatKeyboard}
                onMouseDown={keepChatKeyboard}
              >
                <Send />
              </Button>
            </form>
            <div className="flex items-center justify-between gap-3">
              <ChatWordMeter value={draft} className="mt-0" />
              <button
                type="button"
                className="shrink-0 py-1 text-xs text-muted hover:text-fg"
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
            </div>
          </LiveChatComposer>
        )
      }
    >
      {msgs.map((m) => (
        <div key={m.id} className={cn("flex", m.role === "advisor" ? "justify-start" : "justify-end")}>
          <p
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              m.role === "client" ? "bg-primary text-primary-fg" : "bg-elevated text-fg",
            )}
          >
            {m.body}
          </p>
        </div>
      ))}
    </LiveChatFrame>
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
    </>
  );
}

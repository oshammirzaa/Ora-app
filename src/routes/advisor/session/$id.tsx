import { createFileRoute, Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorShell } from "@/components/advisor-shell";
import { ReminderDialog, ReportDialog } from "@/components/advisor-desk";
import { BlockConfirmDialog } from "@/components/safety-dialogs";
import { ChatWordMeter } from "@/components/chat-word-meter";
import { ChatImagePreview, EmojiPhotoButtons } from "@/components/chat-composer-tools";
import { ChatTip } from "@/components/send-tip-modal";
import { ChatPhoto } from "@/components/chat-photo";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { LiveChatFrame, LiveChatComposer, LiveChatReplyInput, keepChatKeyboard, refocusChatInput } from "@/components/live-chat-frame";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  endReading,
  formatClock,
  getReading,
  listMessages,
  mergeMessages,
  sameMessages,
  parseRate,
  sendAdvisorMessage,
  syncReading,
  type ChatMsg,
} from "@/lib/ora";
import { readingFollowUpState, sendReadingFollowUp, advisorSessionClientNotes, advisorClientProfile, setAdvisorBlock } from "@/lib/ora-advisor-desk";
import { advisorSafetyNotice } from "@/lib/ora-compliance-api";
import { chatDraftFromInput, chatMessageOverLimit } from "@/lib/ora-chat-words";
import { useIncomingMessageSound } from "@/lib/use-incoming-message-sound";
import type { LoyaltyTier } from "@/lib/ora-loyalty";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/advisor/session/$id")({ component: SessionPage });

function SessionPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [clientName, setClientName] = useState("Client");
  const [clientId, setClientId] = useState("");
  const [loyaltyTier, setLoyaltyTier] = useState<LoyaltyTier>("none");
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<"live" | "ended">("live");
  const [rate, setRate] = useState(0);
  const [earned, setEarned] = useState(0);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState("");
  const [heard, setHeard] = useState(false);
  const [busy, setBusy] = useState(false);
  const sendingRef = useRef(false);
  const followSendingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [followUp, setFollowUp] = useState<Awaited<ReturnType<typeof readingFollowUpState>> | null>(null);
  const [followDraft, setFollowDraft] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [privateNotes, setPrivateNotes] = useState<Array<{ id: string; body: string; createdAt: string }>>([]);
  const [safetyNotice, setSafetyNotice] = useState("");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getReading({ data: { id } }).then((r) => {
      if (cancelled || !r) return;
      setClientName(r.clientName || "Client");
      setClientId(r.clientId || "");
      setLoyaltyTier(r.clientLoyaltyTier || "none");
      setSeconds(Number(r.seconds) || 0);
      setStatus(r.status === "ended" ? "ended" : "live");
      setRate(parseRate(r.rateCoins) ?? 0);
      setEarned(Number(r.advisorEarned) || 0);
      void listMessages({ data: { id } })
        .then(setMsgs)
        .catch(() => {});
      void advisorSessionClientNotes({ data: { readingId: id } })
        .then((res: { notes?: Array<{ id: string; body: string; createdAt: string }> }) => setPrivateNotes(res.notes || []))
        .catch(() => setPrivateNotes([]));
      if (r.clientId) {
        void advisorSafetyNotice({ data: { customerId: r.clientId } })
          .then((note) => {
            if (!cancelled) setSafetyNotice(note.notice || "");
          })
          .catch(() => {});
        void advisorClientProfile({ data: { customerId: r.clientId } })
          .then((p: { blockedByMe?: boolean }) => {
            if (!cancelled) setBlockedByMe(Boolean(p.blockedByMe));
          })
          .catch(() => {});
      }
      if (r.status === "ended") {
        void readingFollowUpState({ data: { readingId: id } })
          .then(setFollowUp)
          .catch(() => setFollowUp(null));
      }
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
          if (res.status === "ended") {
            void readingFollowUpState({ data: { readingId: id } })
              .then(setFollowUp)
              .catch(() => {});
          }
          const nextRate = parseRate(res.rateCoins);
          if (nextRate) setRate(nextRate);
          if (Number.isFinite(Number(res.advisorEarned))) setEarned(Number(res.advisorEarned));
          const incoming = Array.isArray(res.messages) ? res.messages : null;
          if (incoming) {
            setMsgs((cur) => {
              const next = mergeMessages([], incoming);
              if (next.length === 0 && cur.length > 0) return cur;
              return sameMessages(cur, next) ? cur : next;
            });
          }
          setHeard(true);
        })
        .catch(() => {});
    },
    3500,
    Boolean(userId) && status === "live",
  );

  useIncomingMessageSound(msgs, "advisor", heard && status === "live", id, clientName || "Client");

  useVisibleInterval(
    () => {
      setSeconds((s) => s + 1);
    },
    1000,
    status === "live",
    false,
  );

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && !image) || busy || sendingRef.current || status !== "live" || chatMessageOverLimit(body)) return;
    const photo = image;
    sendingRef.current = true;
    setBusy(true);
    setDraft("");
    setImage("");
    refocusChatInput(inputRef.current);
    try {
      const msg = await sendAdvisorMessage({ data: { id, body, image: photo } });
      setMsgs((m) => mergeMessages(m, [msg]));
    } catch (err) {
      setDraft(body);
      if (photo) setImage(photo);
      toast.error(err instanceof Error ? err.message : "Could not send");
      if (err instanceof Error && err.message.toLowerCase().includes("ended")) setStatus("ended");
    } finally {
      sendingRef.current = false;
      setBusy(false);
      refocusChatInput(inputRef.current);
    }
  }

  async function stop() {
    await endReading({ data: { id } });
    setStatus("ended");
    try {
      setFollowUp(await readingFollowUpState({ data: { readingId: id } }));
    } catch {
      setFollowUp(null);
    }
  }

  async function sendFollowUp() {
    const body = followDraft.trim();
    if (!body || followBusy || followSendingRef.current || chatMessageOverLimit(body)) return;
    followSendingRef.current = true;
    setFollowBusy(true);
    try {
      await sendReadingFollowUp({ data: { readingId: id, body } });
      setFollowDraft("");
      setFollowUp(await readingFollowUpState({ data: { readingId: id } }));
      toast.success("Follow-up sent. The client will see it in notifications.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send follow-up");
    } finally {
      followSendingRef.current = false;
      setFollowBusy(false);
    }
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
      <LiveChatFrame
        scrollKey={msgs.length}
        header={
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-ok" />
                <ClientNameWithBadge
                  as="h1"
                  name={clientName}
                  tier={loyaltyTier}
                  className="min-w-0 font-display text-base leading-tight text-fg"
                  nameClassName="font-display text-base leading-tight text-fg"
                />
              </div>
              <p className="truncate text-[11px] text-muted">
                {rate}c / min · you {earned}c
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <p className="font-display text-lg leading-none tabular-nums text-primary">{formatClock(seconds)}</p>
              {clientId ? (
                <div className="flex gap-2">
                  <button type="button" className="text-[11px] text-muted" onClick={() => setBlockOpen(true)}>
                    {blockedByMe ? "Unblock" : "Block"}
                  </button>
                  <button type="button" className="text-[11px] text-muted" onClick={() => setReportOpen(true)}>
                    Report
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        }
        banner={
          privateNotes.length ? (
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs text-fg">
                <span className="mr-1.5 text-[10px] tracking-[0.14em] text-faint uppercase">Notes</span>
                {privateNotes[0]?.body}
              </p>
              {clientId ? (
                <Link
                  to="/advisor/customers/$id"
                  params={{ id: clientId }}
                  hash="notes"
                  preload={false}
                  className="shrink-0 text-xs text-primary"
                >
                  View all
                </Link>
              ) : null}
            </div>
          ) : undefined
        }
        footer={
          status === "ended" ? (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted">
                Session ended. {formatClock(seconds)} · you earned {earned}c.
              </p>
              {followUp?.alreadySent ? (
                <p className="text-sm text-ok">Follow-up sent. The client will see it in notifications.</p>
              ) : followUp?.canSend ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendFollowUp();
                  }}
                >
                  <p className="text-sm text-fg">Send one follow-up to this client.</p>
                  <Textarea
                    value={followDraft}
                    onChange={(e) => setFollowDraft(chatDraftFromInput(followDraft, e))}
                    placeholder="A short note after the sitting…"
                    className="min-h-24"
                  />
                  <ChatWordMeter value={followDraft} />
                  <Button type="submit" className="w-full" disabled={followBusy || !followDraft.trim() || chatMessageOverLimit(followDraft)}>
                    {followBusy ? "Sending…" : "Send follow-up"}
                  </Button>
                </form>
              ) : followUp?.waitingForReply ? (
                <p className="text-sm text-muted">Waiting for the client's reply</p>
              ) : null}
              {clientId ? (
                <Button type="button" variant="outline" className="w-full" onClick={() => setRemindOpen(true)}>
                  Set follow-up reminder
                </Button>
              ) : null}
              <Button asChild variant="outline" className="w-full">
                <Link to="/advisor" preload={false}>
                  Back to desk
                </Link>
              </Button>
              <ReminderDialog
                open={remindOpen}
                name={clientName}
                customerId={clientId}
                onOpenChange={setRemindOpen}
              />
            </div>
          ) : (
            <LiveChatComposer>
              {safetyNotice ? <p className="px-3 pt-2 text-xs text-warn">{safetyNotice}</p> : null}
              <form onSubmit={send} className="flex flex-col">
                <ChatImagePreview image={image} onCancel={() => setImage("")} />
                <div className="flex items-end gap-1.5">
                  <EmojiPhotoButtons draft={draft} setDraft={setDraft} inputRef={inputRef} setImage={setImage} />
                  <LiveChatReplyInput
                    inputRef={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(chatDraftFromInput(draft, e))}
                    placeholder="Reply…"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="size-11 shrink-0 rounded-full"
                    disabled={(!draft.trim() && !image) || chatMessageOverLimit(draft)}
                    aria-label="Send"
                    onPointerDown={keepChatKeyboard}
                    onMouseDown={keepChatKeyboard}
                  >
                    <Send />
                  </Button>
                </div>
              </form>
              <div className="flex items-center justify-between gap-3">
                <ChatWordMeter value={draft} className="mt-0" />
                <button type="button" className="shrink-0 py-1 text-xs text-muted hover:text-fg" onClick={() => void stop()}>
                  End session
                </button>
              </div>
            </LiveChatComposer>
          )
        }
      >
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "advisor" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "advisor" ? "bg-primary text-primary-fg" : "bg-lilac text-fg shadow-[var(--shadow-border)]",
              )}
            >
              {m.image ? <ChatPhoto src={m.image} light={m.role === "advisor"} /> : null}
              {m.tipGift ? <ChatTip giftId={m.tipGift} /> : m.body ? <p className={m.image ? "mt-1.5" : ""}>{m.body}</p> : null}
            </div>
          </div>
        ))}
      </LiveChatFrame>
      <ReportDialog
        open={reportOpen}
        name={clientName}
        customerId={clientId}
        readingId={id}
        onOpenChange={setReportOpen}
      />
      <BlockConfirmDialog
        open={blockOpen}
        name={clientName}
        blocking={!blockedByMe}
        onConfirm={async () => {
          await setAdvisorBlock({ data: { customerId: clientId, blocked: !blockedByMe } });
          setBlockedByMe(!blockedByMe);
          toast.success(
            blockedByMe
              ? "Client unblocked."
              : "Client blocked. They cannot start new messages or live readings after this session.",
          );
        }}
        onOpenChange={setBlockOpen}
      />
    </AdvisorShell>
  );
}

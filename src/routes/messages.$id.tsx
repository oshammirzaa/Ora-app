import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorMedia } from "@/components/advisor-media";
import { AppShell } from "@/components/app-shell";
import { ChatImagePreview, EmojiPhotoButtons } from "@/components/chat-composer-tools";
import { ChatPhoto } from "@/components/chat-photo";
import { ChatWordMeter } from "@/components/chat-word-meter";
import { BlockConfirmDialog, SafetyReportDialog } from "@/components/safety-dialogs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatWhen } from "@/lib/ora";
import { getCustomerMessageThread, sendCustomerInboxMessage } from "@/lib/ora-paid-messages-api";
import { setCustomerBlock } from "@/lib/ora-safety-api";
import { chatDraftFromInput, chatMessageOverLimit } from "@/lib/ora-chat-words";
import { useIncomingMessageSound } from "@/lib/use-incoming-message-sound";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$id")({
  component: CustomerMessagePage,
});

function CustomerMessagePage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [thread, setThread] = useState<Awaited<ReturnType<typeof getCustomerMessageThread>> | null>(null);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [needCoins, setNeedCoins] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const requestIdRef = useRef("");
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  async function load() {
    const next = await getCustomerMessageThread({ data: { advisorId: id } });
    setThread(next);
    return next;
  }

  useEffect(() => {
    if (!user) {
      setThread(null);
      setReady(false);
      return;
    }
    setReady(false);
    void load()
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not open messages"))
      .finally(() => setReady(true));
  }, [user, id]);

  useIncomingMessageSound(thread?.messages || [], "customer", Boolean(user) && ready, id, thread?.advisorName || "Advisor");

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(overlap > 80 ? overlap : 0);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  useVisibleInterval(
    () => {
      if (!user) return;
      void load().catch(() => {});
    },
    4000,
    Boolean(user),
    false,
  );

  async function send(confirmPaid = false) {
    const body = draft.trim();
    if (busy || sendingRef.current || !thread || chatMessageOverLimit(body)) return;
    if (!body && !image) return;
    if (thread.blocked) {
      toast.error("This conversation is unavailable.");
      return;
    }
    if (thread.needsConfirm && !confirmPaid) {
      setConfirmOpen(true);
      return;
    }
    if (!thread.free && !thread.canPay) {
      setNeedCoins(true);
      return;
    }
    sendingRef.current = true;
    setBusy(true);
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    try {
      const res = await sendCustomerInboxMessage({
        data: {
          advisorId: thread.advisorId,
          body,
          image,
          requestId: requestIdRef.current,
          confirmPaid,
        },
      });
      if (!res.ok && res.reason === "confirm") {
        setConfirmOpen(true);
        setThread({ ...thread, ...res, messages: thread.messages });
        return;
      }
      if (!res.ok && res.reason === "insufficient") {
        setNeedCoins(true);
        setThread({ ...thread, ...res, messages: thread.messages });
        return;
      }
      if (res.ok) {
        setDraft("");
        setImage("");
        setNeedCoins(false);
        setConfirmOpen(false);
        requestIdRef.current = "";
        await load();
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(false);
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn />;

  const remaining = thread?.remainingFree ?? 0;
  const notice = thread?.notice;

  return (
    <AppShell tab="you" hideHeader>
      <main
        className="flex h-[calc(100dvh-4.6rem)] min-h-0 flex-col px-4 pt-3"
        style={keyboardInset ? { height: `calc(100dvh - 4.6rem - ${keyboardInset}px)` } : undefined}
      >
        <div className="flex items-center gap-3">
          <Link to="/messages" preload={false} className="flex size-10 items-center justify-center text-muted" aria-label="Back">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="size-10 overflow-hidden rounded-full bg-elevated">
            <AdvisorMedia photo={thread?.advisorPhoto || ""} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg text-fg">{thread?.advisorName || "Advisor"}</p>
            <p className="text-[11px] text-muted">Messages</p>
          </div>
          {thread ? (
            <div className="flex shrink-0 gap-2">
              <button type="button" className="text-xs text-muted" onClick={() => setBlockOpen(true)}>
                {thread.blockedByMe ? "Unblock" : "Block"}
              </button>
              <button type="button" className="text-xs text-muted" onClick={() => setReportOpen(true)}>
                Report
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {!thread?.messages.length ? (
            <p className="text-sm text-muted">Send a message whenever you need a little guidance.</p>
          ) : (
            thread.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm",
                  m.role === "customer"
                    ? "ml-8 bg-primary text-primary-fg"
                    : "mr-8 bg-lilac text-fg shadow-[var(--shadow-border)]",
                )}
              >
                {m.image ? <ChatPhoto src={m.image} light={m.role === "customer"} /> : null}
                {m.body ? <p className={m.image ? "mt-1.5" : ""}>{m.body}</p> : null}
                <p className={m.role === "customer" ? "mt-1 text-xs text-primary-fg/70" : "mt-1 text-xs text-faint"}>
                  {formatWhen(m.at)}
                </p>
              </div>
            ))
          )}
        </div>

        {needCoins ? (
          <div className="mt-3 rounded-2xl bg-elevated px-3.5 py-3 text-sm text-fg">
            <p>You need 2 coins to send this message.</p>
            <Button asChild className="mt-2 h-9 rounded-full px-4 text-xs">
              <Link to="/account">Add Coins</Link>
            </Button>
          </div>
        ) : null}

        {thread?.blocked ? (
          <p className="mt-3 text-[11px] text-muted">
            {thread.blockedByMe
              ? "You blocked this advisor. Unblock to send a new message. Past messages stay in history."
              : "New messages with this advisor are unavailable. Past messages stay in history."}
          </p>
        ) : notice ? (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            {notice.kind === "free" ? (
              <>
                ✨ {notice.intro}
                {notice.remaining ? (
                  <span className="mt-0.5 block text-primary">{notice.remaining}</span>
                ) : null}
              </>
            ) : (
              <>✨ 2 coins per message</>
            )}
          </p>
        ) : remaining > 0 ? (
          <p className="mt-3 text-[11px] text-muted">✨ {remaining} free messages left</p>
        ) : null}

        <form onSubmit={onSubmit} className="sticky bottom-0 z-20 shrink-0 bg-bg pt-2 pb-1">
          <ChatImagePreview image={image} onCancel={() => setImage("")} />
          <div className="flex flex-nowrap items-end gap-1.5">
            <EmojiPhotoButtons
              draft={draft}
              setDraft={setDraft}
              inputRef={inputRef}
              setImage={setImage}
              disabled={Boolean(thread?.blocked)}
            />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(chatDraftFromInput(draft, e))}
              placeholder="Write a message"
              disabled={Boolean(thread?.blocked)}
              className="h-11 w-0 min-w-0 flex-1 rounded-full bg-elevated px-4 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
            />
            <Button type="submit" size="icon" className="rounded-full" disabled={busy || (!draft.trim() && !image) || Boolean(thread?.blocked) || chatMessageOverLimit(draft)} aria-label="Send">
              <Send />
            </Button>
          </div>
        </form>
        <ChatWordMeter value={draft} />
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ready to continue?</DialogTitle>
            <DialogDescription>
              Your 3 free messages with this advisor have been used. Each new message costs 2 coins.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-full" onClick={() => void send(true)}>
              Send for 2 coins
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {thread ? (
        <>
          <BlockConfirmDialog
            open={blockOpen}
            name={thread.advisorName}
            blocking={!thread.blockedByMe}
            onConfirm={async () => {
              await setCustomerBlock({ data: { advisorId: thread.advisorId, blocked: !thread.blockedByMe } });
              toast.success(thread.blockedByMe ? "Advisor unblocked." : "Advisor blocked.");
              await load();
            }}
            onOpenChange={setBlockOpen}
          />
          <SafetyReportDialog
            open={reportOpen}
            name={thread.advisorName}
            advisorId={thread.advisorId}
            onOpenChange={setReportOpen}
          />
        </>
      ) : null}
    </AppShell>
  );
}

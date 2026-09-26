import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Coins, Flag, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeskSearch, EmptyState, FilterChips, Initials, ReminderDialog, ReportDialog, StatusPill } from "@/components/advisor-desk";
import { BlockConfirmDialog } from "@/components/safety-dialogs";
import { ChatImagePreview, EmojiPhotoButtons } from "@/components/chat-composer-tools";
import { ChatTip } from "@/components/send-tip-modal";
import { ChatPhoto } from "@/components/chat-photo";
import { ChatWordMeter } from "@/components/chat-word-meter";
import { MessageReceipt } from "@/components/message-receipt";
import { RecalledMessageLine, SentMessageBubble } from "@/components/message-recall";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  advisorInboxList,
  advisorThread,
  giftClientMinutes,
  requestClientPayment,
  sendAdvisorInboxMessage,
  sendReadingFollowUp,
  setAdvisorBlock,
} from "@/lib/ora-advisor-desk";
import { formatWhen } from "@/lib/ora";
import { applyLocalRecalls, recallInboxMessage } from "@/lib/ora-message-recall";
import { messageShowsAdvisorCoin } from "@/lib/ora-paid-messages";
import { notifyNewMessage, playMessageSound } from "@/lib/message-sound";
import { useIncomingMessageSound } from "@/lib/use-incoming-message-sound";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import type { InboxFilter } from "@/lib/ora-advisor-desk-stats";
import { advisorSafetyNotice } from "@/lib/ora-compliance-api";
import { chatDraftFromInput, chatMessageOverLimit } from "@/lib/ora-chat-words";

type InboxSearch = { client?: string };

export const Route = createFileRoute("/advisor/inbox")({
  validateSearch: (search: Record<string, unknown>): InboxSearch => ({
    client: typeof search.client === "string" && search.client.trim() ? search.client.trim() : undefined,
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { client } = Route.useSearch();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [q, setQ] = useState("");
  const [threads, setThreads] = useState<Awaited<ReturnType<typeof advisorInboxList>>["threads"]>([]);
  const [openId, setOpenId] = useState(client || "");
  const [thread, setThread] = useState<Awaited<ReturnType<typeof advisorThread>> | null>(null);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState("");
  const [threadReady, setThreadReady] = useState(false);
  const [working, setWorking] = useState(false);
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [safetyNotice, setSafetyNotice] = useState("");
  const recalledIds = useRef(new Set<string>());

  async function showThread(customerId: string) {
    const next = await advisorThread({ data: { customerId } });
    const painted = { ...next, messages: applyLocalRecalls(next.messages || [], recalledIds.current) };
    setThread(painted);
    return painted;
  }

  const loadList = useCallback(() => {
    return advisorInboxList({ data: { filter, q } })
      .then((d: any) => {
        setThreads(d.threads);
      })
      .catch(() => setThreads([]));
  }, [filter, q]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useVisibleInterval(() => {
    void loadList();
  }, 5000, true, false);

  useEffect(() => {
    if (client) setOpenId(client);
  }, [client]);

  useEffect(() => {
    if (!openId) {
      setThread(null);
      setThreadReady(false);
      return;
    }
    let cancelled = false;
    setThreadReady(false);
    void advisorThread({ data: { customerId: openId } })
      .then((next: any) => {
        if (!cancelled) setThread({ ...next, messages: applyLocalRecalls(next.messages || [], recalledIds.current) });
      })
      .catch((e: any) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not open thread");
      })
      .finally(() => {
        if (!cancelled) setThreadReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  useEffect(() => {
    if (!openId) {
      setSafetyNotice("");
      return;
    }
    void advisorSafetyNotice({ data: { customerId: openId } })
      .then((note) => setSafetyNotice(note.notice || ""))
      .catch(() => setSafetyNotice(""));
  }, [openId, thread?.messages?.length]);

  useVisibleInterval(() => {
    if (!openId) return;
    void advisorThread({ data: { customerId: openId } })
      .then((next: any) => setThread({ ...next, messages: applyLocalRecalls(next?.messages || [], recalledIds.current) }))
      .catch(() => {});
  }, 4000, Boolean(openId), false);

  const listUnread = useRef<number | null>(null);
  useIncomingMessageSound(thread?.messages || [], "advisor", Boolean(openId) && threadReady, openId, thread?.name || "Client");

  useEffect(() => {
    const total = threads.reduce((sum: number, row: { unread?: number }) => sum + (Number(row.unread) || 0), 0);
    if (!openId && listUnread.current != null && total > listUnread.current) {
      playMessageSound();
      notifyNewMessage("New message", "A client sent a message");
    }
    listUnread.current = total;
  }, [threads, openId]);

  async function send() {
    if (!openId || working || sendingRef.current || chatMessageOverLimit(draft) || thread?.blocked || thread?.optedOut || thread?.waitingForReply) return;
    if (!draft.trim() && !image) return;
    sendingRef.current = true;
    setWorking(true);
    const body = draft.trim();
    const photo = image;
    try {
      if (thread?.followUpReadingId && body && !photo) {
        await sendReadingFollowUp({ data: { readingId: thread.followUpReadingId, body } });
      } else {
        await sendAdvisorInboxMessage({ data: { customerId: openId, body, image: photo } });
      }
      setDraft("");
      setImage("");
      await showThread(openId);
      await loadList();
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      sendingRef.current = false;
      setWorking(false);
    }
  }

  async function gift() {
    if (!openId || working || sendingRef.current) return;
    sendingRef.current = true;
    setWorking(true);
    try {
      await giftClientMinutes({ data: { customerId: openId, seconds: 180 } });
      toast.success("Three free minutes sent.");
      await showThread(openId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not gift minutes");
    } finally {
      sendingRef.current = false;
      setWorking(false);
    }
  }

  async function pay() {
    if (!openId || working || sendingRef.current) return;
    sendingRef.current = true;
    setWorking(true);
    try {
      await requestClientPayment({ data: { customerId: openId, coins: 100 } });
      toast.success("Payment request sent.");
      await showThread(openId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request payment");
    } finally {
      sendingRef.current = false;
      setWorking(false);
    }
  }

  async function block() {
    if (!openId || working || sendingRef.current || !thread) return;
    sendingRef.current = true;
    setWorking(true);
    try {
      const next = !thread.blockedByMe;
      await setAdvisorBlock({ data: { customerId: openId, blocked: next } });
      toast.success(next ? "Client blocked. They cannot start new messages or live readings with you." : "Client unblocked.");
      await showThread(openId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update block");
    } finally {
      sendingRef.current = false;
      setWorking(false);
    }
  }

  if (thread) {
    return (
      <main className="flex min-h-[70dvh] flex-col">
        <button type="button" className="mb-3 text-left text-sm text-primary" onClick={() => setOpenId("")}>
          Back to inbox
        </button>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Initials name={thread.name} size="sm" />
            <div className="min-w-0">
              <ClientNameWithBadge name={thread.name} tier={thread.loyaltyTier} className="font-medium" />
              {thread.note ? <p className="truncate text-xs text-faint">{thread.note}</p> : null}
            </div>
          </div>
          {thread.liveReadingId ? (
            <Button asChild size="sm">
              <Link to="/advisor/session/$id" params={{ id: thread.liveReadingId }} preload={false}>
                Open live chat
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="mt-4 flex-1 space-y-2">
          {!thread.messages.length ? (
            <p className="text-sm text-muted">No messages yet. Follow up, gift minutes, or request coins.</p>
          ) : (
            thread.messages.map((m: any) =>
              m.recalled ? (
                <RecalledMessageLine key={m.id} mine={m.role === "advisor"} />
              ) : (
              <SentMessageBubble
                key={m.id}
                className={
                  m.role === "advisor"
                    ? "ml-8 rounded-2xl bg-primary px-3.5 py-2.5 text-sm text-primary-fg"
                    : "mr-8 rounded-2xl bg-lilac px-3.5 py-2.5 text-sm text-fg shadow-[var(--shadow-border)]"
                }
                onRecall={
                  m.role === "advisor" && !m.tipGift
                    ? async () => {
                        recalledIds.current.add(m.id);
                        try {
                          await recallInboxMessage({ data: { messageId: m.id } });
                          await showThread(openId);
                          await loadList();
                        } catch (err) {
                          recalledIds.current.delete(m.id);
                          throw err;
                        }
                      }
                    : undefined
                }
              >
                {m.image ? <ChatPhoto src={m.image} light={m.role === "advisor"} /> : null}
                {m.tipGift ? <ChatTip giftId={m.tipGift} /> : m.body ? <p className={m.image ? "mt-1.5" : ""}>{m.body}</p> : null}
                <p className={m.role === "advisor" ? "mt-1 text-xs text-primary-fg/70" : "mt-1 text-xs text-faint"}>
                  {formatWhen(m.at)}
                </p>
                {m.role === "advisor" ? <MessageReceipt receipt={m.receipt} onPrimary /> : null}
                {messageShowsAdvisorCoin(m.role, m.paidCoins) ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-gold" title="This message used coins">
                    <Coins className="size-3" />
                    {m.paidCoins}c
                  </p>
                ) : null}
              </SentMessageBubble>
              ),
            )
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={working} onClick={() => void gift()}>
            Send 3 free min
          </Button>
          <Button variant="outline" size="sm" disabled={working} onClick={() => void pay()}>
            Request 100c
          </Button>
          <Button variant="outline" size="sm" disabled={working} onClick={() => setBlockOpen(true)}>
            {thread.blockedByMe ? "Unblock" : "Block"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRemindOpen(true)}>
            <Bell className="size-4" />
            Remind
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
            <Flag className="size-4" />
            Report
          </Button>
        </div>
        {thread.blocked ? (
          <p className="mt-3 text-xs text-muted">This client is blocked. Unblock them before sending outreach.</p>
        ) : thread.optedOut ? (
          <p className="mt-3 text-xs text-muted">This client has opted out of advisor messages.</p>
        ) : thread.waitingForReply ? (
          <p className="mt-3 text-xs text-muted">Waiting for the client's reply</p>
        ) : thread.followUpReadingId ? (
          <p className="mt-3 text-xs text-muted">
            You can send a follow-up for the last completed reading.
          </p>
        ) : null}
        {safetyNotice ? <p className="mt-3 text-xs text-warn">{safetyNotice}</p> : null}
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <ChatImagePreview image={image} onCancel={() => setImage("")} />
          <div className="flex items-end gap-1.5">
            <EmojiPhotoButtons
              draft={draft}
              setDraft={setDraft}
              inputRef={inputRef}
              setImage={setImage}
              disabled={thread.blocked || thread.optedOut || thread.waitingForReply}
            />
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(chatDraftFromInput(draft, e))}
              placeholder={thread.followUpReadingId ? "Write a follow-up" : "Write a message"}
              disabled={thread.blocked || thread.optedOut || thread.waitingForReply}
            />
            <Button type="submit" size="icon" disabled={working || (!draft.trim() && !image) || thread.blocked || thread.optedOut || thread.waitingForReply || chatMessageOverLimit(draft)} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </div>
        </form>
        <ChatWordMeter value={draft} />
        <ReminderDialog
          open={remindOpen}
          name={thread.name}
          customerId={openId}
          onOpenChange={setRemindOpen}
        />
        <ReportDialog
          open={reportOpen}
          name={thread.name}
          customerId={openId}
          readingId={thread.liveReadingId || thread.followUpReadingId || ""}
          onOpenChange={setReportOpen}
        />
        <BlockConfirmDialog
          open={blockOpen}
          name={thread.name}
          blocking={!thread.blockedByMe}
          onConfirm={() => block()}
          onOpenChange={setBlockOpen}
        />
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <p className="text-xs tracking-wide text-faint uppercase">Show only</p>
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { id: "all", label: "All" },
          { id: "online", label: "Online" },
          { id: "paying", label: "Paying" },
          { id: "unread", label: "Unread" },
        ]}
      />
      <DeskSearch value={q} onChange={setQ} placeholder="Search by client name or notes" />
      {!threads.length ? (
        <EmptyState title="Inbox is quiet" body="Clients from live text chats and follow-ups will appear here." />
      ) : (
        <ul className="space-y-2">
          {threads.map((t: any) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(t.customerId)}
                className="flex min-h-14 w-full items-start gap-3 rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-border)]"
              >
                <Initials name={t.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <ClientNameWithBadge name={t.name} tier={t.loyaltyTier} className="min-w-0 font-medium" />
                    <p className="shrink-0 text-xs text-faint">{t.lastAt ? formatWhen(t.lastAt) : ""}</p>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">{t.lastBody || "No messages yet"}</p>
                  <div className="mt-2 flex gap-1">
                    {t.unread > 0 ? <StatusPill tone="warn">{t.unread} new</StatusPill> : null}
                    {t.paying ? <StatusPill tone="ok">Paying</StatusPill> : null}
                    {t.active ? <StatusPill tone="ok">Online</StatusPill> : null}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

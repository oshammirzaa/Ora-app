import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Flag, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeskSearch, EmptyState, FilterChips, Initials, MessageQuota, ReminderDialog, ReportDialog, StatusPill } from "@/components/advisor-desk";
import { BlockConfirmDialog } from "@/components/safety-dialogs";
import { ChatWordMeter } from "@/components/chat-word-meter";
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
import type { InboxFilter } from "@/lib/ora-advisor-desk-stats";
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
  const [sentToday, setSentToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [openId, setOpenId] = useState(client || "");
  const [thread, setThread] = useState<Awaited<ReturnType<typeof advisorThread>> | null>(null);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const loadList = useCallback(() => {
    return advisorInboxList({ data: { filter, q } })
      .then((d: any) => {
        setThreads(d.threads);
        setSentToday(d.sentToday);
        setDailyLimit(d.dailyLimit);
      })
      .catch(() => setThreads([]));
  }, [filter, q]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (client) setOpenId(client);
  }, [client]);

  useEffect(() => {
    if (!openId) {
      setThread(null);
      return;
    }
    void advisorThread({ data: { customerId: openId } })
      .then(setThread)
      .catch((e: any) => toast.error(e instanceof Error ? e.message : "Could not open thread"));
  }, [openId]);

  async function send() {
    if (!openId || !draft.trim() || working || sendingRef.current || chatMessageOverLimit(draft) || thread?.blocked || thread?.optedOut) return;
    sendingRef.current = true;
    setWorking(true);
    try {
      if (thread?.followUpReadingId) {
        await sendReadingFollowUp({ data: { readingId: thread.followUpReadingId, body: draft.trim() } });
      } else {
        await sendAdvisorInboxMessage({ data: { customerId: openId, body: draft.trim() } });
      }
      setDraft("");
      setThread(await advisorThread({ data: { customerId: openId } }));
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
      setThread(await advisorThread({ data: { customerId: openId } }));
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
      setThread(await advisorThread({ data: { customerId: openId } }));
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
      setThread(await advisorThread({ data: { customerId: openId } }));
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
            thread.messages.map((m: any) => (
              <div
                key={m.id}
                className={
                  m.role === "advisor"
                    ? "ml-8 rounded-2xl bg-primary px-3.5 py-2.5 text-sm text-primary-fg"
                    : "mr-8 rounded-2xl bg-surface px-3.5 py-2.5 text-sm text-fg shadow-[var(--shadow-border)]"
                }
              >
                <p>{m.body}</p>
                <p className={m.role === "advisor" ? "mt-1 text-xs text-primary-fg/70" : "mt-1 text-xs text-faint"}>
                  {formatWhen(m.at)}
                </p>
              </div>
            ))
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
        ) : thread.followUpReadingId ? (
          <p className="mt-3 text-xs text-muted">
            You can send a follow-up for the last completed reading.
          </p>
        ) : null}
        <div className="mt-3">
          <MessageQuota sent={thread.dailyLimit - thread.remainingToday} limit={thread.dailyLimit} />
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(chatDraftFromInput(draft, e))}
            placeholder={thread.followUpReadingId ? "Write a follow-up" : "Write a message"}
            disabled={thread.remainingToday <= 0 || thread.blocked || thread.optedOut}
          />
          <Button type="submit" size="icon" disabled={working || !draft.trim() || thread.remainingToday <= 0 || thread.blocked || thread.optedOut || chatMessageOverLimit(draft)} aria-label="Send">
            <Send className="size-4" />
          </Button>
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
      <MessageQuota sent={sentToday} limit={dailyLimit} />
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

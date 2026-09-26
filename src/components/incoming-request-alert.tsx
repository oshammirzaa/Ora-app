import { useEffect, useState } from "react";
import { Initials } from "@/components/advisor-desk";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import type { DeskRequest } from "@/lib/ora";
import { formatWhen } from "@/lib/ora";
import { ClientNoteButton } from "@/components/client-note-dialog";
import { syncLiveChatVoice, stopLiveChatVoice } from "@/lib/live-chat-voice";
import {
  formatAdvisorMinuteRate,
  formatPaidMinuteValue,
  formatWait,
  incomingClientInfoView,
  incomingQueueOthers,
  pickActiveIncomingRequest,
  shortClientId,
  waitingSeconds,
  walletBillingLabel,
  type WalletBillingKind,
} from "@/lib/ora-advisor-desk-stats";

function stopVibrate() {
  try {
    navigator.vibrate?.(0);
  } catch {
    /* vibration is best-effort */
  }
}

function vibrateIncoming() {
  try {
    navigator.vibrate?.([180, 90, 180, 90, 280]);
  } catch {
    /* vibration is best-effort */
  }
}

function useIncomingAlertFx(activeId: string) {
  useEffect(() => {
    if (!activeId) {
      stopVibrate();
      stopLiveChatVoice();
      return;
    }
    syncLiveChatVoice(activeId);
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      vibrateIncoming();
    };
    ring();
    const timer = window.setInterval(ring, 2400);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stopVibrate();
    };
  }, [activeId]);
}

export function IncomingRequestAlert({
  requests,
  workingId,
  onAccept,
  onDecline,
}: {
  requests: DeskRequest[];
  workingId: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const request = pickActiveIncomingRequest(requests);
  const waiting = incomingQueueOthers(requests, request?.id);
  const [now, setNow] = useState(Date.now());
  useIncomingAlertFx(request?.id || "");

  useEffect(() => {
    if (!request) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [request?.id]);

  if (!request) return null;

  const wait = formatWait(request.createdAt ? waitingSeconds(request.createdAt, now) : Number(request.waitingSeconds) || 0);
  const billing = walletBillingLabel((request.billingKind as WalletBillingKind) || "none");
  const clientId = String(request.clientId || "");
  const busy = Boolean(workingId);
  const info = incomingClientInfoView(request);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-blush/80 p-3 backdrop-blur-md sm:items-center sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ora-incoming-title"
      aria-describedby="ora-incoming-copy"
    >
      <div className="flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-y-auto rounded-[1.75rem] bg-surface px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border-hover)]">
        <div className="flex items-start justify-between gap-3">
          <p className="inline-flex flex-1 items-center justify-center gap-2 pl-9 text-[11px] font-medium tracking-[0.18em] text-gold uppercase">
            <span className="size-2 animate-pulse rounded-full bg-gold motion-reduce:animate-none" />
            Incoming reading
          </p>
          {clientId ? <ClientNoteButton customerId={clientId} /> : <span className="size-9" />}
        </div>
        <div className="mt-5 flex flex-col items-center text-center">
          <span className="rounded-full bg-lotus/40 p-1.5 ring-4 ring-gold/25">
            <Initials name={request.clientName} photo={request.photoUrl} size="lg" />
          </span>
          <h2 id="ora-incoming-title" className="mt-4">
            <ClientNameWithBadge
              name={request.clientName || "Client"}
              tier={request.loyaltyTier}
              className="justify-center font-display text-3xl tracking-tight"
              nameClassName="font-display text-3xl text-primary"
            />
          </h2>
          {clientId ? (
            <p className="mt-1 font-mono text-xs text-faint tabular-nums" title={clientId}>
              Client ID {shortClientId(clientId)}
            </p>
          ) : null}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-2xl bg-blush/70 px-3 py-2.5">
            <dt className="text-[10px] tracking-[0.14em] text-faint uppercase">Reading</dt>
            <dd className="mt-1 text-sm font-medium text-fg">{request.service || "Live text chat"}</dd>
          </div>
          <div className="rounded-2xl bg-blush/70 px-3 py-2.5">
            <dt className="text-[10px] tracking-[0.14em] text-faint uppercase">Your rate</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums text-fg">
              {formatAdvisorMinuteRate(Number(request.rateCoins) || 0)}
            </dd>
          </div>
        </dl>
        <section className="mt-3 rounded-2xl bg-blush/70 px-3 py-3 text-left" aria-label="Client info">
          <p className="text-[10px] tracking-[0.14em] text-faint uppercase">Client info</p>
          <p className="mt-1.5 text-sm font-medium text-fg">{info.label}</p>
          {info.showHistory ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <dt className="text-[10px] tracking-[0.12em] text-faint uppercase">Completed readings</dt>
                <dd className="mt-0.5 text-sm tabular-nums text-fg">{info.previousReadings}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-[0.12em] text-faint uppercase">Paid minutes</dt>
                <dd className="mt-0.5 text-sm tabular-nums text-fg">{formatPaidMinuteValue(info.paidMinutes)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] tracking-[0.12em] text-faint uppercase">Last reading</dt>
                <dd className="mt-0.5 text-sm text-fg">{info.lastReadingAt ? formatWhen(info.lastReadingAt) : "—"}</dd>
              </div>
              {info.favorited ? (
                <div className="col-span-2">
                  <dt className="text-[10px] tracking-[0.12em] text-faint uppercase">Favorite</dt>
                  <dd className="mt-0.5 text-sm text-fg">This client favorited you</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <div className="mt-1">
              <p className="text-xs text-muted">First sitting with you. No prior history.</p>
              {info.favorited ? <p className="mt-1 text-sm text-fg">This client favorited you</p> : null}
            </div>
          )}
        </section>
        <p id="ora-incoming-copy" className="mt-3 text-center text-xs text-faint">
          Waiting {wait}. {billing}. Billing starts when you accept.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            className="h-14 rounded-full text-base tracking-[0.12em] uppercase"
            disabled={busy}
            onClick={() => onAccept(request.id)}
          >
            Accept
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 rounded-full text-base tracking-[0.12em] uppercase"
            disabled={busy}
            onClick={() => onDecline(request.id)}
          >
            Decline
          </Button>
        </div>
        {waiting.length ? (
          <div className="mt-5 rounded-2xl bg-blush/60 px-3 py-3">
            <p className="text-[10px] tracking-[0.14em] text-faint uppercase">
              Incoming queue · {waiting.length} waiting
            </p>
            <ul className="mt-2 space-y-1.5">
              {waiting.slice(0, 4).map((item) => {
                const queued = incomingClientInfoView(item);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-fg">
                      {item.clientName || "Client"}
                      <span className="ml-1.5 text-[11px] font-normal text-muted">{queued.kind === "returning" ? "Returning" : "New"}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {formatWait(item.createdAt ? waitingSeconds(item.createdAt, now) : Number(item.waitingSeconds) || 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

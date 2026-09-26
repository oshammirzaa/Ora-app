import { useEffect, useRef } from "react";
import { freshIncomingIds, incomingAlertMessages } from "@/lib/ora-message-media";
import { notifyNewMessage, playMessageSound } from "@/lib/message-sound";

export function useIncomingMessageSound(
  messages: Array<{ id: string; role: string; body?: string; recalled?: boolean }>,
  ownRole: string,
  enabled: boolean,
  threadKey = "",
  label = "New message",
) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    seen.current = null;
  }, [threadKey]);

  useEffect(() => {
    if (!enabled) return;
    const audible = incomingAlertMessages(messages);
    const next = freshIncomingIds(seen.current, audible, ownRole);
    seen.current = next.seen;
    if (!next.ids.length) return;
    playMessageSound();
    const latest = [...audible].reverse().find((message) => next.ids.includes(message.id));
    notifyNewMessage(label, latest?.body?.trim() || "New message");
  }, [enabled, label, messages, ownRole, threadKey]);
}

import { useEffect, useRef, useState } from "react";
import { getAdvancedFlags, noteChatRecovery } from "@/lib/ora-advanced-api";

/** Pauses only the on-screen clock. Billing stays on the server. */
export function useChatRecovery(readingId: string, draft: string, setDraft: (value: string) => void) {
  const [enabled, setEnabled] = useState(false);
  const [offline, setOffline] = useState(false);
  const fails = useRef(0);
  const wasOffline = useRef(false);
  const restored = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    let stop = false;
    void getAdvancedFlags()
      .then((flags) => {
        if (!stop) setEnabled(Boolean(flags.chatRecovery));
      })
      .catch(() => {
        if (!stop) setEnabled(false);
      });
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const key = `ora-draft:${readingId}`;
    if (!restored.current) {
      restored.current = true;
      const saved = window.sessionStorage.getItem(key);
      if (saved && !draftRef.current) setDraft(saved);
    }
    const online = () => setOffline(false);
    const lost = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", lost);
    if (window.navigator.onLine === false) setOffline(true);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", lost);
    };
  }, [enabled, readingId, setDraft]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const key = `ora-draft:${readingId}`;
    if (draft) window.sessionStorage.setItem(key, draft);
    else window.sessionStorage.removeItem(key);
  }, [enabled, readingId, draft]);

  useEffect(() => {
    if (!enabled) return;
    if (wasOffline.current && !offline) {
      void noteChatRecovery({ data: { readingId, kind: "reconnected" } }).catch(() => {});
    }
    wasOffline.current = offline;
  }, [enabled, offline, readingId]);

  function noteSync(ok: boolean) {
    if (!enabled) return;
    if (ok) {
      fails.current = 0;
      setOffline(false);
      return;
    }
    fails.current += 1;
    if (fails.current >= 2) setOffline(true);
  }

  return { offline: enabled && offline, noteSync, pauseLocalTimer: enabled && offline };
}

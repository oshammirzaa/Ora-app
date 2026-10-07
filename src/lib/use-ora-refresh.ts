import { useEffect, useRef } from "react";

type RefreshHandler = () => Promise<unknown> | unknown;

const handlers = new Set<RefreshHandler>();

/** Pages register the fetch they already use. Pull-to-refresh runs each one without a full reload. */
export function useOraRefresh(handler: RefreshHandler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const run = () => ref.current();
    handlers.add(run);
    return () => {
      handlers.delete(run);
    };
  }, []);
}

let inflight: Promise<unknown> | null = null;

export function runOraRefresh() {
  if (inflight) return inflight;
  inflight = Promise.all([...handlers].map((run) => Promise.resolve(run()).catch(() => undefined))).finally(() => {
    inflight = null;
  });
  return inflight;
}

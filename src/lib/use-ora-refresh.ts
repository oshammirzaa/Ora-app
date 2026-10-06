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

export function runOraRefresh() {
  return Promise.all([...handlers].map((run) => Promise.resolve(run()).catch(() => undefined)));
}

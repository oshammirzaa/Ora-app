import { useEffect, useRef } from "react";

/** Run `fn` on a timer only while the tab is visible. Pauses in background. Skips overlapping ticks. */
export function useVisibleInterval(
  fn: () => void | Promise<void>,
  ms: number,
  enabled = true,
  fireOnStart = true,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    let running = false;
    const tick = () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      Promise.resolve(fnRef.current()).finally(() => {
        running = false;
      });
    };
    const stop = () => {
      if (id) window.clearInterval(id);
      id = 0;
    };
    const start = () => {
      stop();
      id = window.setInterval(tick, ms);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      tick();
      start();
    };
    if (document.visibilityState !== "hidden") {
      if (fireOnStart) tick();
      start();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled, fireOnStart]);
}

import { useEffect, useRef } from "react";

/** Run `fn` on a timer only while the tab is visible, unless `pauseWhenHidden` is false. */
export function useVisibleInterval(
  fn: () => void | Promise<void>,
  ms: number,
  enabled = true,
  fireOnStart = true,
  pauseWhenHidden = true,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    let running = false;
    const tick = () => {
      if (running) return;
      if (pauseWhenHidden && document.visibilityState === "hidden") return;
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
      if (pauseWhenHidden && document.visibilityState === "hidden") {
        stop();
        return;
      }
      tick();
      start();
    };
    if (!pauseWhenHidden || document.visibilityState !== "hidden") {
      if (fireOnStart) tick();
      start();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled, fireOnStart, pauseWhenHidden]);
}

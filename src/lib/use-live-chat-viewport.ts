import { useLayoutEffect, useRef } from "react";

/**
 * Size a full-screen chat shell to the visual viewport so Android/iOS
 * keyboards shrink the chat instead of scrolling the page behind it.
 */
export function useLiveChatViewport<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const html = document.documentElement;
    html.classList.add("ora-live-chat-lock");
    const vv = window.visualViewport;

    const apply = () => {
      const height = Math.max(1, Math.round(vv?.height || window.innerHeight));
      const width = Math.max(1, Math.round(vv?.width || window.innerWidth));
      const offsetTop = Math.round(vv?.offsetTop || 0);
      const offsetLeft = Math.round(vv?.offsetLeft || 0);
      const keyboard = height < window.innerHeight - 80 || offsetTop > 0;
      html.style.setProperty("--ora-vvh", `${height}px`);
      node.style.position = "fixed";
      node.style.top = `${offsetTop}px`;
      node.style.left = `${offsetLeft}px`;
      node.style.right = "auto";
      node.style.bottom = "auto";
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
      node.style.maxHeight = `${height}px`;
      node.style.minHeight = `${height}px`;
      node.style.transform = "none";
      node.dataset.keyboard = keyboard ? "open" : "closed";
      window.scrollTo(0, 0);
    };

    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      html.classList.remove("ora-live-chat-lock");
      html.style.removeProperty("--ora-vvh");
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return ref;
}

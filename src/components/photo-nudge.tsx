import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  PHOTO_NUDGE_COPY,
  photoNudgeQuietPath,
} from "@/lib/ora-photo-nudge";
import { dismissPhotoNudge, getPhotoNudge } from "@/lib/ora-photo-nudge-api";

export function PhotoNudge() {
  const { user, isPending } = useCurrentUserState();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);
  const quiet = photoNudgeQuietPath(path);
  const hasPhoto = Boolean(user?.profileImageUrl);

  useEffect(() => {
    if (isPending || !user || hasPhoto) {
      setVisible(false);
      return;
    }
    let alive = true;
    let timer = 0;
    const load = () => {
      void getPhotoNudge()
        .then((state) => {
          if (!alive) return;
          if (state.hasPhoto || !state.show) {
            setVisible(false);
            if (state.waitMs > 0 && !state.hasPhoto) {
              if (timer) window.clearTimeout(timer);
              timer = window.setTimeout(load, Math.min(state.waitMs + 250, PHOTO_WAIT_CAP));
            }
            return;
          }
          setVisible(true);
        })
        .catch(() => {
          if (alive) setVisible(false);
        });
    };
    load();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [user?.id, isPending, hasPhoto]);

  if (!visible || quiet || !user || hasPhoto) return null;

  async function dismiss(e?: MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setVisible(false);
    try {
      await dismissPhotoNudge();
    } catch {
      /* overlay is already closed; next visit re-reads persisted state */
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.25rem] z-50 flex justify-center px-4">
      <aside
        className="pointer-events-auto relative w-full max-w-[398px] rounded-2xl bg-blush px-4 py-3 pr-10 shadow-[var(--shadow-border-hover)]"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          onClick={(e) => void dismiss(e)}
          className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full text-muted hover:bg-surface/80 hover:text-fg"
          aria-label="Dismiss"
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>
        <Link to="/me" hash="profile-photo" preload={false} className="block pr-2" onClick={() => setVisible(false)}>
          <p className="font-display text-lg leading-snug text-primary">{PHOTO_NUDGE_COPY.title}</p>
          <p className="mt-1 text-sm text-muted">{PHOTO_NUDGE_COPY.body}</p>
          <p className="mt-2 text-xs font-medium tracking-wide text-gold uppercase">Add photo</p>
        </Link>
      </aside>
    </div>
  );
}

const PHOTO_WAIT_CAP = 6 * 60_000;

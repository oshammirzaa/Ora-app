import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isMarketingHost } from "@/lib/ora-domains";
import { PHOTO_NUDGE_COPY, hasCustomerPhoto, photoNudgeQuietPath } from "@/lib/ora-photo-nudge";
import { getPhotoNudge } from "@/lib/ora-photo-nudge-api";

const OPEN_PHOTO_KEY = "ora-open-profile-photo";

/** Dismissed only until the app is backgrounded or the signed-in customer changes. */
let dismissedUserId = "";

export function PhotoNudge() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [resume, setResume] = useState(0);
  const hasPhoto = hasCustomerPhoto(user?.profileImageUrl);
  const quiet = photoNudgeQuietPath(path);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        dismissedUserId = "";
        setOpen(false);
        return;
      }
      setResume((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user || hasPhoto || quiet || isMarketingHost(window.location.hostname)) {
      setOpen(false);
      return;
    }
    if (dismissedUserId === user.id) return;
    let alive = true;
    void getPhotoNudge({ data: { at: Date.now() } })
      .then((state) => {
        if (!alive || dismissedUserId === user.id) return;
        setOpen(Boolean(state.eligible && !state.hasPhoto));
      })
      .catch(() => {
        if (!alive || dismissedUserId === user.id) return;
        if (path.startsWith("/advisor") || path.startsWith("/admin")) {
          setOpen(false);
          return;
        }
        setOpen(true);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, isPending, hasPhoto, quiet, path, resume]);

  if (!open || quiet || hasPhoto) return null;

  function later() {
    if (user) dismissedUserId = user.id;
    setOpen(false);
  }

  function addPhoto() {
    later();
    if (path === "/me") {
      document.getElementById("profile-photo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      const input = document.getElementById("profile-photo-file");
      if (input instanceof HTMLInputElement) input.click();
      return;
    }
    try {
      sessionStorage.setItem(OPEN_PHOTO_KEY, "1");
    } catch {
      /* private mode */
    }
    void navigate({ to: "/me", hash: "profile-photo" });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#2a2430]/45 px-4 pb-[max(5.5rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ora-photo-nudge-title"
        className="w-full max-w-[398px] rounded-2xl border border-gold/50 bg-surface px-5 py-5 shadow-[var(--shadow-border-hover)]"
      >
        <p id="ora-photo-nudge-title" className="font-display text-[1.65rem] leading-snug text-primary">
          {PHOTO_NUDGE_COPY.title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{PHOTO_NUDGE_COPY.body}</p>
        <Button type="button" className="mt-4 h-11 w-full rounded-full" onClick={addPhoto}>
          Add Photo
        </Button>
        <button type="button" className="mt-2 h-11 w-full rounded-full text-sm font-medium text-muted" onClick={later}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}

import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isMarketingHost } from "@/lib/ora-domains";
import {
  PHOTO_NUDGE_COPY,
  PHOTO_NUDGE_DELAY_MS,
  hasCustomerPhoto,
  normalizePhotoNudgeSession,
  photoNudgePresentation,
  photoNudgeQuietPath,
  type PhotoNudgeSession,
} from "@/lib/ora-photo-nudge";
import { getPhotoNudge } from "@/lib/ora-photo-nudge-api";

const SESSION_KEY = "ora-photo-nudge-session";
const OPEN_PHOTO_KEY = "ora-open-profile-photo";
let knownCustomerId = "";

let armedDue = 0;
let armedTimer = 0;
let armedFire: () => void = () => {};
let hiddenListener: (() => void) | null = null;

function clearHiddenListener() {
  if (typeof document === "undefined" || !hiddenListener) return;
  document.removeEventListener("visibilitychange", hiddenListener);
  hiddenListener = null;
}

function clearPhotoNudgeTimer() {
  if (armedTimer) window.clearTimeout(armedTimer);
  armedTimer = 0;
  armedDue = 0;
  clearHiddenListener();
}

function fireWhenVisible() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    clearHiddenListener();
    hiddenListener = () => {
      if (document.visibilityState !== "visible") return;
      clearHiddenListener();
      armedFire();
    };
    document.addEventListener("visibilitychange", hiddenListener);
    return;
  }
  armedFire();
}

/** One timer for the session. Navigation replaces the callback instead of starting another clock. */
function armPhotoNudgeTimer(dueAt: number, fire: () => void) {
  armedFire = fire;
  if (armedTimer && armedDue === dueAt) return;
  if (armedTimer) window.clearTimeout(armedTimer);
  clearHiddenListener();
  armedDue = dueAt;
  armedTimer = window.setTimeout(() => {
    armedTimer = 0;
    fireWhenVisible();
  }, Math.max(0, dueAt - Date.now()));
}

function readSession(now: number): PhotoNudgeSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PhotoNudgeSession>) : null;
    const session = normalizePhotoNudgeSession(parsed, now);
    if (!raw || session.startedAt !== parsed?.startedAt || session.later !== Boolean(parsed?.later)) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return session;
  } catch {
    const session = { startedAt: now, later: false };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* private mode */
    }
    return session;
  }
}

function writeLater(startedAt: number) {
  const session = { startedAt, later: true };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* private mode */
  }
  return session;
}

export function PhotoNudge() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [eligible, setEligible] = useState(() => Boolean(user && knownCustomerId === user.id && !hasCustomerPhoto(user.profileImageUrl)));
  const [later, setLater] = useState(false);
  const [due, setDue] = useState(false);
  const hasPhoto = hasCustomerPhoto(user?.profileImageUrl);
  const quiet = photoNudgeQuietPath(path);

  useEffect(() => {
    if (isPending) return;
    if (!user || hasPhoto || isMarketingHost(window.location.hostname)) {
      knownCustomerId = "";
      setEligible(false);
      setDue(false);
      clearPhotoNudgeTimer();
      return;
    }
    let alive = true;
    void getPhotoNudge()
      .then((state) => {
        if (!alive) return;
        const ok = state.eligible && !state.hasPhoto;
        knownCustomerId = ok ? user.id : "";
        setEligible(ok);
        if (!ok) {
          setDue(false);
          clearPhotoNudgeTimer();
        }
      })
      .catch(() => {
        if (!alive) return;
        if (knownCustomerId === user.id) return;
        setEligible(false);
        setDue(false);
        clearPhotoNudgeTimer();
      });
    return () => {
      alive = false;
    };
  }, [user?.id, isPending, hasPhoto]);

  useEffect(() => {
    if (!eligible || later || hasPhoto) {
      if (!eligible || later || hasPhoto) {
        setDue(false);
        if (!eligible || hasPhoto) clearPhotoNudgeTimer();
      }
      return;
    }
    const now = Date.now();
    const session = readSession(now);
    if (session.later) {
      setLater(true);
      setDue(false);
      clearPhotoNudgeTimer();
      return;
    }
    const dueAt = session.startedAt + PHOTO_NUDGE_DELAY_MS;
    const markDue = () => setDue(true);
    if (now >= dueAt) markDue();
    else {
      setDue(false);
      armPhotoNudgeTimer(dueAt, markDue);
    }
  }, [eligible, later, hasPhoto, user?.id]);

  const view = photoNudgePresentation({
    eligible,
    hasPhoto,
    quiet,
    later,
    startedAt: due ? Date.now() - PHOTO_NUDGE_DELAY_MS : Date.now(),
    now: Date.now(),
  });
  if (!view.show) return null;

  function suppressThisSession() {
    const session = readSession(Date.now());
    writeLater(session.startedAt);
    setLater(true);
    setDue(false);
    clearPhotoNudgeTimer();
  }

  function addPhoto() {
    suppressThisSession();
    if (path === "/me") {
      document.getElementById("profile-photo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      (document.getElementById("profile-photo-file") as HTMLInputElement | null)?.click();
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
        <button
          type="button"
          className="mt-2 h-11 w-full rounded-full text-sm font-medium text-muted"
          onClick={suppressThisSession}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

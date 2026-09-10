import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ReadingRoom } from "@/components/reading-room";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { endReading, getReading, parseRate, type Advisor } from "@/lib/ora";

export const Route = createFileRoute("/reading/$id")({ component: ReadingPage });

function ReadingPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [advisor, setAdvisor] = useState<Advisor | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [sessionRate, setSessionRate] = useState(0);
  const [coinsSpent, setCoinsSpent] = useState(0);
  const [status, setStatus] = useState<"live" | "ended">("live");
  const [reviewed, setReviewed] = useState(false);
  const [missing, setMissing] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getReading({ data: { id } }).then((r) => {
      if (cancelled) return;
      if (r?.advisor) {
        loadedRef.current = true;
        setAdvisor(r.advisor);
        setSeconds(Number(r.seconds) || 0);
        setSessionRate(parseRate(r.rateCoins) ?? parseRate(r.advisor.rateCoins) ?? 0);
        setCoinsSpent(Number(r.coinsSpent) || 0);
        setStatus(r.status === "ended" ? "ended" : "live");
        setReviewed(Boolean(r.reviewed));
        setMissing(false);
        return;
      }
      if (!loadedRef.current) setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  if (isPending) {
    return (
      <AppShell hideTab>
        <div className="h-40 animate-pulse bg-elevated" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function stop() {
    return endReading({ data: { id } });
  }

  if (missing) {
    return (
      <AppShell hideTab>
        <p className="px-4 py-20 text-center text-muted">That reading is gone.</p>
      </AppShell>
    );
  }

  if (!advisor) {
    return (
      <AppShell hideTab>
        <div className="h-40 animate-pulse bg-elevated" />
      </AppShell>
    );
  }

  return (
    <AppShell hideTab>
      <ReadingRoom
        readingId={id}
        advisor={advisor}
        initialSeconds={seconds}
        initialStatus={status}
        initialReviewed={reviewed}
        initialRate={sessionRate}
        initialCoinsSpent={coinsSpent}
        onEnd={() => stop()}
      />
    </AppShell>
  );
}

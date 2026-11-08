import { createFileRoute } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin-shell";
import { AdvisorMedia } from "@/components/advisor-media";
import { formatUsdPerMin } from "@/components/advisor-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRecommendedBoard, adminSaveRecommendations } from "@/lib/ora-recommended-api";
import { reorderRecommended, type RecommendedPick } from "@/lib/ora-recommended";

export const Route = createFileRoute("/admin/recommended")({ component: RecommendedPage });

type Board = Awaited<ReturnType<typeof adminRecommendedBoard>>;

function RecommendedPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [draft, setDraft] = useState<RecommendedPick[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState("");

  useEffect(() => {
    void adminRecommendedBoard()
      .then((next) => {
        setBoard(next);
        setDraft(next.draft);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load recommendations."));
  }, []);

  const names = useMemo(() => new Map((board?.advisors ?? []).map((row) => [row.id, row])), [board]);
  const results = (board?.advisors ?? []).filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q);
  });

  function place(advisorId: string, slot: number) {
    setDraft((cur) => {
      const without = cur.filter((row) => row.advisorId !== advisorId && row.slot !== slot);
      return [...without, { advisorId, slot }].sort((a, b) => a.slot - b.slot);
    });
  }

  async function save(publish: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await adminSaveRecommendations({ data: { picks: draft, publish } });
      setBoard(next);
      setDraft(next.draft);
      toast.success(publish ? "Recommendations published." : "Draft saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save recommendations.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Recommended Psychics"
        description="You choose all five advisors and their order. Earnings, reviews, and the Trusted Psychic leaderboard do not change these positions. The list stays until you edit it."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {board?.alerts.length ? (
        <p className="mb-3 rounded-xl bg-blush px-3 py-2 text-sm text-fg">
          Replace {board.alerts.join(", ")}. They are no longer approved, so customers do not see them.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Positions">
          <ul className="divide-y divide-[#ead9b0]">
            {draft.length ? (
              draft.map((pick) => {
                const advisor = names.get(pick.advisorId);
                return (
                  <li
                    key={pick.advisorId}
                    draggable={!busy}
                    onDragStart={() => setDragId(pick.advisorId)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!dragId) return;
                      setDraft((cur) => reorderRecommended(cur, dragId, pick.advisorId));
                      setDragId("");
                    }}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <GripVertical className="size-4 shrink-0 text-muted" />
                    <span className="w-8 font-medium text-primary">#{pick.slot}</span>
                    <span className="min-w-0 flex-1 truncate">{advisor?.name || pick.advisorId}</span>
                    <span className="text-xs text-muted">{advisor?.online ? "Online" : "Offline"}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setDraft((cur) => cur.filter((row) => row.advisorId !== pick.advisorId))}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-6 text-sm text-muted">Search an approved advisor and assign a position.</li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-[#ead9b0] px-3 py-3">
            <Button disabled={busy} variant="outline" onClick={() => void save(false)}>
              Save draft
            </Button>
            <Button disabled={busy} onClick={() => void save(true)}>
              Save and publish
            </Button>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Search advisors">
            <div className="p-3">
              <Input value={query} placeholder="Name or email" onChange={(event) => setQuery(event.target.value)} />
              <ul className="mt-3 space-y-2">
                {results.slice(0, 8).map((row) => (
                  <li key={row.id} className="rounded-xl bg-elevated px-3 py-2 text-sm">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted">{row.email || "No email"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[1, 2, 3, 4, 5].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className="rounded-full bg-surface px-2 py-1 text-xs text-primary"
                          onClick={() => place(row.id, slot)}
                        >
                          #{slot}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel title="Customer preview">
            <p className="px-3 pt-3 text-sm font-medium text-fg">Today's Top 5 Recommended Psychics</p>
            <ul className="space-y-2 p-3">
              {draft.length ? (
                draft.map((pick) => {
                  const advisor = names.get(pick.advisorId);
                  return (
                    <li key={pick.advisorId} className="flex items-center gap-3 rounded-2xl bg-elevated px-3 py-2">
                      <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg">
                        #{pick.slot}
                      </span>
                      <span className="size-10 overflow-hidden rounded-full bg-surface">
                        <AdvisorMedia photo={advisor?.photoUrl || ""} className="outline-none" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{advisor?.name || pick.advisorId}</span>
                        <span className="block truncate text-xs text-muted">
                          {advisor ? formatUsdPerMin(advisor.rateCoins) : "Rate on profile"} · {advisor?.online ? "Online" : "Offline"}
                        </span>
                      </span>
                      <span className="rounded-full bg-[#fbf6ea] px-2 py-0.5 text-[10px] font-medium text-[#8d6b32]">
                        Recommended Psychic
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="text-sm text-muted">Nothing selected. Customers will not see empty positions.</li>
              )}
            </ul>
            <p className="border-t border-[#ead9b0] px-3 py-2 text-xs text-muted">
              This is the draft. Customers see the published list only, with profile and chat buttons.
            </p>
          </Panel>
        </div>
      </div>
    </main>
  );
}

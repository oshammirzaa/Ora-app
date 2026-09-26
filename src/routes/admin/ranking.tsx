import { createFileRoute } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyNote, PageHeader, Panel } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhen } from "@/lib/ora";
import { adminRankingBoard, adminSaveRanking } from "@/lib/ora-admin-ranking-api";
import { matchesRankingQuery } from "@/lib/ora-manual-rank";

export const Route = createFileRoute("/admin/ranking")({ component: AdvisorRankingPage });

type Board = Awaited<ReturnType<typeof adminRankingBoard>>;
type Row = Board["advisors"][number];

function rankText(rank: number | null) {
  return rank == null ? "Unranked" : `Rank ${rank}`;
}

function moveId(ids: string[], fromId: string, toId: string) {
  if (!fromId || fromId === toId) return ids;
  const next = ids.filter((id) => id !== fromId);
  const index = next.indexOf(toId);
  if (index < 0) return ids;
  next.splice(index, 0, fromId);
  return next;
}

function AdvisorRankingPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState("");
  const [setRankFor, setSetRankFor] = useState<Row | null>(null);
  const [rankValue, setRankValue] = useState("1");

  async function load() {
    const next = await adminRankingBoard({ data: { t: Date.now() } });
    setBoard(next);
    setError("");
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Could not load advisor ranking."));
  }, []);

  async function save(data: { action: string; advisorId?: string; rank?: number; ids?: string[] }) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const next = await adminSaveRanking({ data });
      setBoard(next);
      toast.success("Ranking saved.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save that ranking.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const rows = board ? board.advisors.filter((row) => matchesRankingQuery(row, query)) : [];
  const searching = query.trim().length > 0;

  return (
    <main>
      <PageHeader
        title="Advisor Ranking"
        description="A separate manual order. It does not replace the automatic Trusted Psychics Top 10, which is calculated from the last 30 days."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <Panel title="Trusted Psychics Ranking">
        <Input
          className="mb-3"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, advisor ID, or email"
        />
        {!board ? (
          <div className="h-40 animate-pulse rounded-2xl bg-elevated" />
        ) : rows.length === 0 ? (
          <EmptyNote>{board.advisors.length === 0 ? "No active advisors yet." : "No advisors match that search."}</EmptyNote>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-faint uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Trusted rank</th>
                  <th className="px-3 py-3 font-medium">Advisor</th>
                  <th className="px-3 py-3 font-medium">Trusted badge status</th>
                  <th className="px-3 py-3 font-medium">Online / Offline</th>
                  <th className="px-3 py-3 font-medium">Rating</th>
                  <th className="px-3 py-3 font-medium">Reviews</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border/70"
                    draggable={!searching && !busy && row.manualRank != null}
                    onDragStart={() => setDragId(row.id)}
                    onDragOver={(event) => {
                      if (!searching && row.manualRank != null) event.preventDefault();
                    }}
                    onDrop={() => {
                      if (searching || !board || row.manualRank == null) return;
                      const ids = moveId(
                        board.advisors.filter((advisor) => advisor.manualRank != null).map((advisor) => advisor.id),
                        dragId,
                        row.id,
                      );
                      setDragId("");
                      const current = board.advisors.filter((advisor) => advisor.manualRank != null).map((advisor) => advisor.id);
                      if (ids.every((id, index) => id === current[index])) return;
                      void save({ action: "order", ids });
                    }}
                  >
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 font-medium tabular-nums">
                        <GripVertical className="size-4 text-faint" />
                        {row.manualRank ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        {row.photoUrl ? <img src={row.photoUrl} alt="" className="size-9 rounded-md object-cover" /> : null}
                        <span className="font-medium">{row.name}</span>
                      </span>
                    </td>
                    <td className={row.trusted ? "px-3 py-3 text-gold" : "px-3 py-3 text-muted"}>
                      {row.trusted ? "Trusted" : "Not trusted"}
                    </td>
                    <td className={row.online ? "px-3 py-3 text-ok" : "px-3 py-3 text-muted"}>{row.online ? "Online" : "Offline"}</td>
                    <td className="px-3 py-3 tabular-nums">{(Number(row.rating) || 0).toFixed(1)}</td>
                    <td className="px-3 py-3 tabular-nums">{row.reviews}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setSetRankFor(row);
                            setRankValue(String(row.manualRank ?? board.advisors.filter((advisor) => advisor.manualRank).length + 1));
                          }}
                        >
                          Set Rank
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void save({ action: "up", advisorId: row.id })}>
                          Move Up
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void save({ action: "down", advisorId: row.id })}>
                          Move Down
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy || !row.manualRank} onClick={() => void save({ action: "reset", advisorId: row.id })}>
                          Remove from Trusted
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {searching ? <p className="mt-2 text-xs text-faint">Clear the search to drag ranked advisors into a new order.</p> : null}
      </Panel>
      <Panel title="Rank history">
        {!board ? (
          <div className="h-24 animate-pulse rounded-2xl bg-elevated" />
        ) : board.history.length === 0 ? (
          <EmptyNote>No ranking changes yet.</EmptyNote>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-faint uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Advisor</th>
                  <th className="px-3 py-3 font-medium">Old rank</th>
                  <th className="px-3 py-3 font-medium">New rank</th>
                  <th className="px-3 py-3 font-medium">Changed by</th>
                  <th className="px-3 py-3 font-medium">Date and time</th>
                </tr>
              </thead>
              <tbody>
                {board.history.map((row) => (
                  <tr key={row.id} className="border-t border-border/70">
                    <td className="px-3 py-3 font-medium">{row.name}</td>
                    <td className="px-3 py-3 text-muted">{rankText(row.oldRank)}</td>
                    <td className="px-3 py-3 text-muted">{rankText(row.newRank)}</td>
                    <td className="px-3 py-3 text-muted">{row.changedBy || "—"}</td>
                    <td className="px-3 py-3 text-muted">{row.at ? formatWhen(row.at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Dialog open={Boolean(setRankFor)} onOpenChange={(next) => { if (!next) setSetRankFor(null); }}>
        {setRankFor ? (
          <DialogContent className="w-[min(100%-1.5rem,28rem)]">
            <DialogHeader>
              <DialogTitle>Set rank</DialogTitle>
              <DialogDescription>
                {setRankFor.name} moves to this manual position. Anyone already in that spot shifts down. This does not change the automatic Trusted Psychics list.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const rank = Number(rankValue);
                void save({ action: "set", advisorId: setRankFor.id, rank }).then((ok) => {
                  if (ok) setSetRankFor(null);
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="manual-rank">Rank</Label>
                <Input
                  id="manual-rank"
                  inputMode="numeric"
                  value={rankValue}
                  onChange={(event) => setRankValue(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                />
              </div>
              <Button type="submit" disabled={busy}>
                Save rank
              </Button>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </main>
  );
}

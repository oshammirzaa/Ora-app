/** Admin-picked Today's Top 5. Independent from earnings rank and Trusted Psychics. */

export const RECOMMENDED_LIMIT = 5;

export type RecommendedPick = { slot: number; advisorId: string };

export function cleanRecommendedDraft(
  picks: readonly { slot?: unknown; advisorId?: unknown }[],
  approvedIds: ReadonlySet<string>,
): RecommendedPick[] {
  const usedAdvisors = new Set<string>();
  const usedSlots = new Set<number>();
  const out: RecommendedPick[] = [];
  const ordered = [...picks].sort((a, b) => Number(a.slot) - Number(b.slot) || String(a.advisorId).localeCompare(String(b.advisorId)));
  for (const pick of ordered) {
    const slot = Math.trunc(Number(pick.slot));
    const advisorId = String(pick.advisorId || "").trim();
    if (!advisorId) continue;
    if (!Number.isInteger(slot) || slot < 1 || slot > RECOMMENDED_LIMIT) {
      throw new Error("Choose a position from 1 to 5.");
    }
    if (usedSlots.has(slot)) throw new Error("Each position can only be used once.");
    if (usedAdvisors.has(advisorId)) throw new Error("An advisor can only be recommended once.");
    if (!approvedIds.has(advisorId)) throw new Error("Choose an approved advisor.");
    usedSlots.add(slot);
    usedAdvisors.add(advisorId);
    out.push({ slot, advisorId });
  }
  return out.sort((a, b) => a.slot - b.slot);
}

export function reorderRecommended(picks: readonly RecommendedPick[], fromId: string, toId: string): RecommendedPick[] {
  const ordered = [...picks].sort((a, b) => a.slot - b.slot);
  const from = ordered.findIndex((row) => row.advisorId === fromId);
  const to = ordered.findIndex((row) => row.advisorId === toId);
  if (from < 0 || to < 0 || from === to) return ordered;
  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next.map((row, index) => ({ advisorId: row.advisorId, slot: index + 1 }));
}

export function publishedRecommendations<T extends { id: string; status?: string }>(
  picks: readonly RecommendedPick[],
  advisors: readonly T[],
): Array<T & { recommendSlot: number }> {
  const byId = new Map(advisors.map((row) => [row.id, row]));
  const out: Array<T & { recommendSlot: number }> = [];
  for (const pick of [...picks].sort((a, b) => a.slot - b.slot)) {
    const advisor = byId.get(pick.advisorId);
    if (!advisor) continue;
    if (advisor.status && advisor.status !== "live") continue;
    out.push({ ...advisor, recommendSlot: pick.slot });
  }
  return out;
}

export function unavailableRecommendations(
  picks: readonly RecommendedPick[],
  advisors: readonly { id: string; status?: string; name?: string }[],
) {
  const byId = new Map(advisors.map((row) => [row.id, row]));
  const names: string[] = [];
  for (const pick of [...picks].sort((a, b) => a.slot - b.slot)) {
    const advisor = byId.get(pick.advisorId);
    if (!advisor || (advisor.status && advisor.status !== "live")) names.push(advisor?.name || "An advisor");
  }
  return names;
}

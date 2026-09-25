/** Trusted Psychics order. Manual rank only. Other customer sections keep their own rules. */

export const MANUAL_RANK_SQL = [
  "alter table ora_advisors add column if not exists manual_rank integer",
  "create unique index if not exists ora_advisors_manual_rank_uidx on ora_advisors (manual_rank) where manual_rank is not null",
  `create table if not exists ora_advisor_rank_history (
    id text primary key,
    advisor_id text not null,
    old_rank integer,
    new_rank integer,
    actor_id text not null default '',
    created_at timestamptz not null default now()
  )`,
  "create index if not exists ora_advisor_rank_history_created_idx on ora_advisor_rank_history (created_at desc)",
];

let schemaReady = false;

type Query = (text: string, params?: unknown[]) => Promise<unknown>;

export async function ensureManualRankSchema(query: Query) {
  if (schemaReady) return;
  for (const statement of MANUAL_RANK_SQL) await query(statement);
  schemaReady = true;
}

export type RankSlot = {
  id: string;
  active: boolean;
  rank: number | null;
};

export type RankChange = {
  id: string;
  oldRank: number | null;
  newRank: number | null;
};

export type RankCommand =
  | { type: "set"; id: string; rank: number }
  | { type: "up"; id: string }
  | { type: "down"; id: string }
  | { type: "reset"; id: string }
  | { type: "order"; ids: string[] };

export type TrustedAdvisor = {
  manualRank: number | null;
  status?: string;
};

/** Homepage Trusted Psychics: active manual ranks only, strict rank order. */
export function trustedPsychics<T extends TrustedAdvisor>(advisors: T[]): T[] {
  return advisors
    .filter((advisor) => (!advisor.status || advisor.status === "live") && cleanManualRank(advisor.manualRank) != null)
    .sort((a, b) => cleanManualRank(a.manualRank)! - cleanManualRank(b.manualRank)!);
}

export function cleanManualRank(value: unknown): number | null {
  const rank = Math.floor(Number(value));
  if (!Number.isFinite(rank) || rank < 1) return null;
  return rank;
}

function activeRanked(slots: RankSlot[]): RankSlot[] {
  return slots
    .filter((slot) => slot.active && cleanManualRank(slot.rank) != null)
    .sort((a, b) => cleanManualRank(a.rank)! - cleanManualRank(b.rank)! || a.id.localeCompare(b.id));
}

function inactiveRanked(slots: RankSlot[]): RankSlot[] {
  return slots
    .filter((slot) => !slot.active && cleanManualRank(slot.rank) != null)
    .sort((a, b) => cleanManualRank(a.rank)! - cleanManualRank(b.rank)! || a.id.localeCompare(b.id));
}

function assign(slots: RankSlot[], orderedActiveIds: string[]): RankChange[] {
  const seen = new Set<string>();
  for (const id of orderedActiveIds) {
    if (seen.has(id)) throw new Error("Two advisors cannot share the same rank.");
    seen.add(id);
  }
  const next = new Map<string, number | null>();
  const taken = new Set<number>();
  orderedActiveIds.forEach((id, index) => {
    const rank = index + 1;
    next.set(id, rank);
    taken.add(rank);
  });
  let cursor = orderedActiveIds.length + 1;
  for (const slot of inactiveRanked(slots)) {
    let rank = cleanManualRank(slot.rank)!;
    if (taken.has(rank)) {
      while (taken.has(cursor)) cursor += 1;
      rank = cursor;
      cursor += 1;
    }
    next.set(slot.id, rank);
    taken.add(rank);
  }
  const changes: RankChange[] = [];
  for (const slot of slots) {
    const oldRank = cleanManualRank(slot.rank);
    const resolved = next.has(slot.id) ? next.get(slot.id)! : slot.active ? null : oldRank;
    if (oldRank !== resolved) changes.push({ id: slot.id, oldRank, newRank: resolved });
  }
  const used = new Set<number>();
  for (const slot of slots) {
    const change = changes.find((row) => row.id === slot.id);
    const rank = change ? change.newRank : cleanManualRank(slot.rank);
    if (rank == null) continue;
    if (used.has(rank)) throw new Error("Two advisors cannot share the same rank.");
    used.add(rank);
  }
  return changes;
}

function requireActive(slots: RankSlot[], id: string): RankSlot {
  const slot = slots.find((row) => row.id === id);
  if (!slot?.active) throw new Error("Only an active advisor can be ranked.");
  return slot;
}

/** Plan a unique manual order. Does not read ratings, reviews, earnings, or online flags. */
export function planManualRanks(slots: RankSlot[], command: RankCommand): RankChange[] {
  if (command.type === "order") {
    if (!command.ids.length) throw new Error("Choose an order.");
    const active = new Set(slots.filter((slot) => slot.active).map((slot) => slot.id));
    const seen = new Set<string>();
    for (const id of command.ids) {
      if (!active.has(id)) throw new Error("Only an active advisor can be ranked.");
      if (seen.has(id)) throw new Error("Each advisor can only appear once.");
      seen.add(id);
    }
    const omitted = activeRanked(slots)
      .map((slot) => slot.id)
      .filter((id) => !seen.has(id));
    return assign(slots, [...command.ids, ...omitted]);
  }
  const slot = requireActive(slots, command.id);
  const current = activeRanked(slots).map((row) => row.id);
  const position = current.indexOf(slot.id);
  if (command.type === "reset") {
    if (position < 0) return [];
    return assign(slots, current.filter((id) => id !== slot.id));
  }
  if (command.type === "up") {
    if (position < 0) return assign(slots, [...current, slot.id]);
    if (position === 0) return [];
    const next = [...current];
    const swap = next[position - 1]!;
    next[position - 1] = slot.id;
    next[position] = swap;
    return assign(slots, next);
  }
  if (command.type === "down") {
    if (position < 0 || position >= current.length - 1) return [];
    const next = [...current];
    const swap = next[position + 1]!;
    next[position + 1] = slot.id;
    next[position] = swap;
    return assign(slots, next);
  }
  const without = current.filter((id) => id !== slot.id);
  const max = without.length + 1;
  if (!Number.isInteger(command.rank) || command.rank < 1 || command.rank > max) {
    throw new Error(`Rank must be a whole number from 1 to ${max}.`);
  }
  const next = [...without];
  next.splice(command.rank - 1, 0, slot.id);
  if (next.length === current.length && next.every((id, index) => id === current[index])) return [];
  return assign(slots, next);
}

export function matchesRankingQuery(row: { id: string; name: string; email: string }, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.name, row.id, row.email].some((value) => value.toLowerCase().includes(q));
}

export async function writeManualRanks(
  query: Query,
  changes: RankChange[],
  actorId: string,
  nextId: () => string,
) {
  if (!changes.length) return;
  const clear = changes.map((change) => change.id);
  const clearSql = clear.map((_, index) => `$${index + 1}`).join(", ");
  await query(`update ora_advisors set manual_rank = null where id in (${clearSql})`, clear);
  const ranked = changes.filter((change): change is RankChange & { newRank: number } => change.newRank != null);
  if (ranked.length) {
    const params: unknown[] = [];
    const tuples = ranked.map((change) => {
      params.push(change.id, change.newRank);
      const base = params.length - 1;
      return `($${base}::text, $${base + 1}::int)`;
    });
    await query(
      `update ora_advisors as a set manual_rank = v.rank from (values ${tuples.join(", ")}) as v(id, rank) where a.id = v.id`,
      params,
    );
  }
  for (const change of changes) {
    await query(
      "insert into ora_advisor_rank_history (id, advisor_id, old_rank, new_rank, actor_id) values ($1, $2, $3, $4, $5)",
      [nextId(), change.id, change.oldRank, change.newRank, actorId.slice(0, 120)],
    );
  }
}

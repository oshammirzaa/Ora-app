export type PresenceState = "online" | "busy" | "offline";

export type PresenceBits = {
  id?: string;
  online?: boolean;
  busy?: boolean;
};

export const FLOOR_POLL_MS = 4_000;

export function presenceState(advisor: PresenceBits): PresenceState {
  if (Boolean(advisor.online) && Boolean(advisor.busy)) return "busy";
  if (Boolean(advisor.online)) return "online";
  return "offline";
}

export function presenceLabel(state: PresenceState): string {
  if (state === "online") return "Online";
  if (state === "busy") return "In Session";
  return "Offline";
}

/** Advisors currently in service, including those in a live sitting. */
export function onlineNowCount(rows: PresenceBits[]): number {
  return rows.reduce((n, row) => n + (row.online ? 1 : 0), 0);
}

export function presenceSortRank(advisor: PresenceBits): number {
  const state = presenceState(advisor);
  if (state === "online") return 0;
  if (state === "busy") return 1;
  return 2;
}

export function mergeFloor<T extends { id: string; online: boolean; busy: boolean }>(
  advisors: T[],
  floor: { id: string; online: boolean; busy: boolean }[],
): T[] {
  if (!floor.length) return advisors;
  const map = new Map(floor.map((row) => [row.id, row]));
  let changed = false;
  const next = advisors.map((advisor) => {
    const row = map.get(advisor.id);
    if (!row || (row.online === advisor.online && row.busy === advisor.busy)) return advisor;
    changed = true;
    return { ...advisor, online: row.online, busy: row.busy };
  });
  return changed ? next : advisors;
}

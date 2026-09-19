const listeners = new Set<() => void>();
let ids = new Set<string>();
let loaded = false;
let hydrating: Promise<void> | null = null;

function emit() {
  for (const fn of listeners) fn();
}

export function favoriteIds() {
  return ids;
}

export function isFavoriteId(id: string) {
  return ids.has(id);
}

export function rememberFavoriteIds(list: string[]) {
  ids = new Set(list);
  loaded = true;
  emit();
}

export function setFavoriteId(id: string, saved: boolean) {
  const next = new Set(ids);
  if (saved) next.add(id);
  else next.delete(id);
  ids = next;
  loaded = true;
  emit();
}

export function clearFavorites() {
  ids = new Set();
  loaded = false;
  hydrating = null;
  emit();
}

export function hydrateFavoriteIds(load: () => Promise<string[]>) {
  if (loaded) return hydrating;
  if (!hydrating) {
    hydrating = load()
      .then((list) => {
        rememberFavoriteIds(list);
      })
      .catch(() => {
        loaded = true;
      })
      .finally(() => {
        hydrating = null;
      });
  }
  return hydrating;
}

export function subscribeFavorites(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

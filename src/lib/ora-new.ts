/** Live advisors flagged new in the database, newest created/approved first. Does not invent is_new. */
export function newPsychics<T extends { isNew: boolean; createdAt?: string; name?: string }>(advisors: T[]): T[] {
  return [...advisors]
    .filter((a) => a.isNew)
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt || "") || 0;
      const tb = Date.parse(b.createdAt || "") || 0;
      if (tb !== ta) return tb - ta;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

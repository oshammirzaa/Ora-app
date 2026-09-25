export function matchesAdvisorQuery(
  row: { name: string; email: string; id: string },
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.name.toLowerCase().includes(needle) ||
    row.email.toLowerCase().includes(needle) ||
    row.id.toLowerCase().includes(needle)
  );
}

export function advisorRatingFromReviews(rows: Array<{ rating: number; hidden?: boolean }>) {
  const visible = rows.filter((row) => !row.hidden && Number.isFinite(row.rating));
  if (!visible.length) return { rating: 0, reviews: 0 };
  const sum = visible.reduce((total, row) => total + row.rating, 0);
  return { rating: Math.round((sum / visible.length) * 10) / 10, reviews: visible.length };
}

// Display formatting shared across the students feature. Money is integer MNT
// (schema.md § Money) — grouped digits with the tugrik sign, never a "$".

const mntFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatMnt(amount: number): string {
  return `${mntFormatter.format(amount)}₮`;
}

// Plain grouped number, no currency sign — for dense table cells where the
// column header already carries the unit.
export function formatAmount(amount: number): string {
  return mntFormatter.format(amount);
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

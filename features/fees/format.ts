// Money is integer MNT (schema.md § Money) — grouped digits with the tugrik
// sign. Mirrors features/students/format.ts; kept local so the fees feature
// doesn't reach into another feature for a two-line formatter.

const mntFormatter = new Intl.NumberFormat("en-US");

export function formatMnt(amount: number): string {
  return `${mntFormatter.format(amount)}₮`;
}

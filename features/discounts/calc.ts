// Tuition discount calculation. Discounts compound in row order: each one
// applies to the *running* total left by the ones above it, not to the base.
// This is the single source of truth for how a set of applied discounts turns
// into a net tuition and per-line MNT reductions. See domain_model.md § Discount.

export const DISCOUNT_UNITS = ["mnt", "percent"] as const;
export type DiscountUnit = (typeof DISCOUNT_UNITS)[number];

// One discount as applied to an enrollment, in application order.
export type DiscountApplication = { unit: DiscountUnit; value: number };

// A discount plus the MNT reduction it actually removed in sequence.
export type ResolvedDiscount = DiscountApplication & { amount: number };

export type TuitionComputation = {
  base: number;
  lines: ResolvedDiscount[];
  discountTotal: number;
  net: number;
};

// MNT is whole-number currency, so every reduction is rounded to an integer
// (half-up) and clamped to the running total — a discount can zero out tuition
// but never drive it negative.
export function resolveReduction(
  running: number,
  unit: DiscountUnit,
  value: number,
): number {
  const raw = unit === "percent" ? (running * value) / 100 : value;
  const rounded = Math.round(raw);
  const ceiling = Math.max(running, 0);
  return Math.min(Math.max(rounded, 0), ceiling);
}

// Fold the ordered discounts onto the base tuition. `net + discountTotal` always
// equals the (rounded, non-negative) base.
export function computeTuition(
  base: number,
  discounts: DiscountApplication[],
): TuitionComputation {
  let running = Math.max(0, Math.round(base));
  const lines: ResolvedDiscount[] = [];
  for (const d of discounts) {
    const amount = resolveReduction(running, d.unit, d.value);
    lines.push({ unit: d.unit, value: d.value, amount });
    running -= amount;
  }
  const discountTotal = lines.reduce((sum, l) => sum + l.amount, 0);
  return { base, lines, discountTotal, net: running };
}

import { describe, expect, it } from "vitest";

import { computeTuition, resolveReduction } from "./calc";

describe("computeTuition", () => {
  it("returns the base untouched when there are no discounts", () => {
    const r = computeTuition(2_000_000, []);
    expect(r.net).toBe(2_000_000);
    expect(r.discountTotal).toBe(0);
    expect(r.lines).toEqual([]);
  });

  it("compounds discounts in row order (percent then flat)", () => {
    const r = computeTuition(1_000_000, [
      { unit: "percent", value: 10 },
      { unit: "mnt", value: 100_000 },
    ]);
    // 10% of 1,000,000 = 100,000 → 900,000; then −100,000 → 800,000.
    expect(r.lines.map((l) => l.amount)).toEqual([100_000, 100_000]);
    expect(r.net).toBe(800_000);
    expect(r.discountTotal).toBe(200_000);
  });

  it("gives a different result when the order is flipped (order matters)", () => {
    const r = computeTuition(1_000_000, [
      { unit: "mnt", value: 100_000 },
      { unit: "percent", value: 10 },
    ]);
    // −100,000 → 900,000; then 10% of 900,000 = 90,000 → 810,000.
    expect(r.lines.map((l) => l.amount)).toEqual([100_000, 90_000]);
    expect(r.net).toBe(810_000);
    expect(r.discountTotal).toBe(190_000);
  });

  it("compounds two percents onto the running total", () => {
    const r = computeTuition(1_000_000, [
      { unit: "percent", value: 50 },
      { unit: "percent", value: 50 },
    ]);
    // 500,000 → 500,000 left; 50% of 500,000 = 250,000 → 250,000.
    expect(r.net).toBe(250_000);
    expect(r.discountTotal).toBe(750_000);
  });

  it("clamps a flat discount so tuition never goes below zero", () => {
    const r = computeTuition(100_000, [
      { unit: "mnt", value: 200_000 },
      { unit: "percent", value: 10 },
    ]);
    expect(r.lines[0]?.amount).toBe(100_000);
    expect(r.lines[1]?.amount).toBe(0);
    expect(r.net).toBe(0);
  });

  it("rounds a fractional percent half-up to whole MNT", () => {
    // 50% of 5 = 2.5 → rounds to 3.
    expect(resolveReduction(5, "percent", 50)).toBe(3);
    // 10% of 333,333 = 33,333.3 → 33,333.
    expect(resolveReduction(333_333, "percent", 10)).toBe(33_333);
  });

  it("net + discountTotal always reconstructs the base", () => {
    const r = computeTuition(1_750_000, [
      { unit: "percent", value: 12.5 },
      { unit: "mnt", value: 300_000 },
    ]);
    expect(r.net + r.discountTotal).toBe(1_750_000);
  });
});

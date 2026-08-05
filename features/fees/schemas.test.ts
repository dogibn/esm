import { describe, expect, it } from "vitest";

import { feeRatePublishSchema } from "./schemas";

const base = { feeName: "registration", effectiveFrom: "2026-09-01" };

describe("feeRatePublishSchema", () => {
  it("accepts a flat rate", () => {
    expect(feeRatePublishSchema.parse({ ...base, amount: 450000 }).amount).toBe(450000);
  });

  it("accepts a per-grade rate", () => {
    const parsed = feeRatePublishSchema.parse({
      ...base,
      feeName: "tuition",
      byGrade: [
        { code: "1", amount: 2000000 },
        { code: "5+", amount: 1800000 },
      ],
    });
    expect(parsed.byGrade).toHaveLength(2);
  });

  it("rejects both shapes at once", () => {
    expect(
      feeRatePublishSchema.safeParse({
        ...base,
        amount: 1000,
        byGrade: [{ code: "1", amount: 2000 }],
      }).success,
    ).toBe(false);
  });

  it("rejects neither shape", () => {
    expect(feeRatePublishSchema.safeParse(base).success).toBe(false);
    expect(feeRatePublishSchema.safeParse({ ...base, byGrade: [] }).success).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(feeRatePublishSchema.safeParse({ ...base, amount: -1 }).success).toBe(false);
    expect(
      feeRatePublishSchema.safeParse({
        ...base,
        byGrade: [{ code: "1", amount: -5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a fractional amount — money is integer MNT", () => {
    expect(feeRatePublishSchema.safeParse({ ...base, amount: 1000.5 }).success).toBe(
      false,
    );
  });

  it("rejects a malformed date", () => {
    for (const effectiveFrom of ["01/09/2026", "2026-9-1", ""]) {
      expect(
        feeRatePublishSchema.safeParse({ ...base, effectiveFrom, amount: 1 }).success,
      ).toBe(false);
    }
  });
});

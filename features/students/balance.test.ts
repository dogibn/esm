import { describe, expect, it } from "vitest";

import {
  chargeMatchesScope,
  classifyFeeScope,
  computeChargeBalance,
  deriveFeeStatus,
  foldChargeTotals,
} from "./balance";
import type { StudentChargeDetail } from "./balance";

describe("computeChargeBalance", () => {
  it("subtracts tuition discount and payments", () => {
    expect(
      computeChargeBalance({
        feeName: "tuition",
        amount: 10_000_000,
        studentDiscountTotal: 2_000_000,
        paidTotal: 3_000_000,
      }),
    ).toBe(5_000_000);
  });

  it("returns full amount when tuition has no discount and no payment", () => {
    expect(
      computeChargeBalance({
        feeName: "tuition",
        amount: 10_000_000,
        studentDiscountTotal: 0,
        paidTotal: 0,
      }),
    ).toBe(10_000_000);
  });

  it("ignores studentDiscountTotal for non-tuition fees (schema.md invariant)", () => {
    // The DB-bound helper may not actually pass discounts for non-tuition,
    // but the formula must defend the invariant: discount only applies to tuition.
    expect(
      computeChargeBalance({
        feeName: "bus_fee",
        amount: 1_000_000,
        studentDiscountTotal: 500_000,
        paidTotal: 0,
      }),
    ).toBe(1_000_000);
    expect(
      computeChargeBalance({
        feeName: "registration",
        amount: 500_000,
        studentDiscountTotal: 500_000,
        paidTotal: 0,
      }),
    ).toBe(500_000);
    expect(
      computeChargeBalance({
        feeName: "Chess Club",
        amount: 300_000,
        studentDiscountTotal: 1_000_000,
        paidTotal: 0,
      }),
    ).toBe(300_000);
  });

  it("handles partial payment", () => {
    expect(
      computeChargeBalance({
        feeName: "bus_fee",
        amount: 1_000_000,
        studentDiscountTotal: 0,
        paidTotal: 400_000,
      }),
    ).toBe(600_000);
  });

  it("returns 0 when paid in full", () => {
    expect(
      computeChargeBalance({
        feeName: "bus_fee",
        amount: 1_000_000,
        studentDiscountTotal: 0,
        paidTotal: 1_000_000,
      }),
    ).toBe(0);
  });

  it("returns full amount when no payments and no discount", () => {
    expect(
      computeChargeBalance({
        feeName: "registration",
        amount: 1_000_000,
        studentDiscountTotal: 0,
        paidTotal: 0,
      }),
    ).toBe(1_000_000);
  });

  it("returns negative for overpayment (caller decides clamp policy)", () => {
    expect(
      computeChargeBalance({
        feeName: "bus_fee",
        amount: 1_000_000,
        studentDiscountTotal: 0,
        paidTotal: 1_500_000,
      }),
    ).toBe(-500_000);
  });

  it("tuition: discount + payment that combined exceed amount returns negative", () => {
    expect(
      computeChargeBalance({
        feeName: "tuition",
        amount: 10_000_000,
        studentDiscountTotal: 6_000_000,
        paidTotal: 5_000_000,
      }),
    ).toBe(-1_000_000);
  });
});

describe("classifyFeeScope", () => {
  it("maps the school-wide fees to their own scope", () => {
    expect(classifyFeeScope("tuition")).toBe("tuition");
    expect(classifyFeeScope("registration")).toBe("registration");
  });

  it("accepts both bus spellings found in imported data", () => {
    expect(classifyFeeScope("bus_fee")).toBe("bus");
    expect(classifyFeeScope("bus")).toBe("bus");
  });

  it("treats anything else as a club (clubs carry their own display name)", () => {
    expect(classifyFeeScope("Chess Club")).toBe("clubs");
    expect(classifyFeeScope("Cheerleading GR3")).toBe("clubs");
    expect(classifyFeeScope("Homework Club Per Session")).toBe("clubs");
  });
});

describe("chargeMatchesScope", () => {
  it("the all scope keeps every charge", () => {
    for (const fee of ["tuition", "bus_fee", "registration", "Chess Club"]) {
      expect(chargeMatchesScope(fee, "all")).toBe(true);
    }
  });

  it("a per-fee scope keeps only that fee", () => {
    expect(chargeMatchesScope("tuition", "tuition")).toBe(true);
    expect(chargeMatchesScope("bus_fee", "tuition")).toBe(false);
    expect(chargeMatchesScope("bus", "bus")).toBe(true);
    expect(chargeMatchesScope("registration", "bus")).toBe(false);
  });

  it("the clubs scope excludes every school-wide fee", () => {
    expect(chargeMatchesScope("Chess Club", "clubs")).toBe(true);
    expect(chargeMatchesScope("tuition", "clubs")).toBe(false);
    expect(chargeMatchesScope("bus_fee", "clubs")).toBe(false);
    expect(chargeMatchesScope("bus", "clubs")).toBe(false);
    expect(chargeMatchesScope("registration", "clubs")).toBe(false);
  });
});

function detail(
  over: Partial<StudentChargeDetail> & { gross: number; paid: number; discount?: number },
): StudentChargeDetail {
  const discount = over.discount ?? 0;
  return {
    id: over.id ?? 1,
    studentId: over.studentId ?? 1,
    feeName: over.feeName ?? "tuition",
    scope: over.scope ?? { kind: "year", academicYearId: 1 },
    grossAmount: BigInt(over.gross),
    outstandingBalance: BigInt(over.gross - discount - over.paid),
    paidTotal: over.paid,
    discountTotal: discount,
  };
}

describe("foldChargeTotals", () => {
  it("is zeroed for a student with no charges", () => {
    expect(foldChargeTotals([])).toEqual({ due: 0, paid: 0, balance: 0 });
  });

  it("nets the discount out of due (tuition)", () => {
    expect(
      foldChargeTotals([
        detail({ gross: 10_000_000, discount: 2_000_000, paid: 3_000_000 }),
      ]),
    ).toEqual({ due: 8_000_000, paid: 3_000_000, balance: 5_000_000 });
  });

  it("sums several club charges into one row", () => {
    expect(
      foldChargeTotals([
        detail({ id: 1, feeName: "Chess Club", gross: 300_000, paid: 300_000 }),
        detail({ id: 2, feeName: "Robotics", gross: 500_000, paid: 100_000 }),
      ]),
    ).toEqual({ due: 800_000, paid: 400_000, balance: 400_000 });
  });

  it("keeps an overpayment negative rather than clamping", () => {
    expect(
      foldChargeTotals([detail({ gross: 1_000_000, paid: 1_500_000 })]).balance,
    ).toBe(-500_000);
  });
});

describe("deriveFeeStatus", () => {
  it("is paid once nothing is outstanding", () => {
    expect(deriveFeeStatus({ balance: 0, paid: 1_000_000 })).toBe("paid");
  });

  it("is paid for an overpayment", () => {
    expect(deriveFeeStatus({ balance: -500_000, paid: 1_500_000 })).toBe("paid");
  });

  it("is partial while some money has come in", () => {
    expect(deriveFeeStatus({ balance: 600_000, paid: 400_000 })).toBe("partial");
  });

  it("is unpaid when nothing has come in", () => {
    expect(deriveFeeStatus({ balance: 1_000_000, paid: 0 })).toBe("unpaid");
  });

  it("counts a fully discounted charge as paid", () => {
    expect(deriveFeeStatus({ balance: 0, paid: 0 })).toBe("paid");
  });
});

import { describe, expect, it } from "vitest";

import { computeChargeBalance } from "./balance";

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

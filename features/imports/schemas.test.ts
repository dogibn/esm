import { describe, expect, it } from "vitest";

import { NEW_CHARGE_PLACEHOLDER_ID } from "./matching";
import { allocationFormSchema } from "./schemas";

const busCharge = {
  studentId: 5,
  feeName: "bus",
  amount: 375_000,
  scope: "term" as const,
  academicTermId: 4,
};

function payload(over: Record<string, unknown> = {}) {
  return {
    bankTransactionId: 7,
    lines: [
      { studentId: 5, chargeId: NEW_CHARGE_PLACEHOLDER_ID, amount: 375_000 },
    ],
    createCharges: [busCharge],
    ...over,
  };
}

describe("allocationFormSchema — creating a charge while confirming", () => {
  it("accepts a placeholder line backed by a fee to create", () => {
    expect(allocationFormSchema.safeParse(payload()).success).toBe(true);
  });

  it("accepts an ordinary allocation with no new fees", () => {
    const r = allocationFormSchema.safeParse({
      bankTransactionId: 7,
      lines: [{ studentId: 5, chargeId: 10, amount: 1_000 }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a placeholder line with nothing to create", () => {
    expect(
      allocationFormSchema.safeParse(payload({ createCharges: undefined })).success,
    ).toBe(false);
  });

  it("rejects a fee to create that this transaction never pays", () => {
    const r = allocationFormSchema.safeParse(
      payload({ lines: [{ studentId: 5, chargeId: 10, amount: 375_000 }] }),
    );
    expect(r.success).toBe(false);
  });

  it("rejects two new fees for the same student", () => {
    const r = allocationFormSchema.safeParse(
      payload({ createCharges: [busCharge, { ...busCharge, feeName: "registration" }] }),
    );
    expect(r.success).toBe(false);
  });

  it("rejects a term fee with no term, and an annual fee with one", () => {
    expect(
      allocationFormSchema.safeParse(
        payload({ createCharges: [{ ...busCharge, academicTermId: null }] }),
      ).success,
    ).toBe(false);
    expect(
      allocationFormSchema.safeParse(
        payload({ createCharges: [{ ...busCharge, scope: "annual" }] }),
      ).success,
    ).toBe(false);
  });

  it("rejects a charge id that is neither real nor the placeholder", () => {
    const r = allocationFormSchema.safeParse(
      payload({ lines: [{ studentId: 5, chargeId: -99, amount: 375_000 }] }),
    );
    expect(r.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { createEnrollmentSchema } from "./schemas";

const base = {
  mode: "new" as const,
  studentId: "ESM-1001",
  firstName: "Bat",
  lastName: "Dorj",
  gradeId: 3,
  studentCategory: "new" as const,
  tuitionAmount: 2_000_000,
  registrationAmount: 0,
  discounts: [],
};

describe("createEnrollmentSchema", () => {
  it("accepts a minimal new-student contract", () => {
    const parsed = createEnrollmentSchema.parse(base);
    expect(parsed.discounts).toEqual([]);
    expect(parsed.registrationAmount).toBe(0);
    expect(parsed.tuitionAmount).toBe(2_000_000);
  });

  it("accepts a registration fee and a catalog discount", () => {
    const parsed = createEnrollmentSchema.parse({
      ...base,
      registrationAmount: 450_000,
      discounts: [{ discountTypeId: 5 }],
    });
    expect(parsed.registrationAmount).toBe(450_000);
    expect(parsed.discounts[0]).toMatchObject({ discountTypeId: 5 });
  });

  it("accepts a custom value on a discount", () => {
    const parsed = createEnrollmentSchema.parse({
      ...base,
      discounts: [{ discountTypeId: 5, value: 250_000 }],
    });
    expect(parsed.discounts[0]).toMatchObject({ discountTypeId: 5, value: 250_000 });
  });

  it("requires an existing student id when mode is 'existing'", () => {
    const result = createEnrollmentSchema.safeParse({
      ...base,
      mode: "existing",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("existingStudentId"))).toBe(
        true,
      );
    }
  });

  it("accepts an existing-student contract with the db id", () => {
    const parsed = createEnrollmentSchema.parse({
      ...base,
      mode: "existing",
      existingStudentId: 42,
      studentCategory: "old",
    });
    expect(parsed.existingStudentId).toBe(42);
  });

  it("rejects a missing class (gradeId must be positive)", () => {
    const result = createEnrollmentSchema.safeParse({ ...base, gradeId: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a blank student id", () => {
    const result = createEnrollmentSchema.safeParse({ ...base, studentId: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a discount with no chosen catalog entry", () => {
    const result = createEnrollmentSchema.safeParse({
      ...base,
      discounts: [{ discountTypeId: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a sibling discount linked to a sibling student", () => {
    const parsed = createEnrollmentSchema.parse({
      ...base,
      discounts: [{ discountTypeId: 5, siblingStudentId: 77 }],
    });
    expect(parsed.discounts[0]).toMatchObject({
      discountTypeId: 5,
      siblingStudentId: 77,
    });
  });

  it("leaves siblingStudentId optional for non-sibling discounts", () => {
    const parsed = createEnrollmentSchema.parse({
      ...base,
      discounts: [{ discountTypeId: 6 }],
    });
    expect(parsed.discounts[0]?.siblingStudentId ?? null).toBeNull();
  });
});

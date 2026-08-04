import { describe, expect, it } from "vitest";

import { parseCreateEnrollmentDetails } from "./undo-details";

describe("parseCreateEnrollmentDetails", () => {
  it("reads a well-formed details object", () => {
    const parsed = parseCreateEnrollmentDetails({
      studentId: 7,
      studentCreated: true,
      enrollmentId: 12,
      chargeIds: [100, 101],
      discountCount: 2,
    });
    expect(parsed).toEqual({
      studentId: 7,
      studentCreated: true,
      enrollmentId: 12,
      chargeIds: [100, 101],
    });
  });

  it("defaults studentCreated to false and chargeIds to empty when absent", () => {
    const parsed = parseCreateEnrollmentDetails({ studentId: 3, enrollmentId: 9 });
    expect(parsed).toEqual({
      studentId: 3,
      studentCreated: false,
      enrollmentId: 9,
      chargeIds: [],
    });
  });

  it("drops non-integer charge ids rather than trusting them", () => {
    const parsed = parseCreateEnrollmentDetails({
      studentId: 1,
      enrollmentId: 2,
      chargeIds: [5, "6", 7.5, null, 8],
    });
    expect(parsed?.chargeIds).toEqual([5, 8]);
  });

  it("returns null for missing or malformed details so undo refuses", () => {
    expect(parseCreateEnrollmentDetails(null)).toBeNull();
    expect(parseCreateEnrollmentDetails(undefined)).toBeNull();
    expect(parseCreateEnrollmentDetails("nope")).toBeNull();
    expect(parseCreateEnrollmentDetails({})).toBeNull();
    expect(parseCreateEnrollmentDetails({ studentId: 1 })).toBeNull();
    expect(parseCreateEnrollmentDetails({ enrollmentId: 1 })).toBeNull();
    expect(
      parseCreateEnrollmentDetails({ studentId: 1.5, enrollmentId: 2 }),
    ).toBeNull();
  });
});

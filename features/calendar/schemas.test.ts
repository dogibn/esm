import { describe, expect, it } from "vitest";

import {
  academicTermCreateSchema,
  academicTermUpdateSchema,
  academicYearInputSchema,
  calendarIdParamSchema,
} from "./schemas";

const year = {
  name: "2026-2027",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
};

describe("academicYearInputSchema", () => {
  it("accepts a well-formed year", () => {
    expect(academicYearInputSchema.parse(year)).toEqual(year);
  });

  it("trims the name", () => {
    expect(academicYearInputSchema.parse({ ...year, name: "  2026-2027 " }).name).toBe(
      "2026-2027",
    );
  });

  it("rejects an empty name", () => {
    expect(academicYearInputSchema.safeParse({ ...year, name: "  " }).success).toBe(
      false,
    );
  });

  it("rejects an end date before the start", () => {
    const result = academicYearInputSchema.safeParse({
      ...year,
      startDate: "2027-06-30",
      endDate: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero-length year (same start and end)", () => {
    expect(
      academicYearInputSchema.safeParse({
        ...year,
        endDate: year.startDate,
      }).success,
    ).toBe(false);
  });

  it("rejects dates that are not YYYY-MM-DD", () => {
    for (const startDate of ["01/09/2026", "2026-9-1", "September 2026", ""]) {
      expect(academicYearInputSchema.safeParse({ ...year, startDate }).success).toBe(
        false,
      );
    }
  });
});

describe("academicTermCreateSchema", () => {
  const term = {
    academicYearId: 3,
    name: "Term 1",
    startDate: "2026-09-01",
    endDate: "2026-11-15",
  };

  it("accepts a well-formed term and coerces the year id", () => {
    expect(academicTermCreateSchema.parse({ ...term, academicYearId: "3" })).toEqual(
      term,
    );
  });

  it("requires a year to attach to", () => {
    const withoutYear = {
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
    };
    expect(academicTermCreateSchema.safeParse(withoutYear).success).toBe(false);
  });

  it("applies the same date-order rule as a year", () => {
    expect(
      academicTermCreateSchema.safeParse({
        ...term,
        startDate: "2026-11-15",
        endDate: "2026-09-01",
      }).success,
    ).toBe(false);
  });
});

describe("academicTermUpdateSchema", () => {
  // A term keeps the year it was created in — its charges and club enrolments
  // are scoped to it, so re-parenting would silently re-scope them.
  it("ignores an attempt to move the term to another year", () => {
    const parsed = academicTermUpdateSchema.parse({
      academicYearId: 99,
      name: "Term 2",
      startDate: "2026-11-16",
      endDate: "2027-01-31",
    });
    expect(parsed).not.toHaveProperty("academicYearId");
  });
});

describe("calendarIdParamSchema", () => {
  it("coerces a route param to a positive integer", () => {
    expect(calendarIdParamSchema.parse("12")).toBe(12);
  });

  it("rejects junk", () => {
    for (const bad of ["0", "-1", "abc", "1.5"]) {
      expect(calendarIdParamSchema.safeParse(bad).success).toBe(false);
    }
  });
});

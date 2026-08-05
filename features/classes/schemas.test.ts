import { describe, expect, it } from "vitest";

import {
  classCreateSchema,
  classUpdateSchema,
  classesQuerySchema,
  gradeLevelCreateSchema,
  gradeLevelUpdateSchema,
} from "./schemas";

describe("classesQuerySchema", () => {
  it("leaves the year unset when absent — the page falls back to the current one", () => {
    expect(classesQuerySchema.parse({}).year).toBeUndefined();
  });

  it("coerces a year from the query string", () => {
    expect(classesQuerySchema.parse({ year: "4" }).year).toBe(4);
  });

  it("rejects junk", () => {
    for (const year of ["0", "-2", "abc"]) {
      expect(classesQuerySchema.safeParse({ year }).success).toBe(false);
    }
  });
});

describe("gradeLevelCreateSchema", () => {
  it("accepts a code and an order", () => {
    expect(gradeLevelCreateSchema.parse({ code: " 5+ ", sortOrder: "6" })).toEqual({
      code: "5+",
      sortOrder: 6,
    });
  });

  it("rejects an empty code", () => {
    expect(gradeLevelCreateSchema.safeParse({ code: "  ", sortOrder: 1 }).success).toBe(
      false,
    );
  });
});

describe("gradeLevelUpdateSchema", () => {
  // The code is the JSONB key tuition is priced against, so it is set once at
  // creation and the update schema has no field for it.
  it("ignores an attempt to rename the code", () => {
    const parsed = gradeLevelUpdateSchema.parse({ code: "renamed", sortOrder: 3 });
    expect(parsed).toEqual({ sortOrder: 3 });
  });
});

describe("classCreateSchema", () => {
  const cls = {
    academicYearId: 1,
    name: "5+A",
    gradeLevelId: 2,
    teacherName: "B. Oyun",
    teacherEmail: "",
    teacherPhone: "",
  };

  it("collapses blank contact fields to null", () => {
    const parsed = classCreateSchema.parse(cls);
    expect(parsed.teacherEmail).toBeNull();
    expect(parsed.teacherPhone).toBeNull();
  });

  it("requires a teacher name — the column is NOT NULL and the tracker shows it", () => {
    expect(classCreateSchema.safeParse({ ...cls, teacherName: " " }).success).toBe(false);
  });

  it("rejects a malformed teacher email", () => {
    expect(
      classCreateSchema.safeParse({ ...cls, teacherEmail: "not-an-email" }).success,
    ).toBe(false);
  });

  it("requires a year", () => {
    const withoutYear = {
      name: cls.name,
      gradeLevelId: cls.gradeLevelId,
      teacherName: cls.teacherName,
      teacherEmail: cls.teacherEmail,
      teacherPhone: cls.teacherPhone,
    };
    expect(classCreateSchema.safeParse(withoutYear).success).toBe(false);
  });
});

describe("classUpdateSchema", () => {
  // A class belongs to the year it was created in; enrolments are scoped by
  // (student, year), so moving one would strand them.
  it("ignores an attempt to move the class to another year", () => {
    const parsed = classUpdateSchema.parse({
      academicYearId: 99,
      name: "5+A",
      gradeLevelId: 2,
      teacherName: "B. Oyun",
      teacherEmail: null,
      teacherPhone: null,
    });
    expect(parsed).not.toHaveProperty("academicYearId");
  });
});

import { describe, expect, it } from "vitest";

import { pageSizeFor, resolveGroupBy, studentListParamsSchema } from "./schemas";

// The fee scope is a query param shared by the route handler and the UI, so a
// bad or missing `?fee=` must land somewhere sane rather than 400 the page.
describe("studentListParamsSchema — fee scope", () => {
  it("defaults to tuition when absent", () => {
    expect(studentListParamsSchema.parse({}).fee).toBe("tuition");
  });

  it("accepts every scope the tabs offer", () => {
    for (const fee of ["all", "tuition", "bus", "registration", "clubs"]) {
      expect(studentListParamsSchema.parse({ fee }).fee).toBe(fee);
    }
  });

  it("falls back to the default for an unknown scope (stale bookmark)", () => {
    expect(studentListParamsSchema.parse({ fee: "uniforms" }).fee).toBe("tuition");
    expect(studentListParamsSchema.parse({ fee: 7 }).fee).toBe("tuition");
  });

  it("leaves the other params alone", () => {
    const parsed = studentListParamsSchema.parse({
      page: "2",
      pageSize: "25",
      gradeId: "8",
      status: "unpaid",
      fee: "clubs",
    });
    expect(parsed).toMatchObject({
      page: 2,
      pageSize: 25,
      gradeId: 8,
      status: "unpaid",
      fee: "clubs",
    });
  });
});

// Grouping is display-only, but it changes what a page counts, so a stale or
// hand-edited ?groupBy= must land on the flat table rather than 400 the page.
describe("studentListParamsSchema — grouping", () => {
  it("defaults to no grouping", () => {
    expect(studentListParamsSchema.parse({}).groupBy).toBe("none");
  });

  it("accepts grouping by class", () => {
    expect(studentListParamsSchema.parse({ groupBy: "class" }).groupBy).toBe("class");
  });

  it("falls back to the default for an unknown grouping", () => {
    expect(studentListParamsSchema.parse({ groupBy: "teacher" }).groupBy).toBe("none");
  });
});

describe("resolveGroupBy", () => {
  it("keeps grouping on the scope that offers it", () => {
    expect(resolveGroupBy("tuition", "class")).toBe("class");
  });

  // Otherwise a hand-edited ?fee=bus&groupBy=class would open grouped with no
  // toggle on screen to turn it off.
  it("drops grouping on every other scope", () => {
    for (const fee of ["all", "bus", "registration", "clubs"] as const) {
      expect(resolveGroupBy(fee, "class")).toBe("none");
    }
  });
});

describe("pageSizeFor", () => {
  // Grouped, a page holds classes and each one carries its students, so the
  // page must hold far fewer units than the flat table does.
  it("pages over classes when grouping, and students when not", () => {
    expect(pageSizeFor("class")).toBeLessThan(pageSizeFor("none"));
  });
});

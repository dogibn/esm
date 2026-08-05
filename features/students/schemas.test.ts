import { describe, expect, it } from "vitest";

import { studentListParamsSchema } from "./schemas";

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

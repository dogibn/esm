import { describe, expect, it } from "vitest";

import { historyListParamsSchema } from "./schemas";

describe("historyListParamsSchema", () => {
  it("applies defaults for an empty query", () => {
    const p = historyListParamsSchema.parse({});
    expect(p).toEqual({ page: 1, pageSize: 50 });
  });

  it("coerces numeric strings and clamps to the allowed bounds", () => {
    expect(historyListParamsSchema.parse({ page: "3", pageSize: "20" })).toMatchObject({
      page: 3,
      pageSize: 20,
    });
    expect(() => historyListParamsSchema.parse({ page: "0" })).toThrow();
    expect(() => historyListParamsSchema.parse({ pageSize: "500" })).toThrow();
  });

  it("accepts a known kind and rejects an unknown one", () => {
    expect(historyListParamsSchema.parse({ kind: "confirm_match" }).kind).toBe(
      "confirm_match",
    );
    expect(() => historyListParamsSchema.parse({ kind: "not_a_kind" })).toThrow();
  });

  it("accepts ISO dates and rejects malformed ones", () => {
    expect(
      historyListParamsSchema.parse({ from: "2026-08-01", to: "2026-08-31" }),
    ).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
    expect(() => historyListParamsSchema.parse({ from: "08/01/2026" })).toThrow();
    expect(() => historyListParamsSchema.parse({ to: "2026-13-40" })).toThrow();
  });
});

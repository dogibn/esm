import { describe, expect, it } from "vitest";

import {
  buildByGradeData,
  buildFlatData,
  checkByGradeCoverage,
  feeGradeCodes,
  parseFeeData,
} from "./shape";

describe("parseFeeData", () => {
  it("reads a flat fee", () => {
    expect(parseFeeData({ amount: 450000 })).toEqual({
      shape: "flat",
      amount: 450000,
      teacher: null,
      schedule: null,
    });
  });

  it("reads a club fee's metadata alongside its amount", () => {
    expect(
      parseFeeData({ amount: 300000, teacher: "B. Oyun", schedule: "Tue 15:00" }),
    ).toEqual({
      shape: "flat",
      amount: 300000,
      teacher: "B. Oyun",
      schedule: "Tue 15:00",
    });
  });

  it("reads a per-grade fee", () => {
    expect(parseFeeData({ by_grade: { "1": 2000000, "5+": 1800000 } })).toEqual({
      shape: "by_grade",
      byGrade: { "1": 2000000, "5+": 1800000 },
    });
  });

  it("tolerates a bare per-grade map, like the charge path does", () => {
    // features/enrollments/api.ts accepts this shape when resolving tuition, so
    // the fees view must show it rather than calling it unknown.
    expect(parseFeeData({ "1": 2000000, "2": 2200000 })).toEqual({
      shape: "by_grade",
      byGrade: { "1": 2000000, "2": 2200000 },
    });
  });

  it("does not mistake a flat amount for a grade level named 'amount'", () => {
    const parsed = parseFeeData({ amount: 450000 });
    expect(parsed.shape).toBe("flat");
  });

  it("drops non-numeric entries from a per-grade map", () => {
    expect(parseFeeData({ by_grade: { "1": 2000000, "2": "n/a" } })).toEqual({
      shape: "by_grade",
      byGrade: { "1": 2000000 },
    });
  });

  it("is unknown for anything else", () => {
    for (const data of [null, undefined, 42, "tuition", [], {}, { note: "x" }]) {
      expect(parseFeeData(data).shape).toBe("unknown");
    }
  });
});

describe("feeGradeCodes", () => {
  it("lists the levels a per-grade fee prices", () => {
    expect(feeGradeCodes({ by_grade: { "1": 1, "5+": 2 } }).sort()).toEqual(["1", "5+"]);
  });

  it("is empty for a flat fee", () => {
    expect(feeGradeCodes({ amount: 450000 })).toEqual([]);
  });
});

describe("build*Data", () => {
  it("writes a flat fee", () => {
    expect(buildFlatData(500000)).toEqual({ amount: 500000 });
  });

  it("always writes the wrapped per-grade form", () => {
    expect(
      buildByGradeData([
        { code: "1", amount: 2000000 },
        { code: "5+", amount: 1800000 },
      ]),
    ).toEqual({ by_grade: { "1": 2000000, "5+": 1800000 } });
  });

  it("round-trips through parseFeeData", () => {
    const data = buildByGradeData([{ code: "3", amount: 2100000 }]);
    expect(parseFeeData(data)).toEqual({ shape: "by_grade", byGrade: { "3": 2100000 } });
  });
});

describe("checkByGradeCoverage", () => {
  it("is clean when every level is priced exactly once", () => {
    expect(
      checkByGradeCoverage(
        ["1", "2", "5+"],
        [
          { code: "1", amount: 1 },
          { code: "2", amount: 2 },
          { code: "5+", amount: 3 },
        ],
      ),
    ).toEqual({ missing: [], unknown: [] });
  });

  it("reports a level with no amount", () => {
    // A missing level silently yields no tuition when a contract is created.
    expect(
      checkByGradeCoverage(["1", "2"], [{ code: "1", amount: 1 }]).missing,
    ).toEqual(["2"]);
  });

  it("reports a code that matches no level", () => {
    expect(
      checkByGradeCoverage(["1"], [
        { code: "1", amount: 1 },
        { code: "99", amount: 2 },
      ]).unknown,
    ).toEqual(["99"]);
  });

  it("reports both at once", () => {
    expect(checkByGradeCoverage(["1", "2"], [{ code: "3", amount: 1 }])).toEqual({
      missing: ["1", "2"],
      unknown: ["3"],
    });
  });
});

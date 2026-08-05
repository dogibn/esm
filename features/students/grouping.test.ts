import { describe, expect, it } from "vitest";

import { groupRowsByClass } from "./grouping";
import type { StudentRow } from "./types";

function row(over: Partial<StudentRow> & Pick<StudentRow, "studentId">): StudentRow {
  return {
    studentCode: `S${over.studentId}`,
    firstName: "A",
    lastName: "B",
    gradeId: 1,
    gradeName: "5+A",
    gradeLevelCode: "5+",
    due: 0,
    paid: 0,
    balance: 0,
    status: "unpaid",
    lastPaymentAt: null,
    ...over,
  };
}

describe("groupRowsByClass", () => {
  it("sums due, paid, and balance over each class", () => {
    const groups = groupRowsByClass(
      [
        row({ studentId: 1, gradeId: 7, due: 1000, paid: 400, balance: 600 }),
        row({ studentId: 2, gradeId: 7, due: 1000, paid: 1000, balance: 0 }),
        row({ studentId: 3, gradeId: 9, due: 500, paid: 0, balance: 500 }),
      ],
      new Map([
        [7, "Bat"],
        [9, "Sara"],
      ]),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      gradeId: 7,
      teacherName: "Bat",
      students: 2,
      due: 2000,
      paid: 1400,
      balance: 600,
    });
    expect(groups[1]).toMatchObject({ gradeId: 9, students: 1, balance: 500 });
  });

  // An overpayment is a negative balance (types.ts § StudentRow), so a class
  // total must be able to go the other way too.
  it("carries an overpayment through as a negative balance", () => {
    const [group] = groupRowsByClass(
      [
        row({ studentId: 1, gradeId: 3, due: 1000, paid: 1500, balance: -500 }),
        row({ studentId: 2, gradeId: 3, due: 1000, paid: 1000, balance: 0 }),
      ],
      new Map(),
    );
    expect(group!.balance).toBe(-500);
  });

  it("keeps the row order it was given, and the rows themselves", () => {
    const rows = [
      row({ studentId: 1, gradeId: 9 }),
      row({ studentId: 2, gradeId: 7 }),
      row({ studentId: 3, gradeId: 9 }),
    ];
    const groups = groupRowsByClass(rows, new Map());

    // First seen wins the order — the query sorts class-first, so this is the
    // class order, not an alphabetical one.
    expect(groups.map((g) => g.gradeId)).toEqual([9, 7]);
    // Flattening the groups reproduces the page, which is what the table
    // relies on to slice its rows per class.
    expect(groups.flatMap((g) => g.rows).map((r) => r.studentId)).toEqual([1, 3, 2]);
  });

  it("falls back to an empty teacher name when the class has none", () => {
    const [group] = groupRowsByClass([row({ studentId: 1, gradeId: 4 })], new Map());
    expect(group!.teacherName).toBe("");
  });

  it("returns nothing for no rows", () => {
    expect(groupRowsByClass([], new Map())).toEqual([]);
  });
});

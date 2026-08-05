// Pure module — folds tracking rows into class groups. No db import, so both
// the read model and the tests can use it.

import type { StudentClassGroup, StudentRow } from "./types";

/**
 * One entry per class, in the order the rows arrive — `listStudents` already
 * sorts class-first (grade level order, then class name), so this preserves
 * that instead of re-sorting.
 *
 * Every total is the sum over the class's own students. That only reads as
 * "the class" because grouping paginates by class: a class is whole on the
 * page it lands on, never split across two.
 */
export function groupRowsByClass(
  rows: StudentRow[],
  teacherByGrade: Map<number, string>,
): StudentClassGroup[] {
  const byGrade = new Map<number, StudentClassGroup>();
  for (const row of rows) {
    let group = byGrade.get(row.gradeId);
    if (!group) {
      group = {
        gradeId: row.gradeId,
        gradeName: row.gradeName,
        gradeLevelCode: row.gradeLevelCode,
        // `grades.teacher_name` is NOT NULL but the import leaves it blank on
        // classes it can't resolve; the UI names that case.
        teacherName: teacherByGrade.get(row.gradeId) ?? "",
        students: 0,
        due: 0,
        paid: 0,
        balance: 0,
        rows: [],
      };
      byGrade.set(row.gradeId, group);
    }
    group.rows.push(row);
    group.students += 1;
    group.due += row.due;
    group.paid += row.paid;
    group.balance += row.balance;
  }
  return [...byGrade.values()];
}

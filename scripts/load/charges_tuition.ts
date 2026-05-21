/**
 * Loads tuition charges for academic year 1.
 *
 * For every active enrollment in academic year 1, inserts a charge row:
 *   - studentId         ← enrollment.studentId
 *   - academicYearId    ← 1
 *   - academicTermId    ← null  (tuition is year-scoped)
 *   - feeName           ← 'tuition'
 *   - amount            ← fee_structures.data[gradeLevel.code]
 *
 * The charges table has no unique constraint on (student_id, academic_year_id, fee_name),
 * so this script reads existing tuition charges for the year and skips those students
 * to stay re-runnable without duplicating.
 *
 * Validates every grade_level code has a tuition amount before any write.
 *
 * Usage:
 *   pnpm load:charges-tuition
 *
 * Required env var: DIRECT_URL
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import {
  academicYears,
  charges,
  enrollments,
  feeStructures,
  gradeLevels,
  grades,
} from "@/db/schema";

const ACADEMIC_YEAR_ID = 1;
const FEE_NAME = "tuition";

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { academicYears, charges, enrollments, feeStructures, gradeLevels, grades },
});

const [year] = await db
  .select({ id: academicYears.id, name: academicYears.name })
  .from(academicYears)
  .where(eq(academicYears.id, ACADEMIC_YEAR_ID))
  .limit(1);
if (!year) {
  console.error(`ERROR: academic_year id=${ACADEMIC_YEAR_ID} not found.`);
  await client.end();
  process.exit(1);
}
console.log(
  `Loading '${FEE_NAME}' charges for academic year '${year.name}' (id=${ACADEMIC_YEAR_ID}).`
);

const feeRows = await db
  .select({ data: feeStructures.data })
  .from(feeStructures)
  .where(
    and(
      eq(feeStructures.feeName, FEE_NAME),
      isNull(feeStructures.academicTermId),
      isNull(feeStructures.supersededAt)
    )
  );
if (feeRows.length === 0) {
  console.error(
    `ERROR: no active fee_structures row for fee_name='${FEE_NAME}' with academic_term_id IS NULL.`
  );
  await client.end();
  process.exit(1);
}
if (feeRows.length > 1) {
  console.error(
    `ERROR: ${feeRows.length} active fee_structures rows for '${FEE_NAME}' — expected exactly 1.`
  );
  await client.end();
  process.exit(1);
}
const tuitionAmounts = feeRows[0]!.data as Record<string, number>;

const enrolled = await db
  .select({
    studentId: enrollments.studentId,
    gradeLevelCode: gradeLevels.code,
  })
  .from(enrollments)
  .innerJoin(grades, eq(grades.id, enrollments.gradeId))
  .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
  .where(
    and(
      eq(enrollments.academicYearId, ACADEMIC_YEAR_ID),
      eq(enrollments.status, "active")
    )
  );

console.log(`Found ${enrolled.length} active enrollment(s) in academic year ${ACADEMIC_YEAR_ID}.`);

let validationErrors = 0;
const rows: (typeof charges.$inferInsert)[] = [];

for (const e of enrolled) {
  const amount = tuitionAmounts[e.gradeLevelCode];
  if (amount === undefined) {
    console.error(
      `ERROR: no tuition amount for grade_level code '${e.gradeLevelCode}' (student_id=${e.studentId}).`
    );
    validationErrors++;
    continue;
  }
  rows.push({
    studentId: e.studentId,
    academicYearId: ACADEMIC_YEAR_ID,
    academicTermId: null,
    feeName: FEE_NAME,
    amount,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const existing = await db
  .select({ studentId: charges.studentId })
  .from(charges)
  .where(and(eq(charges.academicYearId, ACADEMIC_YEAR_ID), eq(charges.feeName, FEE_NAME)));
const existingStudentIds = new Set(existing.map((r) => r.studentId));

const newRows = rows.filter((r) => !existingStudentIds.has(r.studentId));
const skipped = rows.length - newRows.length;

if (newRows.length === 0) {
  console.log(`Nothing to insert. ${skipped} already existed.`);
  await client.end();
  process.exit(0);
}

const result = await db.insert(charges).values(newRows).returning({ id: charges.id });

console.log(`Done. ${result.length} inserted, ${skipped} skipped (already existed).`);

await client.end();

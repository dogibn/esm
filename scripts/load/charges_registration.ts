/**
 * Loads registration charges for academic year 1.
 *
 * For every active enrollment in academic year 1 whose student_category = 'new',
 * inserts a charge row:
 *   - studentId         ← enrollment.studentId
 *   - academicYearId    ← 1
 *   - academicTermId    ← null  (registration is year-scoped)
 *   - feeName           ← 'registration'
 *   - amount            ← fee_structures.data.amount
 *
 * The charges table has no unique constraint on (student_id, academic_year_id, fee_name),
 * so this script reads existing registration charges for the year and skips those
 * students to stay re-runnable without duplicating.
 *
 * Validates that the registration fee exists and has a numeric `amount` before any write.
 *
 * Usage:
 *   pnpm load:charges-registration
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
} from "@/db/schema";

const ACADEMIC_YEAR_ID = 1;
const FEE_NAME = "registration";

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { academicYears, charges, enrollments, feeStructures },
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
const feeData = feeRows[0]!.data as { amount?: unknown };
const amount = feeData?.amount;
if (typeof amount !== "number" || !Number.isFinite(amount)) {
  console.error(
    `ERROR: fee_structures row for '${FEE_NAME}' has invalid data.amount (got ${JSON.stringify(amount)}).`
  );
  await client.end();
  process.exit(1);
}

const enrolled = await db
  .select({ studentId: enrollments.studentId })
  .from(enrollments)
  .where(
    and(
      eq(enrollments.academicYearId, ACADEMIC_YEAR_ID),
      eq(enrollments.status, "active"),
      eq(enrollments.studentCategory, "new")
    )
  );

console.log(
  `Found ${enrolled.length} active 'new' enrollment(s) in academic year ${ACADEMIC_YEAR_ID}.`
);

const rows: (typeof charges.$inferInsert)[] = enrolled.map((e) => ({
  studentId: e.studentId,
  academicYearId: ACADEMIC_YEAR_ID,
  academicTermId: null,
  feeName: FEE_NAME,
  amount,
}));

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

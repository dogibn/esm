/**
 * Creates the year-scoped tuition charge for every 2026-2027 enrolment.
 *
 * `charges.amount` is the student's **base tuition** — the gross the school
 * bills before any discount. That is normally the grade level's published rate,
 * and the resolver has already worked out the 22 cases where it is not: the
 * workbook's `Total payment` plus its itemised discounts implies a different
 * gross, mostly exactly 50% (half-year enrolments) or 95%. Those students get
 * their own amount and a `charges.notes` line recording the level rate it
 * departs from, since the workbook never says why.
 *
 * This is the same field the New Contract form's editable "Base tuition" writes
 * to (features/enrollments/api.ts), so per-student amounts are a first-class
 * case, not a workaround.
 *
 * Re-runnable: skips students who already have a 2026-2027 tuition charge —
 * `charges_student_year_fee_unique` would reject a duplicate anyway.
 *
 * Usage:
 *   pnpm load:charges-tuition-2627 [--dry-run]
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import { academicYears, charges, enrollments, students } from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2026-2027";
const FEE_NAME = "tuition";
const INPUT_PATH = "scripts/processed/tuition_26-27.resolved.json";
const dryRun = process.argv.includes("--dry-run");

interface ResolvedRow {
  row: number;
  code: string | null;
  student_id: string | null;
  base_tuition: number | null;
  base_source: string;
  base_note: string | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { academicYears, charges, enrollments, students },
});

let rows: ResolvedRow[];
try {
  rows = JSON.parse(readFileSync(resolve(process.cwd(), INPUT_PATH), "utf-8"));
} catch {
  console.error(`ERROR: cannot read ${INPUT_PATH} — run the resolver first.`);
  process.exit(1);
}

const [year] = await db
  .select({ id: academicYears.id })
  .from(academicYears)
  .where(eq(academicYears.name, ACADEMIC_YEAR_NAME))
  .limit(1);
if (!year) {
  console.error(`ERROR: academic_year '${ACADEMIC_YEAR_NAME}' not found.`);
  await client.end();
  process.exit(1);
}

const enrolled = await db
  .select({ studentDbId: enrollments.studentId, studentId: students.studentId })
  .from(enrollments)
  .innerJoin(students, eq(students.id, enrollments.studentId))
  .where(eq(enrollments.academicYearId, year.id));
const dbIdByStudentId = new Map(enrolled.map((e) => [e.studentId, e.studentDbId]));

const already = await db
  .select({ studentId: charges.studentId })
  .from(charges)
  .where(
    and(
      eq(charges.academicYearId, year.id),
      isNull(charges.academicTermId),
      eq(charges.feeName, FEE_NAME),
    ),
  );
const alreadyCharged = new Set(already.map((c) => c.studentId));

const values: (typeof charges.$inferInsert)[] = [];
let skipped = 0;
let overrides = 0;
let validationErrors = 0;

for (const row of rows) {
  const naturalKey =
    row.student_id ?? (row.code ? `TMP-${row.code}` : `TMP-2627-R${row.row}`);
  const studentDbId = dbIdByStudentId.get(naturalKey);
  if (studentDbId === undefined) {
    console.error(
      `ERROR: row ${row.row}: student '${naturalKey}' has no ${ACADEMIC_YEAR_NAME} ` +
        `enrolment — run pnpm load:enrollments-2627 first.`
    );
    validationErrors++;
    continue;
  }
  if (row.base_tuition === null) {
    console.error(
      `ERROR: row ${row.row} ('${naturalKey}') has no base tuition — the ` +
        `workbook gives neither a gross nor a net and its level has no rate.`
    );
    validationErrors++;
    continue;
  }
  if (alreadyCharged.has(studentDbId)) {
    skipped++;
    continue;
  }
  if (row.base_source === "workbook") overrides++;

  values.push({
    studentId: studentDbId,
    academicYearId: year.id,
    academicTermId: null,
    feeName: FEE_NAME,
    amount: row.base_tuition,
    notes: row.base_note,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const total = values.reduce((sum, v) => sum + (v.amount as number), 0);
console.log(
  `${values.length} charge(s) to write, ${skipped} already present. ` +
    `${overrides} carry a per-student base. Gross total ${total.toLocaleString()} MNT.`
);

if (dryRun) {
  console.log("Dry run. Nothing written.");
  await client.end();
  process.exit(0);
}

if (values.length === 0) {
  console.log("Nothing to insert.");
  await client.end();
  process.exit(0);
}

const result = await db.insert(charges).values(values).returning({ id: charges.id });
console.log(`Done. ${result.length} inserted, ${skipped} skipped.`);

await client.end();

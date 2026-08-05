/**
 * Enrols every 2026-2027 workbook row into the 2026-2027 academic year.
 *
 * Per row:
 *   studentId          ← students.id, via the resolver's esmlh id or placeholder
 *   academicYearId     ← academic_years '2026-2027'
 *   gradeId            ← the resolved class, or the level's `<level>temp` class
 *   status             ← 'active'
 *   studentCategory    ← the workbook's new/old, derived when it is unusable
 *   tuitionContractId  ← the workbook's Contract (nullable — only ~453 rows
 *                        have one at load time; the rest are signed later)
 *   studentCode        ← the workbook's Code (nullable for new joiners)
 *
 * `new/old` is blank or ambiguous ("new/old") on a handful of rows. Those are
 * settled by whether the workbook gave the student a code: a code is issued on
 * first enrolment and kept for life, so having one means they are returning.
 *
 * Validates every lookup before writing anything, and aborts as a whole on any
 * miss. Idempotent via UNIQUE (student_id, academic_year_id).
 *
 * Usage:
 *   pnpm load:enrollments-2627 [--dry-run]
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { academicYears, enrollments, grades, students } from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2026-2027";
const INPUT_PATH = "scripts/processed/tuition_26-27.resolved.json";
const dryRun = process.argv.includes("--dry-run");

interface ResolvedRow {
  row: number;
  code: string | null;
  contract: string | null;
  new_old: string | null;
  student_id: string | null;
  web_class: string | null;
  grade_level: string | null;
  grade_source: string;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { academicYears, enrollments, grades, students },
});

let rows: ResolvedRow[];
try {
  rows = JSON.parse(readFileSync(resolve(process.cwd(), INPUT_PATH), "utf-8"));
} catch {
  console.error(`ERROR: cannot read ${INPUT_PATH} — run the resolver first.`);
  process.exit(1);
}

const yearRow = await db
  .select({ id: academicYears.id })
  .from(academicYears)
  .where(eq(academicYears.name, ACADEMIC_YEAR_NAME))
  .limit(1);
if (yearRow.length === 0) {
  console.error(`ERROR: academic_year '${ACADEMIC_YEAR_NAME}' not found.`);
  await client.end();
  process.exit(1);
}
const academicYearId = yearRow[0]!.id;

const studentRows = await db
  .select({ id: students.id, studentId: students.studentId })
  .from(students);
const dbIdByStudentId = new Map(studentRows.map((s) => [s.studentId, s.id]));

const gradeRows = await db
  .select({ id: grades.id, name: grades.name })
  .from(grades)
  .where(eq(grades.academicYearId, academicYearId));
const gradeIdByName = new Map(gradeRows.map((g) => [g.name.toLowerCase(), g.id]));

const values: (typeof enrollments.$inferInsert)[] = [];
const seenStudents = new Map<number, number>();
const seenCodes = new Map<string, number>();
let derivedCategories = 0;
let validationErrors = 0;

for (const row of rows) {
  // Mirrors students_2627.ts, which is what put these rows in the table.
  const naturalKey =
    row.student_id ?? (row.code ? `TMP-${row.code}` : `TMP-2627-R${row.row}`);
  const studentId = dbIdByStudentId.get(naturalKey);
  if (studentId === undefined) {
    console.error(
      `ERROR: row ${row.row}: student '${naturalKey}' is not in the students ` +
        `table — run pnpm load:students-2627 first.`
    );
    validationErrors++;
    continue;
  }

  if (!row.grade_level) {
    console.error(`ERROR: row ${row.row} has no grade level.`);
    validationErrors++;
    continue;
  }
  const className = row.web_class ?? `${row.grade_level}temp`;
  const gradeId = gradeIdByName.get(className.toLowerCase());
  if (gradeId === undefined) {
    console.error(
      `ERROR: row ${row.row}: class '${className}' has no ${ACADEMIC_YEAR_NAME} ` +
        `grades row — run pnpm load:grades-2627 first.`
    );
    validationErrors++;
    continue;
  }

  const firstSeenAt = seenStudents.get(studentId);
  if (firstSeenAt !== undefined) {
    console.error(
      `ERROR: student '${naturalKey}' appears on rows ${firstSeenAt} and ${row.row}.`
    );
    validationErrors++;
    continue;
  }
  seenStudents.set(studentId, row.row);

  if (row.code) {
    const codeSeenAt = seenCodes.get(row.code);
    if (codeSeenAt !== undefined) {
      console.error(
        `ERROR: code '${row.code}' appears on rows ${codeSeenAt} and ${row.row}.`
      );
      validationErrors++;
      continue;
    }
    seenCodes.set(row.code, row.row);
  }

  let category = row.new_old;
  if (category !== "new" && category !== "old") {
    category = row.code ? "old" : "new";
    derivedCategories++;
  }

  values.push({
    studentId,
    academicYearId,
    gradeId,
    status: "active",
    studentCategory: category,
    tuitionContractId: row.contract,
    studentCode: row.code,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const placeholderClasses = values.length - rows.filter((r) => r.web_class).length;

if (dryRun) {
  console.log(
    `Dry run. ${values.length} enrolments would be written ` +
      `(${placeholderClasses} into placeholder classes, ` +
      `${derivedCategories} categories derived). Nothing written.`
  );
  await client.end();
  process.exit(0);
}

const result = await db
  .insert(enrollments)
  .values(values)
  .onConflictDoUpdate({
    target: [enrollments.studentId, enrollments.academicYearId],
    set: {
      gradeId: sql`excluded.grade_id`,
      status: sql`excluded.status`,
      studentCategory: sql`excluded.student_category`,
      tuitionContractId: sql`excluded.tuition_contract_id`,
      studentCode: sql`excluded.student_code`,
      updatedAt: sql`now()`,
    },
  })
  .returning({ createdAt: enrollments.createdAt, updatedAt: enrollments.updatedAt });

const inserted = result.filter(
  (r) => r.createdAt.getTime() === r.updatedAt.getTime()
).length;

console.log(
  `Done. ${inserted} inserted, ${result.length - inserted} updated ` +
    `(${result.length} total, ${placeholderClasses} in placeholder classes, ` +
    `${derivedCategories} categories derived).`
);

await client.end();

/**
 * Loads enrollments from the match pipeline outputs.
 *
 * Inputs (from scripts/processed/):
 *   - students_tuition.matched.json  — [{student_id, code}, ...]
 *   - tuition_25-26.matched.json     — keyed by `code`, supplies grade, new_old, contract
 *
 * Per row:
 *   - studentId           ← students.id WHERE students.student_id = pair.student_id
 *   - studentCode         ← pair.code
 *   - academicYearId      ← academic_years.id WHERE name = '2025-2026'
 *   - gradeId             ← grades.id WHERE academic_year_id = <above> AND lower(name) = lower(tuition.grade)
 *   - studentCategory     ← tuition.new_old
 *   - tuitionContractId   ← tuition.contract
 *   - status              ← 'active'
 *
 * Validates everything before any writes; aborts on any missing lookup.
 *
 * Usage:
 *   pnpm load:enrollments
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, sql } from "drizzle-orm";
import { academicYears, enrollments, grades, students } from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2025-2026";

interface MatchedPair {
  student_id: string | number;
  code: string;
}

interface TuitionRow {
  code: string;
  contract: string | null;
  new_old: string | null;
  grade: string | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicYears, enrollments, grades, students } });

function readJson<T>(relPath: string): T[] {
  const path = resolve(process.cwd(), relPath);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    console.error(`ERROR: cannot read ${path}.`);
    process.exit(1);
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length === 0) {
    console.error(`ERROR: ${relPath} is empty or not an array.`);
    process.exit(1);
  }
  return data as T[];
}

const pairs = readJson<MatchedPair>("scripts/processed/students_tuition.matched.json");
const tuitionRows = readJson<TuitionRow>("scripts/processed/tuition_25-26.matched.json");

const tuitionByCode = new Map<string, TuitionRow>();
for (const t of tuitionRows) {
  tuitionByCode.set(t.code, t);
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
const academicYearId = yearRow[0].id;

const studentRows = await db
  .select({ id: students.id, studentIdText: students.studentId })
  .from(students);
const studentIdByText = new Map(studentRows.map((s) => [s.studentIdText, s.id]));

const gradeRows = await db
  .select({ id: grades.id, name: grades.name })
  .from(grades)
  .where(eq(grades.academicYearId, academicYearId));
const gradeIdByLowerName = new Map(gradeRows.map((g) => [g.name.toLowerCase(), g.id]));

const rows: (typeof enrollments.$inferInsert)[] = [];
let validationErrors = 0;

for (const p of pairs) {
  const studentIdText = String(p.student_id);
  const dbStudentId = studentIdByText.get(studentIdText);
  if (dbStudentId === undefined) {
    console.error(`ERROR: student_id '${studentIdText}' not found in students table.`);
    validationErrors++;
    continue;
  }

  const tuition = tuitionByCode.get(p.code);
  if (!tuition) {
    console.error(`ERROR: tuition row for code '${p.code}' not found.`);
    validationErrors++;
    continue;
  }

  const gradeRaw = tuition.grade;
  if (!gradeRaw) {
    console.error(`ERROR: tuition row code='${p.code}' has empty grade.`);
    validationErrors++;
    continue;
  }
  const gradeId = gradeIdByLowerName.get(gradeRaw.toLowerCase());
  if (gradeId === undefined) {
    console.error(
      `ERROR: grade '${gradeRaw}' (code='${p.code}') not found in grades for year '${ACADEMIC_YEAR_NAME}'.`
    );
    validationErrors++;
    continue;
  }

  const category = tuition.new_old;
  if (category !== "new" && category !== "old") {
    console.error(
      `ERROR: tuition row code='${p.code}' has invalid new_old='${category}' (expected 'new' or 'old').`
    );
    validationErrors++;
    continue;
  }

  rows.push({
    studentId: dbStudentId,
    academicYearId,
    gradeId,
    status: "active",
    studentCategory: category,
    tuitionContractId: tuition.contract ?? null,
    studentCode: p.code,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const result = await db
  .insert(enrollments)
  .values(rows)
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
const updated = result.length - inserted;

console.log(`Done. ${inserted} inserted, ${updated} updated (${result.length} total).`);

await client.end();

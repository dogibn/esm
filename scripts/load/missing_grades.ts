/**
 * Backfills `grades` rows for any grade name referenced by
 * scripts/processed/students.cleaned.json that doesn't yet exist in
 * the grades table for the active academic year.
 *
 * Inserts come in with teacher_name = "" (placeholder — the column is
 * NOT NULL). Surface these rows + any orphan grades (in DB but no
 * student references them) in scripts/reports/report.xlsx along with
 * the tuition rows whose new_old failed the cleaner's enum validation.
 *
 * grade_level_id is derived by matching the grade name's leading
 * digits + optional '+' (e.g. '1JB' → '1', '5+B' → '5+', '12D' → '12')
 * against grade_levels.code.
 *
 * Usage:
 *   pnpm load:missing-grades
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { academicYears, grades, gradeLevels } from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2025-2026";
const TEACHER_NAME_PLACEHOLDER = "";

interface CleanedStudent {
  student_id: string | number;
  first_name: string;
  last_name: string;
  grade_name: string;
  academic_year_name?: string;
}

interface InvalidEnumRow {
  contract?: string | null;
  new_old?: string | null;
  grade?: string | null;
  surname?: string | null;
  name?: string | null;
  code?: string | null;
  _invalid_column?: string;
  _invalid_value?: string;
  [k: string]: unknown;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicYears, grades, gradeLevels } });

function readJson<T>(relPath: string): T[] {
  const path = resolve(process.cwd(), relPath);
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf-8"));
  return Array.isArray(data) ? (data as T[]) : [];
}

const cleanedStudents = readJson<CleanedStudent>(
  "scripts/processed/students.cleaned.json"
);
if (cleanedStudents.length === 0) {
  console.error("ERROR: scripts/processed/students.cleaned.json is empty or missing.");
  await client.end();
  process.exit(1);
}

const yearRow = await db
  .select({ id: academicYears.id })
  .from(academicYears)
  .where(eq(academicYears.name, ACADEMIC_YEAR_NAME))
  .limit(1);
if (yearRow.length === 0) {
  console.error(`ERROR: academic year '${ACADEMIC_YEAR_NAME}' not found.`);
  await client.end();
  process.exit(1);
}
const academicYearId = yearRow[0].id;

const dbGradeRows = await db
  .select({
    id: grades.id,
    name: grades.name,
    teacherName: grades.teacherName,
    teacherEmail: grades.teacherEmail,
    teacherPhone: grades.teacherPhone,
    gradeLevelId: grades.gradeLevelId,
  })
  .from(grades)
  .where(eq(grades.academicYearId, academicYearId));
const dbGradeNames = new Set(dbGradeRows.map((g) => g.name));

const dbGradeLevels = await db
  .select({ id: gradeLevels.id, code: gradeLevels.code })
  .from(gradeLevels);
const levelIdByCode = new Map(dbGradeLevels.map((gl) => [gl.code, gl.id]));

// Distinct grade names referenced by students.cleaned.json.
const studentGradeNames = new Set<string>();
for (const s of cleanedStudents) {
  if (s.grade_name) studentGradeNames.add(s.grade_name);
}

const PREFIX_RE = /^(\d+\+?)/;
function extractLevelCode(gradeName: string): string | null {
  const m = gradeName.match(PREFIX_RE);
  return m ? m[1] : null;
}

// 1. Compute backfill set: in students.cleaned but not in DB.
const missingNames = [...studentGradeNames].filter((n) => !dbGradeNames.has(n));

const rowsToInsert: (typeof grades.$inferInsert)[] = [];
const insertFailures: { name: string; reason: string }[] = [];
for (const name of missingNames) {
  const code = extractLevelCode(name);
  if (code === null) {
    insertFailures.push({ name, reason: "no leading digits to derive grade_level" });
    continue;
  }
  const levelId = levelIdByCode.get(code);
  if (levelId === undefined) {
    insertFailures.push({
      name,
      reason: `grade_level code='${code}' not found in grade_levels`,
    });
    continue;
  }
  rowsToInsert.push({
    name,
    gradeLevelId: levelId,
    academicYearId,
    teacherName: TEACHER_NAME_PLACEHOLDER,
    teacherEmail: null,
    teacherPhone: null,
  });
}

if (insertFailures.length > 0) {
  console.error(`ERROR: cannot resolve grade_level for ${insertFailures.length} grade(s):`);
  for (const f of insertFailures) console.error(`  '${f.name}': ${f.reason}`);
  console.error("Aborting before any writes.");
  await client.end();
  process.exit(1);
}

let inserted = 0;
if (rowsToInsert.length > 0) {
  const result = await db
    .insert(grades)
    .values(rowsToInsert)
    .onConflictDoNothing({ target: [grades.academicYearId, grades.name] })
    .returning({ id: grades.id, name: grades.name });
  inserted = result.length;
  console.log(`Inserted ${inserted} new grade(s):`);
  for (const r of result) console.log(`  • '${r.name}'`);
} else {
  console.log("No missing grades to insert.");
}

// 2. Re-query DB to capture the freshly-inserted rows for the report.
const dbGradesAfter = await db
  .select({
    id: grades.id,
    name: grades.name,
    teacherName: grades.teacherName,
    teacherEmail: grades.teacherEmail,
    teacherPhone: grades.teacherPhone,
    gradeLevelId: grades.gradeLevelId,
  })
  .from(grades)
  .where(eq(grades.academicYearId, academicYearId));

const gradesWithoutTeacher = dbGradesAfter.filter(
  (g) =>
    g.teacherName === TEACHER_NAME_PLACEHOLDER ||
    g.teacherName === null ||
    g.teacherName.trim() === ""
);

const gradesWithoutStudents = dbGradesAfter.filter(
  (g) => !studentGradeNames.has(g.name)
);

// 3. Read tuition invalid-enum rows from cleaner output.
const invalidEnumRows = readJson<InvalidEnumRow>(
  "scripts/processed/tuition_25-26.invalid_enum.json"
);

// 4. Write report.xlsx with 3 sheets.
const wb = XLSX.utils.book_new();

const sheetGradesNoTeacher = XLSX.utils.json_to_sheet(
  gradesWithoutTeacher.length > 0
    ? gradesWithoutTeacher.map((g) => ({
        grade_name: g.name,
        grade_level_id: g.gradeLevelId,
        teacher_name: g.teacherName,
        teacher_email: g.teacherEmail,
        teacher_phone: g.teacherPhone,
        academic_year: ACADEMIC_YEAR_NAME,
      }))
    : [{ note: "none" }]
);
XLSX.utils.book_append_sheet(wb, sheetGradesNoTeacher, "grades_without_teacher");

const sheetGradesNoStudents = XLSX.utils.json_to_sheet(
  gradesWithoutStudents.length > 0
    ? gradesWithoutStudents.map((g) => ({
        grade_name: g.name,
        grade_level_id: g.gradeLevelId,
        teacher_name: g.teacherName,
        teacher_email: g.teacherEmail,
        teacher_phone: g.teacherPhone,
        academic_year: ACADEMIC_YEAR_NAME,
      }))
    : [{ note: "none" }]
);
XLSX.utils.book_append_sheet(wb, sheetGradesNoStudents, "grades_without_students");

const sheetInvalidEnum = XLSX.utils.json_to_sheet(
  invalidEnumRows.length > 0 ? invalidEnumRows : [{ note: "none" }]
);
XLSX.utils.book_append_sheet(wb, sheetInvalidEnum, "tuition_invalid_new_old");

const reportPath = resolve(process.cwd(), "scripts/reports/report.xlsx");
XLSX.writeFile(wb, reportPath);

console.log(`\nReport written to ${reportPath}`);
console.log(`  grades_without_teacher: ${gradesWithoutTeacher.length}`);
console.log(`  grades_without_students: ${gradesWithoutStudents.length}`);
console.log(`  tuition_invalid_new_old: ${invalidEnumRows.length}`);

await client.end();

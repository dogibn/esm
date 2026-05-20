/**
 * Diagnostic: cross-reference enrollments populator inputs against DB
 * lookup tables and surface the exact data-quality issues blocking the
 * load. Read-only.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/tools/diagnose_enrollments.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { academicYears, grades, students } from "@/db/schema";

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
  surname: string | null;
  name: string | null;
}

const dbUrl = process.env.DIRECT_URL!;
const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicYears, grades, students } });

const pairs: MatchedPair[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/processed/students_tuition.matched.json"), "utf-8")
);
const tuitionRows: TuitionRow[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/processed/tuition_25-26.matched.json"), "utf-8")
);
const tuitionByCode = new Map(tuitionRows.map((t) => [t.code, t]));

const [{ id: yearId }] = await db
  .select({ id: academicYears.id })
  .from(academicYears)
  .where(eq(academicYears.name, ACADEMIC_YEAR_NAME))
  .limit(1);

const dbGrades = await db
  .select({ id: grades.id, name: grades.name })
  .from(grades)
  .where(eq(grades.academicYearId, yearId));
const dbGradeNames = new Set(dbGrades.map((g) => g.name));
const dbGradeNamesLower = new Set(dbGrades.map((g) => g.name.toLowerCase()));

console.log(`\nGrades in DB for ${ACADEMIC_YEAR_NAME}: ${dbGrades.length}`);
console.log("  " + [...dbGradeNames].sort().join(", "));

// 1. Distinct grade values referenced by matched tuition rows
const tuitionGradeCounts = new Map<string, number>();
for (const p of pairs) {
  const t = tuitionByCode.get(p.code);
  if (!t?.grade) continue;
  tuitionGradeCounts.set(t.grade, (tuitionGradeCounts.get(t.grade) ?? 0) + 1);
}

// 2. Grades in tuition not found in DB grades (case-insensitive)
console.log("\nGrades present in matched tuition but MISSING from grades table:");
const missing: { grade: string; n: number }[] = [];
for (const [g, n] of tuitionGradeCounts) {
  if (!dbGradeNamesLower.has(g.toLowerCase())) missing.push({ grade: g, n });
}
missing.sort((a, b) => b.n - a.n);
for (const m of missing) console.log(`  '${m.grade}': ${m.n} rows`);
console.log(`  total missing-grade rows: ${missing.reduce((s, m) => s + m.n, 0)}`);

// 3. Distinct new_old values
const noCounts = new Map<string, number>();
for (const p of pairs) {
  const t = tuitionByCode.get(p.code);
  const v = t?.new_old ?? "<null>";
  noCounts.set(v, (noCounts.get(v) ?? 0) + 1);
}
console.log("\nDistinct new_old values across matched tuition rows:");
for (const [v, n] of [...noCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  '${v}': ${n}`);
}

// 4. Sample bad rows for each problem class
console.log("\nSample tuition rows with non-'new'/'old' new_old:");
let shown = 0;
for (const t of tuitionRows) {
  if (t.new_old !== "new" && t.new_old !== "old") {
    console.log(`  code=${t.code} grade=${t.grade} new_old='${t.new_old}' surname=${t.surname} name=${t.name}`);
    if (++shown >= 10) break;
  }
}

await client.end();

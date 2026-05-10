/**
 * Loads scripts/scraped/teachers.json into the `grades` table.
 * See docs/scraping_esmlh.md for the full spec.
 *
 * Usage:
 *   pnpm load:grades
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { grades, gradeLevels, academicYears } from "@/db/schema";

interface ScrapedTeacher {
  grade_name: string;
  grade_level: string;
  academic_year: string;
  teacher_name: string;
  teacher_email: string | null;
  teacher_phone: string | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { grades, gradeLevels, academicYears } });

const inputPath = resolve(process.cwd(), "scripts/scraped/teachers.json");
let raw: string;
try {
  raw = readFileSync(inputPath, "utf-8");
} catch {
  console.error(`ERROR: cannot read ${inputPath} — run the scraper first.`);
  process.exit(1);
}

const scraped: ScrapedTeacher[] = JSON.parse(raw);
if (!Array.isArray(scraped) || scraped.length === 0) {
  console.error("ERROR: teachers.json is empty or not an array.");
  process.exit(1);
}

// Build lookup maps from the DB.
const allGradeLevels = await db.select().from(gradeLevels);
const gradeLevelByCode = new Map(allGradeLevels.map((gl) => [gl.code, gl.id]));

const allAcademicYears = await db.select().from(academicYears);
const academicYearByName = new Map(allAcademicYears.map((ay) => [ay.name, ay.id]));

// Validate all rows before any writes.
const rows: (typeof grades.$inferInsert)[] = [];
let validationErrors = 0;

for (const t of scraped) {
  const gradeLevelId = gradeLevelByCode.get(t.grade_level);
  if (gradeLevelId === undefined) {
    console.error(`ERROR: grade_level '${t.grade_level}' not found in grade_levels table.`);
    validationErrors++;
    continue;
  }

  const academicYearId = academicYearByName.get(t.academic_year);
  if (academicYearId === undefined) {
    console.error(`ERROR: academic_year '${t.academic_year}' not found in academic_years table.`);
    validationErrors++;
    continue;
  }

  rows.push({
    name: t.grade_name,
    gradeLevelId,
    academicYearId,
    teacherName: t.teacher_name,
    teacherEmail: t.teacher_email ?? null,
    teacherPhone: t.teacher_phone ?? null,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const result = await db
  .insert(grades)
  .values(rows)
  .onConflictDoUpdate({
    target: [grades.academicYearId, grades.name],
    set: {
      gradeLevelId: sql`excluded.grade_level_id`,
      teacherName: sql`excluded.teacher_name`,
      teacherEmail: sql`excluded.teacher_email`,
      teacherPhone: sql`excluded.teacher_phone`,
      updatedAt: sql`now()`,
    },
  })
  .returning({ createdAt: grades.createdAt, updatedAt: grades.updatedAt });

const inserted = result.filter(
  (r) => r.createdAt.getTime() === r.updatedAt.getTime()
).length;
const updated = result.length - inserted;

console.log(`Done. ${inserted} inserted, ${updated} updated (${result.length} total).`);

await client.end();

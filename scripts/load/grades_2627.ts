/**
 * Creates the 2026-2027 `grades` rows (one per class) from the resolution output.
 *
 * Two kinds of class are created:
 *
 *   - every distinct 2026-2027 class esmlh lists, e.g. "7E";
 *   - one `<level>temp` holding class per grade level that has students whose
 *     class esmlh has not published yet. `enrollments.grade_id` is NOT NULL and
 *     points at a class, not a level, so a student we can only place to a level
 *     still needs somewhere to sit. esmlh uses exactly this convention itself
 *     ("1temp", "4temp", "5temp") for students it has not streamed, so those
 *     names are reused rather than inventing a parallel one.
 *
 * `grades.teacher_name` is NOT NULL but the esmlh staff directory still lists
 * 2025-2026 form tutors, so every row is created with "TBD". Re-run the
 * teachers scrape + loader once the school publishes 2026-2027 tutors.
 *
 * Idempotent: conflicts on (academic_year_id, name) are ignored, so re-running
 * after more classes appear on esmlh only adds the new ones.
 *
 * Usage:
 *   pnpm load:grades-2627
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { academicYears, gradeLevels, grades } from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2026-2027";
const PLACEHOLDER_TEACHER = "TBD";
const INPUT_PATH = "scripts/processed/tuition_26-27.resolved.json";

interface ResolvedRow {
  row: number;
  web_class: string | null;
  grade_level: string | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicYears, gradeLevels, grades } });

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

const levelRows = await db
  .select({ id: gradeLevels.id, code: gradeLevels.code })
  .from(gradeLevels);
const levelIdByCode = new Map(levelRows.map((l) => [l.code, l.id]));

// className -> level code. A class always belongs to the level of the students
// placed in it, which the resolver has already worked out — safer than
// re-parsing the class name here.
const levelByClass = new Map<string, string>();
let validationErrors = 0;

for (const row of rows) {
  if (!row.grade_level) {
    console.error(`ERROR: row ${row.row} has no grade level — re-run the resolver.`);
    validationErrors++;
    continue;
  }
  if (!levelIdByCode.has(row.grade_level)) {
    console.error(`ERROR: row ${row.row} has unknown grade level '${row.grade_level}'.`);
    validationErrors++;
    continue;
  }
  const className = row.web_class ?? `${row.grade_level}temp`;
  const existing = levelByClass.get(className);
  if (existing !== undefined && existing !== row.grade_level) {
    console.error(
      `ERROR: class '${className}' maps to both level '${existing}' and ` +
        `'${row.grade_level}' (row ${row.row}).`
    );
    validationErrors++;
    continue;
  }
  levelByClass.set(className, row.grade_level);
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const values = [...levelByClass.entries()].map(([name, level]) => ({
  name,
  gradeLevelId: levelIdByCode.get(level)!,
  academicYearId,
  teacherName: PLACEHOLDER_TEACHER,
}));

const inserted = await db
  .insert(grades)
  .values(values)
  .onConflictDoNothing({ target: [grades.academicYearId, grades.name] })
  .returning({ name: grades.name });

const placeholders = values.filter((v) => v.name.endsWith("temp")).length;
console.log(
  `Done. ${inserted.length} inserted, ${values.length - inserted.length} already present ` +
    `(${values.length} classes total, ${placeholders} of them placeholders).`
);
if (inserted.length > 0) {
  console.log(`Inserted: ${inserted.map((r) => r.name).sort().join(", ")}`);
}

await client.end();

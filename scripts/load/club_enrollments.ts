/**
 * Loads scripts/scraped/student_clubs.json into the `club_enrollments` table.
 *
 *   - studentId        ← students.id WHERE students.student_id = pair.student_id
 *   - feeStructureId   ← fee_structures.id WHERE fee_name = pair.name
 *                                            AND academic_term_id = current term
 *                                            AND superseded_at IS NULL
 *   - academicTermId   ← current academic_terms row (is_current = true)
 *
 * Validates everything before any writes; aborts on any missing lookup.
 * Idempotent via the unique index (student_id, fee_structure_id): re-running
 * is a no-op for existing rows.
 *
 * Usage:
 *   pnpm load:club-enrollments
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import { academicTerms, clubEnrollments, feeStructures, students } from "@/db/schema";

interface ScrapedPair {
  student_id: string;
  name: string;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { academicTerms, clubEnrollments, feeStructures, students },
});

const inputPath = resolve(process.cwd(), "scripts/scraped/student_clubs.json");
let raw: string;
try {
  raw = readFileSync(inputPath, "utf-8");
} catch {
  console.error(`ERROR: cannot read ${inputPath} — run the scraper first.`);
  process.exit(1);
}

const pairs: ScrapedPair[] = JSON.parse(raw);
if (!Array.isArray(pairs) || pairs.length === 0) {
  console.error("ERROR: student_clubs.json is empty or not an array.");
  await client.end();
  process.exit(1);
}

const [currentTerm] = await db
  .select({ id: academicTerms.id, name: academicTerms.name })
  .from(academicTerms)
  .where(eq(academicTerms.isCurrent, true))
  .limit(1);
if (!currentTerm) {
  console.error("ERROR: no academic_terms row with is_current = true.");
  await client.end();
  process.exit(1);
}
console.log(
  `Loading ${pairs.length} (student, club) pair(s) into club_enrollments for term '${currentTerm.name}' (id=${currentTerm.id}).`
);

const studentRows = await db
  .select({ id: students.id, studentIdText: students.studentId })
  .from(students);
const studentIdByText = new Map(studentRows.map((s) => [s.studentIdText, s.id]));

const feeRows = await db
  .select({ id: feeStructures.id, feeName: feeStructures.feeName })
  .from(feeStructures)
  .where(
    and(
      eq(feeStructures.academicTermId, currentTerm.id),
      isNull(feeStructures.supersededAt)
    )
  );
const feeIdByName = new Map(feeRows.map((f) => [f.feeName, f.id]));

const rows: (typeof clubEnrollments.$inferInsert)[] = [];
let validationErrors = 0;
const seen = new Set<string>();

for (const p of pairs) {
  const dbStudentId = studentIdByText.get(p.student_id);
  if (dbStudentId === undefined) {
    console.error(`ERROR: student_id '${p.student_id}' not found in students table.`);
    validationErrors++;
    continue;
  }

  const feeStructureId = feeIdByName.get(p.name);
  if (feeStructureId === undefined) {
    console.error(
      `ERROR: fee_structures row for club '${p.name}' (term=${currentTerm.id}, active) not found.`
    );
    validationErrors++;
    continue;
  }

  const key = `${dbStudentId}:${feeStructureId}`;
  if (seen.has(key)) {
    console.error(
      `ERROR: duplicate (student_id=${p.student_id}, club='${p.name}') in scraped JSON.`
    );
    validationErrors++;
    continue;
  }
  seen.add(key);

  rows.push({
    studentId: dbStudentId,
    feeStructureId,
    academicTermId: currentTerm.id,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const result = await db
  .insert(clubEnrollments)
  .values(rows)
  .onConflictDoNothing({
    target: [clubEnrollments.studentId, clubEnrollments.feeStructureId],
  })
  .returning({ id: clubEnrollments.id });

const inserted = result.length;
const skipped = rows.length - inserted;

console.log(`Done. ${inserted} inserted, ${skipped} skipped (already existed).`);

await client.end();

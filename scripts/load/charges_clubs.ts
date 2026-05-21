/**
 * Creates one term-scoped `charges` row per `club_enrollments` row for the
 * current academic term.
 *
 *   - studentId        ← club_enrollments.studentId
 *   - academicYearId   ← null
 *   - academicTermId   ← current academic_terms row (is_current = true)
 *   - feeName          ← fee_structures.feeName (the club name)
 *   - amount           ← fee_structures.data.fee
 *
 * The charges table has no unique constraint on (student_id, academic_term_id,
 * fee_name), so this script reads existing club charges for the term and skips
 * those (student, fee_name) pairs to stay re-runnable without duplicating.
 *
 * Usage:
 *   pnpm load:charges-clubs
 *
 * Required env var: DIRECT_URL
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import {
  academicTerms,
  charges,
  clubEnrollments,
  feeStructures,
} from "@/db/schema";

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { academicTerms, charges, clubEnrollments, feeStructures },
});

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
  `Loading club charges for term '${currentTerm.name}' (id=${currentTerm.id}).`
);

const enrolled = await db
  .select({
    studentId: clubEnrollments.studentId,
    feeName: feeStructures.feeName,
    data: feeStructures.data,
  })
  .from(clubEnrollments)
  .innerJoin(feeStructures, eq(feeStructures.id, clubEnrollments.feeStructureId))
  .where(
    and(
      eq(clubEnrollments.academicTermId, currentTerm.id),
      isNull(feeStructures.supersededAt)
    )
  );

console.log(`Found ${enrolled.length} club enrolment(s) for the current term.`);

let validationErrors = 0;
const rows: (typeof charges.$inferInsert)[] = [];

for (const e of enrolled) {
  const data = e.data as { fee?: unknown };
  const fee = data?.fee;
  if (typeof fee !== "number" || !Number.isFinite(fee)) {
    console.error(
      `ERROR: fee_structures row for '${e.feeName}' has invalid data.fee (got ${JSON.stringify(fee)}); student_id=${e.studentId}.`
    );
    validationErrors++;
    continue;
  }
  rows.push({
    studentId: e.studentId,
    academicYearId: null,
    academicTermId: currentTerm.id,
    feeName: e.feeName,
    amount: fee,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const existing = await db
  .select({ studentId: charges.studentId, feeName: charges.feeName })
  .from(charges)
  .where(eq(charges.academicTermId, currentTerm.id));
const existingKeys = new Set(existing.map((r) => `${r.studentId}:${r.feeName}`));

const newRows = rows.filter((r) => !existingKeys.has(`${r.studentId}:${r.feeName}`));
const skipped = rows.length - newRows.length;

if (newRows.length === 0) {
  console.log(`Nothing to insert. ${skipped} already existed.`);
  await client.end();
  process.exit(0);
}

const result = await db.insert(charges).values(newRows).returning({ id: charges.id });

console.log(`Done. ${result.length} inserted, ${skipped} skipped (already existed).`);

await client.end();

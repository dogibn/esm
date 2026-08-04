/**
 * Loads tuition discounts for academic year 1.
 *
 * Sources:
 *   - scripts/processed/students_tuition.matched.json  — [{student_id, code}]
 *   - scripts/processed/tuition_25-26.cleaned.json     — has discount columns per code
 *
 * For each pair: maps student_id → enrollment_id (academic year 1), reads the
 * matching tuition row by code, and emits one discount row per non-null / non-zero
 * value among these keys:
 *   staff, corporate, barter, early_bird_discount, deal_discount,
 *   sibling_discount, scholarship
 *
 * `discounts.created_by` is NOT NULL → uses any existing user; if none exist,
 * creates a placeholder admin row (UUID printed for later editing).
 *
 * Re-runnable: skips (enrollment_id, name) pairs that already exist.
 *
 * Usage:
 *   pnpm load:discounts
 *
 * Required env var: DIRECT_URL
 */

import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { discounts, enrollments, students, users } from "@/db/schema";

const ACADEMIC_YEAR_ID = 1;

const DISCOUNT_KEYS = [
  "staff",
  "corporate",
  "barter",
  "early_bird_discount",
  "deal_discount",
  "sibling_discount",
  "scholarship",
] as const;

type DiscountKey = (typeof DISCOUNT_KEYS)[number];

interface MatchedPair {
  student_id: string | number;
  code: string;
}

type TuitionRow = {
  code: string;
} & Partial<Record<DiscountKey, number | null>>;

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { discounts, enrollments, students, users } });

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

const [anyUser] = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .limit(1);

let createdBy: string;
if (anyUser) {
  createdBy = anyUser.id;
  console.log(`Using existing user ${anyUser.email} (${anyUser.id}) for created_by.`);
} else {
  const placeholderId = randomUUID();
  const placeholderEmail = "placeholder-admin@esm.local";
  await db.insert(users).values({
    id: placeholderId,
    email: placeholderEmail,
    role: "admin",
  });
  createdBy = placeholderId;
  console.log("");
  console.log("==============================================================");
  console.log("  CREATED PLACEHOLDER ADMIN USER — edit id/email later:");
  console.log(`    id:    ${placeholderId}`);
  console.log(`    email: ${placeholderEmail}`);
  console.log(`    role:  admin`);
  console.log("==============================================================");
  console.log("");
}

const pairs = readJson<MatchedPair>("scripts/processed/students_tuition.matched.json");
const tuitionRows = readJson<TuitionRow>("scripts/processed/tuition_25-26.cleaned.json");

const tuitionByCode = new Map<string, TuitionRow>();
for (const t of tuitionRows) {
  tuitionByCode.set(t.code, t);
}

const enrolledRows = await db
  .select({
    enrollmentId: enrollments.id,
    studentIdText: students.studentId,
  })
  .from(enrollments)
  .innerJoin(students, eq(students.id, enrollments.studentId))
  .where(eq(enrollments.academicYearId, ACADEMIC_YEAR_ID));
const enrollmentIdByStudentText = new Map(
  enrolledRows.map((e) => [e.studentIdText, e.enrollmentId])
);

let validationErrors = 0;
// Historical import records discounts as flat MNT amounts (unit='mnt',
// value === amount). Position is assigned per enrollment below, after dedup.
type CandidateRow = {
  enrollmentId: number;
  name: string;
  amount: number;
  createdBy: string;
};
const rows: CandidateRow[] = [];

for (const p of pairs) {
  const studentIdText = String(p.student_id);
  const enrollmentId = enrollmentIdByStudentText.get(studentIdText);
  if (enrollmentId === undefined) {
    console.error(
      `ERROR: no enrollment for student_id='${studentIdText}' in academic year ${ACADEMIC_YEAR_ID}.`
    );
    validationErrors++;
    continue;
  }

  const tuition = tuitionByCode.get(p.code);
  if (!tuition) {
    console.error(`ERROR: no tuition row for code='${p.code}'.`);
    validationErrors++;
    continue;
  }

  for (const key of DISCOUNT_KEYS) {
    const value = tuition[key];
    if (value === null || value === undefined || value === 0) continue;
    rows.push({
      enrollmentId,
      name: key,
      amount: value,
      createdBy,
    });
  }
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

console.log(`Built ${rows.length} candidate discount row(s) from ${pairs.length} pair(s).`);

const existing = await db
  .select({
    enrollmentId: discounts.enrollmentId,
    name: discounts.name,
    position: discounts.position,
  })
  .from(discounts);
const existingSet = new Set(existing.map((r) => `${r.enrollmentId}:${r.name}`));

// Next free position per enrollment, so appended rows never collide with the
// UNIQUE (enrollment_id, position) index.
const nextPosByEnrollment = new Map<number, number>();
for (const r of existing) {
  const next = Math.max(nextPosByEnrollment.get(r.enrollmentId) ?? 0, r.position + 1);
  nextPosByEnrollment.set(r.enrollmentId, next);
}

const newRows: (typeof discounts.$inferInsert)[] = rows
  .filter((r) => !existingSet.has(`${r.enrollmentId}:${r.name}`))
  .map((r) => {
    const position = nextPosByEnrollment.get(r.enrollmentId) ?? 0;
    nextPosByEnrollment.set(r.enrollmentId, position + 1);
    return {
      enrollmentId: r.enrollmentId,
      name: r.name,
      unit: "mnt" as const,
      value: r.amount,
      position,
      amount: r.amount,
      createdBy: r.createdBy,
    };
  });
const skipped = rows.length - newRows.length;

if (newRows.length === 0) {
  console.log(`Nothing to insert. ${skipped} already existed.`);
  await client.end();
  process.exit(0);
}

const result = await db.insert(discounts).values(newRows).returning({ id: discounts.id });

console.log(`Done. ${result.length} inserted, ${skipped} skipped (already existed).`);

await client.end();

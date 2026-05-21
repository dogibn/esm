/**
 * Applies per-student tuition overrides from the source financial document.
 *
 * For each (student_id, code) pair in students_tuition.matched.json, compares
 * the matching `tuition` value from tuition_25-26.cleaned.json against the
 * student's current tuition charge (academic year 1, feeName='tuition'). If
 * they differ, updates the charge `amount` and stamps
 *   notes = 'from source tuition_25-26 file'
 *
 * Idempotent — re-running only touches rows that still differ.
 *
 * After applying, prints student id=5322's tuition charge for verification.
 *
 * Usage:
 *   pnpm load:charges-tuition-overrides
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { charges, students } from "@/db/schema";

const ACADEMIC_YEAR_ID = 1;
const FEE_NAME = "tuition";
const NOTES = "from source tuition_25-26 file";
const VERIFY_STUDENT_ID = "5322";

interface MatchedPair {
  student_id: string | number;
  code: string;
}

interface TuitionRow {
  code: string;
  tuition?: number | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { charges, students } });

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
const tuitionRows = readJson<TuitionRow>("scripts/processed/tuition_25-26.cleaned.json");

const tuitionByCode = new Map<string, TuitionRow>();
for (const t of tuitionRows) {
  tuitionByCode.set(t.code, t);
}

const expectedByStudent = new Map<string, number>();
for (const p of pairs) {
  const t = tuitionByCode.get(p.code);
  if (!t || t.tuition == null) continue;
  expectedByStudent.set(String(p.student_id), t.tuition);
}

const currentCharges = await db
  .select({
    chargeId: charges.id,
    amount: charges.amount,
    studentIdText: students.studentId,
  })
  .from(charges)
  .innerJoin(students, eq(students.id, charges.studentId))
  .where(and(eq(charges.academicYearId, ACADEMIC_YEAR_ID), eq(charges.feeName, FEE_NAME)));

const updates: { chargeId: number; oldAmount: number; newAmount: number }[] = [];
for (const c of currentCharges) {
  const expected = expectedByStudent.get(c.studentIdText);
  if (expected === undefined) continue;
  if (expected !== c.amount) {
    updates.push({ chargeId: c.chargeId, oldAmount: c.amount, newAmount: expected });
  }
}

console.log(
  `Found ${updates.length} tuition charge(s) needing override (out of ${currentCharges.length}).`
);

for (const u of updates) {
  await db
    .update(charges)
    .set({ amount: u.newAmount, notes: NOTES })
    .where(eq(charges.id, u.chargeId));
}

console.log(`Done. ${updates.length} charge(s) updated.`);

const [verifyStudent] = await db
  .select({
    id: students.id,
    studentIdText: students.studentId,
    firstName: students.firstName,
    lastName: students.lastName,
  })
  .from(students)
  .where(eq(students.studentId, VERIFY_STUDENT_ID))
  .limit(1);

console.log("");
console.log(`--- Verification: student_id='${VERIFY_STUDENT_ID}' ---`);
if (!verifyStudent) {
  console.log(`No student found with student_id='${VERIFY_STUDENT_ID}'.`);
} else {
  console.log(
    `student: id=${verifyStudent.id} student_id='${verifyStudent.studentIdText}' name='${verifyStudent.firstName} ${verifyStudent.lastName}'`
  );
  const verifyCharges = await db
    .select({
      id: charges.id,
      amount: charges.amount,
      notes: charges.notes,
      feeName: charges.feeName,
      academicYearId: charges.academicYearId,
    })
    .from(charges)
    .where(
      and(
        eq(charges.studentId, verifyStudent.id),
        eq(charges.academicYearId, ACADEMIC_YEAR_ID),
        eq(charges.feeName, FEE_NAME)
      )
    );
  console.log(`tuition charge(s): ${JSON.stringify(verifyCharges, null, 2)}`);
  const expected = expectedByStudent.get(VERIFY_STUDENT_ID);
  console.log(
    `expected tuition from source: ${expected === undefined ? "(no source row)" : expected}`
  );
}

await client.end();

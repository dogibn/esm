/**
 * Verifies that each student's net tuition in the DB matches the `total_payment`
 * field in the original parsed source file.
 *
 * For every enrollment in academic year 1 with student_code IS NOT NULL:
 *   net = (tuition charge.amount) − Σ (discounts.amount for that enrollment)
 *   expected = tuition_25-26.json[code].total_payment
 * Mismatches and edge cases are appended as a new section to scripts/reports/report.md.
 *
 * Read-only — no DB writes.
 *
 * Usage:
 *   pnpm qa:tuition-totals
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync, appendFileSync } from "fs";
import { resolve } from "path";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  charges,
  discounts,
  enrollments,
  grades,
  students,
} from "@/db/schema";

const ACADEMIC_YEAR_ID = 1;
const TUITION_JSON = "scripts/parsed/tuition_25-26.json";
const REPORT_PATH = "scripts/reports/report.md";

type TuitionRow = {
  contract: string | null;
  code: string;
  surname: string;
  name: string;
  grade: string;
  total_payment: number;
};

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { charges, discounts, enrollments, grades, students },
});

const tuitionRaw = readFileSync(resolve(process.cwd(), TUITION_JSON), "utf-8");
const tuitionRows = JSON.parse(tuitionRaw) as TuitionRow[];
const tuitionByCode = new Map<string, TuitionRow>();
for (const t of tuitionRows) {
  if (t.code) tuitionByCode.set(String(t.code), t);
}
console.log(`Loaded ${tuitionRows.length} tuition rows from ${TUITION_JSON}.`);

// Enrollments for the year with student_code set, plus student name and grade.
const enrolledRows = await db
  .select({
    enrollmentId: enrollments.id,
    studentDbId: students.id,
    studentCode: enrollments.studentCode,
    contract: enrollments.tuitionContractId,
    firstName: students.firstName,
    lastName: students.lastName,
    gradeName: grades.name,
    status: enrollments.status,
  })
  .from(enrollments)
  .innerJoin(students, eq(students.id, enrollments.studentId))
  .innerJoin(grades, eq(grades.id, enrollments.gradeId))
  .where(
    and(
      eq(enrollments.academicYearId, ACADEMIC_YEAR_ID),
      isNotNull(enrollments.studentCode)
    )
  );

console.log(
  `Found ${enrolledRows.length} enrollment(s) in academic year ${ACADEMIC_YEAR_ID} with student_code set.`
);

// Tuition charges for the year, keyed by student_id.
const chargeRows = await db
  .select({
    studentDbId: charges.studentId,
    amount: charges.amount,
  })
  .from(charges)
  .where(
    and(
      eq(charges.academicYearId, ACADEMIC_YEAR_ID),
      eq(charges.feeName, "tuition")
    )
  );
const tuitionChargeByStudent = new Map<number, number>();
for (const c of chargeRows) {
  tuitionChargeByStudent.set(c.studentDbId, Number(c.amount));
}

// Discounts summed per enrollment.
const discountSumRows = await db
  .select({
    enrollmentId: discounts.enrollmentId,
    total: sql<string>`COALESCE(SUM(${discounts.amount}), 0)`.as("total"),
  })
  .from(discounts)
  .groupBy(discounts.enrollmentId);
const discountTotalByEnrollment = new Map<number, number>();
for (const d of discountSumRows) {
  discountTotalByEnrollment.set(d.enrollmentId, Number(d.total));
}

type Mismatch = {
  code: string;
  contract: string | null;
  studentName: string;
  grade: string;
  chargeAmount: number;
  discountTotal: number;
  computedNet: number;
  expected: number;
  diff: number;
};

type MissingCharge = {
  code: string;
  contract: string | null;
  studentName: string;
  grade: string;
  expected: number;
};

type EnrollmentNoTuition = {
  code: string;
  studentName: string;
  grade: string;
};

const mismatches: Mismatch[] = [];
const missingCharges: MissingCharge[] = [];
const enrollmentNotInTuition: EnrollmentNoTuition[] = [];
const seenCodesInDb = new Set<string>();
let matched = 0;
let verifiedUniverse = 0;

for (const e of enrolledRows) {
  const code = String(e.studentCode);
  seenCodesInDb.add(code);
  const studentName = `${e.lastName} ${e.firstName}`.trim();

  const tuition = tuitionByCode.get(code);
  if (!tuition) {
    enrollmentNotInTuition.push({
      code,
      studentName,
      grade: e.gradeName,
    });
    continue;
  }

  verifiedUniverse++;

  const chargeAmount = tuitionChargeByStudent.get(e.studentDbId);
  if (chargeAmount === undefined) {
    missingCharges.push({
      code,
      contract: e.contract ?? tuition.contract,
      studentName,
      grade: e.gradeName,
      expected: Number(tuition.total_payment),
    });
    continue;
  }

  const discountTotal = discountTotalByEnrollment.get(e.enrollmentId) ?? 0;
  const computedNet = chargeAmount - discountTotal;
  const expected = Number(tuition.total_payment);

  if (computedNet === expected) {
    matched++;
  } else {
    mismatches.push({
      code,
      contract: e.contract ?? tuition.contract,
      studentName,
      grade: e.gradeName,
      chargeAmount,
      discountTotal,
      computedNet,
      expected,
      diff: computedNet - expected,
    });
  }
}

const codesInJsonNotInDb: TuitionRow[] = [];
for (const t of tuitionRows) {
  const code = String(t.code);
  if (!seenCodesInDb.has(code)) {
    codesInJsonNotInDb.push(t);
  }
}

const fmt = (n: number) => n.toLocaleString("en-US");
const esc = (s: string | null | undefined) =>
  s == null ? "" : String(s).replace(/\|/g, "\\|");

const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const lines: string[] = [];
lines.push("");
lines.push("---");
lines.push(`## Tuition totals verification — ${ts}`);
lines.push(`**Source:** \`${TUITION_JSON}\` vs DB (academic_year_id=${ACADEMIC_YEAR_ID})`);
lines.push("");
lines.push(
  "Check: for each enrollment in 25-26 with `student_code` set, compare DB net tuition " +
    "(`charges.amount − Σ discounts.amount`) against `total_payment` in the source file."
);
lines.push("");
lines.push(`- Enrollments in year ${ACADEMIC_YEAR_ID} with \`student_code\` set: ${enrolledRows.length}`);
lines.push(`- Of those, code found in \`tuition_25-26.json\` (verification universe): ${verifiedUniverse}`);
lines.push(`- Matches (computed net == total_payment): ${matched}`);
lines.push(`- Mismatches: ${mismatches.length}`);
lines.push(`- Enrollments missing a tuition charge: ${missingCharges.length}`);
lines.push(`- Enrollments with \`student_code\` not in JSON: ${enrollmentNotInTuition.length}`);
lines.push(`- JSON codes with no matching enrollment in DB: ${codesInJsonNotInDb.length}`);

if (
  mismatches.length === 0 &&
  missingCharges.length === 0 &&
  enrollmentNotInTuition.length === 0 &&
  codesInJsonNotInDb.length === 0
) {
  lines.push("");
  lines.push("_All reconcile — no mismatches or edge cases._");
}

if (mismatches.length > 0) {
  lines.push("");
  lines.push("### Mismatches");
  lines.push("");
  lines.push(
    "| code | contract | name | grade | charge.amount | Σ discounts | computed net | source total_payment | diff |"
  );
  lines.push("|:---|:---|:---|:---|---:|---:|---:|---:|---:|");
  for (const m of mismatches) {
    lines.push(
      `| ${esc(m.code)} | ${esc(m.contract)} | ${esc(m.studentName)} | ${esc(m.grade)} | ${fmt(m.chargeAmount)} | ${fmt(m.discountTotal)} | ${fmt(m.computedNet)} | ${fmt(m.expected)} | ${fmt(m.diff)} |`
    );
  }
}

if (missingCharges.length > 0) {
  lines.push("");
  lines.push("### Enrollments in tuition file but missing a tuition charge");
  lines.push("");
  lines.push("| code | contract | name | grade | expected total_payment |");
  lines.push("|:---|:---|:---|:---|---:|");
  for (const m of missingCharges) {
    lines.push(
      `| ${esc(m.code)} | ${esc(m.contract)} | ${esc(m.studentName)} | ${esc(m.grade)} | ${fmt(m.expected)} |`
    );
  }
}

if (enrollmentNotInTuition.length > 0) {
  lines.push("");
  lines.push("### Enrollments with `student_code` not present in `tuition_25-26.json`");
  lines.push("");
  lines.push("| code | name | grade |");
  lines.push("|:---|:---|:---|");
  for (const e of enrollmentNotInTuition) {
    lines.push(`| ${esc(e.code)} | ${esc(e.studentName)} | ${esc(e.grade)} |`);
  }
}

if (codesInJsonNotInDb.length > 0) {
  lines.push("");
  lines.push("### Codes in `tuition_25-26.json` with no matching enrollment in DB");
  lines.push("");
  lines.push("| code | contract | surname | name | grade | total_payment |");
  lines.push("|:---|:---|:---|:---|:---|---:|");
  for (const t of codesInJsonNotInDb) {
    lines.push(
      `| ${esc(t.code)} | ${esc(t.contract)} | ${esc(t.surname)} | ${esc(t.name)} | ${esc(t.grade)} | ${fmt(Number(t.total_payment))} |`
    );
  }
}

lines.push("");

appendFileSync(resolve(process.cwd(), REPORT_PATH), lines.join("\n"));

console.log("");
console.log("Summary:");
console.log(`  Universe (enrollments with code, code in JSON): ${verifiedUniverse}`);
console.log(`  Matches: ${matched}`);
console.log(`  Mismatches: ${mismatches.length}`);
console.log(`  Missing tuition charge: ${missingCharges.length}`);
console.log(`  Enrollment code not in JSON: ${enrollmentNotInTuition.length}`);
console.log(`  JSON code without enrollment: ${codesInJsonNotInDb.length}`);
console.log("");
console.log(`Appended section to ${REPORT_PATH}.`);

await client.end();

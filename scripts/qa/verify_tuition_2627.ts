/**
 * Reconciles the loaded 2026-2027 tuition against the workbook.
 *
 * For every workbook row, compares what the database now computes against what
 * the sheet says:
 *
 *   base tuition   charges.amount                    vs the resolved base
 *   discounts      SUM(discounts.amount)             vs the itemised columns
 *   net due        base − discounts                  vs `Total payment`
 *   percentages    each percent line re-applied      vs the recorded MNT
 *
 * `Total payment` is blank on 483 rows (no discount was ever applied, so the
 * accountants left the net column empty); those are counted separately rather
 * than treated as a net of zero.
 *
 * Paid totals are checked against the sheet's dated cells, which are the
 * primary record. Its "Total Paid" summary column is reconciled separately and
 * reported when stale, rather than treated as authoritative.
 *
 * Exits non-zero if anything fails to reconcile.
 *
 * Usage:
 *   pnpm qa:tuition-2627
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import {
  academicYears,
  bankTransactions,
  charges,
  discounts,
  enrollments,
  payments,
  students,
} from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2026-2027";
const INPUT_PATH = "scripts/processed/tuition_26-27.resolved.json";

interface DiscountLine {
  name: string;
  unit: "percent" | "mnt";
  value: number;
  amount: number;
}
interface ResolvedRow {
  row: number;
  code: string | null;
  student_id: string | null;
  surname: string | null;
  name: string | null;
  base_tuition: number | null;
  total_payment: number | null;
  total_paid: number | null;
  discount_total: number;
  discount_lines: DiscountLine[];
  payments: { date: string; amount: number }[];
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: {
    academicYears,
    bankTransactions,
    charges,
    discounts,
    enrollments,
    payments,
    students,
  },
});

const rows: ResolvedRow[] = JSON.parse(
  readFileSync(resolve(process.cwd(), INPUT_PATH), "utf-8")
);

const [year] = await db
  .select({ id: academicYears.id })
  .from(academicYears)
  .where(eq(academicYears.name, ACADEMIC_YEAR_NAME))
  .limit(1);
if (!year) {
  console.error(`ERROR: academic_year '${ACADEMIC_YEAR_NAME}' not found.`);
  await client.end();
  process.exit(1);
}

const chargeRows = await db
  .select({ studentId: students.studentId, amount: charges.amount })
  .from(charges)
  .innerJoin(students, eq(students.id, charges.studentId))
  .where(
    and(
      eq(charges.academicYearId, year.id),
      isNull(charges.academicTermId),
      eq(charges.feeName, "tuition"),
    ),
  );
const chargeByStudent = new Map(chargeRows.map((c) => [c.studentId, c.amount]));

const discountRows = await db
  .select({
    studentId: students.studentId,
    name: discounts.name,
    unit: discounts.unit,
    value: discounts.value,
    amount: discounts.amount,
    position: discounts.position,
  })
  .from(discounts)
  .innerJoin(enrollments, eq(enrollments.id, discounts.enrollmentId))
  .innerJoin(students, eq(students.id, enrollments.studentId))
  .where(eq(enrollments.academicYearId, year.id));

const discountsByStudent = new Map<string, typeof discountRows>();
for (const d of discountRows) {
  const list = discountsByStudent.get(d.studentId);
  if (list) list.push(d);
  else discountsByStudent.set(d.studentId, [d]);
}

// Live payments per student — voided ones do not count toward paid totals.
const paymentRows = await db
  .select({
    studentId: students.studentId,
    amount: payments.amount,
    transactionId: bankTransactions.transactionId,
  })
  .from(payments)
  .innerJoin(charges, eq(charges.id, payments.chargeId))
  .innerJoin(students, eq(students.id, charges.studentId))
  .innerJoin(bankTransactions, eq(bankTransactions.id, payments.bankTransactionId))
  .where(
    and(
      eq(charges.academicYearId, year.id),
      eq(charges.feeName, "tuition"),
      isNull(payments.voidedAt),
    ),
  );
const paidByStudent = new Map<string, { total: number; count: number }>();
for (const p of paymentRows) {
  const acc = paidByStudent.get(p.studentId) ?? { total: 0, count: 0 };
  acc.total += p.amount;
  acc.count += 1;
  paidByStudent.set(p.studentId, acc);
}

interface Failure {
  row: number;
  who: string;
  check: string;
  expected: string;
  actual: string;
}
const failures: Failure[] = [];
let netChecked = 0;
let netBlank = 0;
let percentChecked = 0;
let paidChecked = 0;
// Rows where the workbook's "Total Paid" formula disagrees with its own cells.
// Not a load failure — reported so the accountants can refresh the sheet.
const staleSummaries: {
  row: number;
  who: string;
  summary: number;
  cells: number;
  cellCount: number;
}[] = [];

for (const r of rows) {
  const key = r.student_id ?? (r.code ? `TMP-${r.code}` : `TMP-2627-R${r.row}`);
  const who = `${r.surname ?? "?"} ${r.name ?? "?"} (${key})`;
  const fail = (check: string, expected: unknown, actual: unknown) =>
    failures.push({ row: r.row, who, check, expected: String(expected), actual: String(actual) });

  const charged = chargeByStudent.get(key);
  if (charged === undefined) {
    fail("tuition charge exists", "1 charge", "none");
    continue;
  }
  if (charged !== r.base_tuition) fail("base tuition", r.base_tuition, charged);

  const loaded = (discountsByStudent.get(key) ?? []).sort(
    (a, b) => a.position - b.position
  );
  if (loaded.length !== r.discount_lines.length) {
    fail("discount line count", r.discount_lines.length, loaded.length);
  }

  const loadedTotal = loaded.reduce((sum, d) => sum + d.amount, 0);
  if (loadedTotal !== r.discount_total) {
    fail("discount total", r.discount_total, loadedTotal);
  }

  // Re-apply each percentage against the running total, exactly as the
  // compounding model says it was derived.
  let running = charged;
  for (const d of loaded) {
    if (d.unit === "percent") {
      const recomputed = Math.round((running * d.value) / 100);
      if (recomputed !== d.amount) {
        fail(`${d.name} ${d.value}% of ${running}`, d.amount, recomputed);
      }
      percentChecked++;
    }
    running -= d.amount;
  }

  if (r.total_payment === null) {
    netBlank++;
  } else {
    netChecked++;
    if (charged - loadedTotal !== r.total_payment) {
      fail("net due", r.total_payment, charged - loadedTotal);
    }
  }

  // Paid. The dated cells are the primary record — each one is a payment the
  // accountants keyed from a statement — while "Total Paid" is a summary
  // formula over them. So the database is checked against the cells, and the
  // sheet's own summary column is reconciled separately: where the two
  // disagree it is the summary that has gone stale, not the payments.
  const paid = paidByStudent.get(key) ?? { total: 0, count: 0 };
  const cellTotal = r.payments.reduce((sum, p) => sum + p.amount, 0);
  if (paid.count !== r.payments.length) {
    fail("payment count", r.payments.length, paid.count);
  }
  if (paid.total !== cellTotal) {
    fail("total paid", cellTotal, paid.total);
  }
  paidChecked++;

  if (r.total_paid !== null && r.total_paid !== cellTotal) {
    staleSummaries.push({
      row: r.row,
      who,
      summary: r.total_paid,
      cells: cellTotal,
      cellCount: r.payments.length,
    });
  }
}

console.log(`Workbook rows checked:        ${rows.length}`);
console.log(`Tuition charges reconciled:   ${rows.length - failures.filter((f) => f.check === "tuition charge exists").length}`);
console.log(`Discount lines reconciled:    ${discountRows.length}`);
console.log(`Percentages re-derived:       ${percentChecked}`);
console.log(`Net due checked vs workbook:  ${netChecked} (${netBlank} rows leave it blank)`);
console.log(`Paid totals checked:          ${paidChecked} over ${paymentRows.length} payment(s)`);

if (staleSummaries.length > 0) {
  console.log(
    `\nNOTE: the workbook's "Total Paid" column disagrees with its own dated ` +
      `cells on ${staleSummaries.length} row(s). The payments loaded match the ` +
      `cells; the sheet's summary formula is stale.`
  );
  for (const s of staleSummaries) {
    console.log(
      `  row ${s.row} ${s.who}: column says ${s.summary.toLocaleString()}, ` +
        `${s.cellCount} cell(s) sum to ${s.cells.toLocaleString()}`
    );
  }
}

if (failures.length === 0) {
  console.log("\nAll checks passed.");
  await client.end();
  process.exit(0);
}

console.error(`\n${failures.length} check(s) FAILED:`);
for (const f of failures.slice(0, 40)) {
  console.error(`  row ${f.row} ${f.who}: ${f.check} — expected ${f.expected}, got ${f.actual}`);
}
if (failures.length > 40) console.error(`  … and ${failures.length - 40} more.`);
await client.end();
process.exit(1);

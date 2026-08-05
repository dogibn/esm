/**
 * Loads the 2026-2027 tuition payments from the workbook's dated columns.
 *
 * The sheet records a payment as a bare (date, amount) cell — no sender, memo
 * or bank reference, because the accountants keyed it from a statement they
 * reconciled offline. `payments.bank_transaction_id` is NOT NULL, so each cell
 * becomes a synthetic `bank_transactions` row carrying only what the workbook
 * knows, plus the payment allocating it to that student's tuition charge.
 *
 * These rows are deliberately easy to tell apart from imported statements:
 *
 *   transaction_id   XLS-2627-<student>-<date>  (deterministic, so a re-run is
 *                    a no-op and a re-export of the sheet does not duplicate)
 *   sender_name      NULL — unknown
 *   sender_account   NULL — unknown
 *   memo             the workbook cell it came from
 *   status           'matched' — it is allocated the moment it is created
 *
 * Timestamps use Ulaanbaatar local midnight (+08:00, no DST), matching the
 * bank-file parser (features/imports/parsing/bank-file.ts).
 *
 * Fifteen cells are negative — refunds and corrections. They load as negative
 * payments, which `payments.amount` permits and which keeps the loaded total
 * equal to the sheet's "Total Paid".
 *
 * Usage:
 *   pnpm load:payments-2627 [--dry-run]
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
  enrollments,
  payments,
  students,
  users,
} from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2026-2027";
const INPUT_PATH = "scripts/processed/tuition_26-27.resolved.json";
const ID_PREFIX = "XLS-2627";
const dryRun = process.argv.includes("--dry-run");

interface PaymentCell {
  date: string;
  amount: number;
}
interface ResolvedRow {
  row: number;
  code: string | null;
  student_id: string | null;
  surname: string | null;
  name: string | null;
  total_paid: number | null;
  payments: PaymentCell[];
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
    enrollments,
    payments,
    students,
    users,
  },
});

let rows: ResolvedRow[];
try {
  rows = JSON.parse(readFileSync(resolve(process.cwd(), INPUT_PATH), "utf-8"));
} catch {
  console.error(`ERROR: cannot read ${INPUT_PATH} — run the resolver first.`);
  process.exit(1);
}

const candidateActors = await db
  .select({ id: users.id, email: users.email, role: users.role })
  .from(users)
  .where(eq(users.isActive, true));
const actor =
  candidateActors.find((u) => u.role === "admin" && !u.email.endsWith("@esm.local")) ??
  candidateActors.find((u) => u.role === "admin") ??
  candidateActors[0];
if (!actor) {
  console.error("ERROR: no active users exist — run pnpm provision:users first.");
  await client.end();
  process.exit(1);
}
console.log(`Attributing to ${actor.email}.`);

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

// The tuition charge each payment is allocated to.
const chargeRows = await db
  .select({ chargeId: charges.id, studentId: students.studentId })
  .from(charges)
  .innerJoin(students, eq(students.id, charges.studentId))
  .where(
    and(
      eq(charges.academicYearId, year.id),
      isNull(charges.academicTermId),
      eq(charges.feeName, "tuition"),
    ),
  );
const chargeIdByStudent = new Map(chargeRows.map((c) => [c.studentId, c.chargeId]));

const existingTx = await db
  .select({ transactionId: bankTransactions.transactionId })
  .from(bankTransactions);
const existingTxIds = new Set(existingTx.map((t) => t.transactionId));

interface Planned {
  transactionId: string;
  transactionAt: Date;
  memo: string;
  amount: number;
  chargeId: number;
}
const planned: Planned[] = [];
const usedIds = new Set<string>();
let skipped = 0;
let negatives = 0;
let validationErrors = 0;

for (const row of rows) {
  if (row.payments.length === 0) continue;
  const naturalKey =
    row.student_id ?? (row.code ? `TMP-${row.code}` : `TMP-2627-R${row.row}`);
  const chargeId = chargeIdByStudent.get(naturalKey);
  if (chargeId === undefined) {
    console.error(
      `ERROR: row ${row.row}: student '${naturalKey}' has no ${ACADEMIC_YEAR_NAME} ` +
        `tuition charge — run pnpm load:charges-tuition-2627 first.`
    );
    validationErrors++;
    continue;
  }

  for (const cell of row.payments) {
    // Two cells on the same date for one student would collide; none do today,
    // but a suffix keeps the id unique rather than silently dropping one.
    let transactionId = `${ID_PREFIX}-${naturalKey}-${cell.date}`;
    for (let n = 2; usedIds.has(transactionId); n++) {
      transactionId = `${ID_PREFIX}-${naturalKey}-${cell.date}-${n}`;
    }
    usedIds.add(transactionId);

    if (existingTxIds.has(transactionId)) {
      skipped++;
      continue;
    }
    if (cell.amount < 0) negatives++;

    planned.push({
      transactionId,
      transactionAt: new Date(`${cell.date}T00:00:00+08:00`),
      memo: `Tuition ${ACADEMIC_YEAR_NAME} — workbook row ${row.row}, column ${cell.date}`,
      amount: cell.amount,
      chargeId,
    });
  }
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const total = planned.reduce((sum, p) => sum + p.amount, 0);
console.log(
  `${planned.length} payment(s) to write, ${skipped} already present. ` +
    `${negatives} negative (refunds). Total ${total.toLocaleString()} MNT.`
);

if (dryRun) {
  console.log("Dry run. Nothing written.");
  await client.end();
  process.exit(0);
}

if (planned.length === 0) {
  console.log("Nothing to insert.");
  await client.end();
  process.exit(0);
}

// One transaction: a payment must never exist without its bank transaction.
const inserted = await db.transaction(async (tx) => {
  const txRows = await tx
    .insert(bankTransactions)
    .values(
      planned.map((p) => ({
        transactionId: p.transactionId,
        senderName: null,
        senderAccount: null,
        memo: p.memo,
        amount: p.amount,
        transactionAt: p.transactionAt,
        status: "matched",
      }))
    )
    .returning({ id: bankTransactions.id, transactionId: bankTransactions.transactionId });

  const txIdByKey = new Map(txRows.map((t) => [t.transactionId, t.id]));
  return tx
    .insert(payments)
    .values(
      planned.map((p) => ({
        bankTransactionId: txIdByKey.get(p.transactionId)!,
        chargeId: p.chargeId,
        amount: p.amount,
        recordedBy: actor.id,
      }))
    )
    .returning({ id: payments.id });
});

console.log(`Done. ${inserted.length} payments and bank transactions inserted, ${skipped} skipped.`);

await client.end();

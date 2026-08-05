/**
 * Publishes the 2026-2027 per-level tuition rates as a `fee_structures` row.
 *
 * Amounts come from `processed/tuition_26-27.fee_structure.json` — the modal
 * gross tuition per grade level across the workbook, counted only over students
 * whose level esmlh confirms. Every level's vote is near-unanimous.
 *
 * The 2025-2026 row is deliberately **not** superseded. Both rows stay live and
 * the reader picks by academic year: `effective_from <= current year's end`,
 * latest wins (features/enrollments/api.ts § activeFeeData). Superseding would
 * switch the whole app to next year's prices the moment this script runs, months
 * before the year rolls over. `superseded_at` stays for what it means —
 * retiring a rate that was wrong — not for the passage of time.
 *
 * Idempotent: the unique index on (fee_name, academic_term_id, effective_from)
 * makes a re-run a no-op.
 *
 * Usage:
 *   pnpm load:fee-structure-2627 [--dry-run]
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import { academicYears, feeStructures, gradeLevels } from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2026-2027";
const FEE_NAME = "tuition";
const INPUT_PATH = "scripts/processed/tuition_26-27.fee_structure.json";
const dryRun = process.argv.includes("--dry-run");

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicYears, feeStructures, gradeLevels } });

let rates: Record<string, number>;
try {
  rates = JSON.parse(readFileSync(resolve(process.cwd(), INPUT_PATH), "utf-8"));
} catch {
  console.error(`ERROR: cannot read ${INPUT_PATH} — run the resolver first.`);
  process.exit(1);
}

const [year] = await db
  .select({ id: academicYears.id, startDate: academicYears.startDate })
  .from(academicYears)
  .where(eq(academicYears.name, ACADEMIC_YEAR_NAME))
  .limit(1);
if (!year) {
  console.error(`ERROR: academic_year '${ACADEMIC_YEAR_NAME}' not found.`);
  await client.end();
  process.exit(1);
}

// Every level must be priced: a missing one would silently under-bill whoever
// lands in it later.
const levelRows = await db.select({ code: gradeLevels.code }).from(gradeLevels);
const missing = levelRows.map((l) => l.code).filter((code) => !(code in rates));
if (missing.length > 0) {
  console.error(`ERROR: no 2026-2027 rate for grade level(s): ${missing.join(", ")}.`);
  await client.end();
  process.exit(1);
}

const [existing] = await db
  .select({ id: feeStructures.id })
  .from(feeStructures)
  .where(
    and(
      eq(feeStructures.feeName, FEE_NAME),
      isNull(feeStructures.academicTermId),
      eq(feeStructures.effectiveFrom, year.startDate),
    ),
  )
  .limit(1);

if (existing) {
  console.log(
    `Already present: '${FEE_NAME}' effective ${year.startDate} (id=${existing.id}). Nothing to do.`
  );
  await client.end();
  process.exit(0);
}

console.log(`Publishing '${FEE_NAME}' rates effective ${year.startDate}:`);
for (const [code, amount] of Object.entries(rates)) {
  console.log(`  ${code.padEnd(4)} ${amount.toLocaleString()}`);
}

if (dryRun) {
  console.log("Dry run. Nothing written.");
  await client.end();
  process.exit(0);
}

const [inserted] = await db
  .insert(feeStructures)
  .values({
    feeName: FEE_NAME,
    data: rates,
    academicTermId: null,
    effectiveFrom: year.startDate,
  })
  .returning({ id: feeStructures.id });

console.log(`Done. Inserted fee_structures id=${inserted!.id}.`);

await client.end();

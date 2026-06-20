/**
 * Refreshes "Per Session" club charge amounts (homework club) from esmlh's
 * accrued Total Fee. Reads scripts/scraped/per_session_fees.json (produced by
 * `python -m scrape.per_session_fees`) and, for each (student, club):
 *
 *   - resolves students.id from the natural-key student_id text
 *   - finds the current-term charge(s) for (student, fee_name)
 *   - UPDATEs the amount to total_fee when it differs
 *   - INSERTs the charge when missing
 *
 * This loader OWNS Per Session club charges end-to-end — charges_clubs.ts skips
 * them. Their amount is intentionally MUTABLE: the obligation grows with
 * attendance, a deliberate exception to the "resolved gross at creation, never
 * propagate" rule that governs every other charge (see domain_model.md).
 * Existing payments are untouched; balance = amount − paid recomputes.
 *
 * Idempotent and safe to run on a schedule. esmlh's Total Fee is the source of
 * truth for Per Session obligations, so a null total_fee (a blank cell — no
 * sessions accrued yet) is treated as 0: the charge is set to 0 rather than
 * left at a stale seed amount. (Caveat: a transient blank read on a charge that
 * already received payments would show a large overpayment until the next good
 * read — see the no-payments note in the loop.)
 *
 * Usage:
 *   pnpm refresh:per-session-charges             # apply
 *   pnpm refresh:per-session-charges --dry-run   # preview, no writes
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { academicTerms, charges, students } from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

const INPUT_PATH = fileURLToPath(
  new URL("../scraped/per_session_fees.json", import.meta.url)
);

type FeeRecord = { student_id: string; name: string; total_fee: number | null };

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

let records: FeeRecord[];
try {
  records = JSON.parse(readFileSync(INPUT_PATH, "utf-8")) as FeeRecord[];
} catch (e) {
  console.error(
    `ERROR: cannot read ${INPUT_PATH} — run \`python -m scrape.per_session_fees\` first. (${(e as Error).message})`
  );
  process.exit(1);
}
console.log(
  `Read ${records.length} per-session fee record(s)${DRY_RUN ? " — DRY RUN, no writes" : ""}.`
);

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { academicTerms, charges, students } });

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
console.log(`Current term: '${currentTerm.name}' (id=${currentTerm.id}).`);

// Resolve every student_id text once.
const studentRows = await db
  .select({ id: students.id, studentId: students.studentId })
  .from(students);
const idByText = new Map(studentRows.map((s) => [s.studentId, s.id]));

let created = 0;
let updated = 0;
let unchanged = 0;
let zeroedNoFee = 0;
let invalidFee = 0;
let missingStudent = 0;

for (const r of records) {
  // esmlh's Total Fee is the source of truth for Per Session obligations. A
  // blank cell (scraped as null) means 0 sessions accrued → owes 0, so the
  // charge is set to 0 to stay consistent with Total Fee, rather than left at
  // a stale seed amount.
  let fee: number;
  if (r.total_fee === null || r.total_fee === undefined) {
    fee = 0;
    zeroedNoFee++;
  } else if (
    typeof r.total_fee === "number" &&
    Number.isFinite(r.total_fee) &&
    r.total_fee >= 0
  ) {
    fee = r.total_fee;
  } else {
    console.error(
      `  WARN: '${r.name}' student=${r.student_id} has invalid total_fee ${JSON.stringify(r.total_fee)}; skipping.`
    );
    invalidFee++;
    continue;
  }

  const studentPk = idByText.get(r.student_id);
  if (studentPk === undefined) {
    console.error(`  WARN: student_id '${r.student_id}' not found; skipping '${r.name}'.`);
    missingStudent++;
    continue;
  }

  // No unique constraint on charges; match (and update) every row for this
  // (student, term, fee) rather than assume exactly one.
  const existing = await db
    .select({ id: charges.id, amount: charges.amount })
    .from(charges)
    .where(
      and(
        eq(charges.studentId, studentPk),
        eq(charges.academicTermId, currentTerm.id),
        eq(charges.feeName, r.name)
      )
    );

  if (existing.length === 0) {
    console.log(`  + create  '${r.name}' student=${r.student_id} amount=${fee}`);
    if (!DRY_RUN) {
      await db.insert(charges).values({
        studentId: studentPk,
        academicYearId: null,
        academicTermId: currentTerm.id,
        feeName: r.name,
        amount: fee,
      });
    }
    created++;
    continue;
  }

  for (const c of existing) {
    if (Number(c.amount) === fee) {
      unchanged++;
      continue;
    }
    console.log(
      `  ~ update  '${r.name}' student=${r.student_id} ${c.amount} → ${fee}`
    );
    if (!DRY_RUN) {
      await db.update(charges).set({ amount: fee }).where(eq(charges.id, c.id));
    }
    updated++;
  }
}

console.log(
  `Done${DRY_RUN ? " (DRY RUN, no writes)" : ""}. ` +
    `created=${created} updated=${updated} unchanged=${unchanged} ` +
    `zeroed_no_fee=${zeroedNoFee} invalid_fee=${invalidFee} missing_student=${missingStudent}.`
);

await client.end();

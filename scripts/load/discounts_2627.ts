/**
 * Loads the 2026-2027 tuition discounts, extending the `discount_types` catalog
 * to cover every kind the workbook uses.
 *
 * The resolver has already turned each row's discount columns into ordered
 * lines (see `build_discount_lines`). What that recovered from the numbers:
 *
 *   Early-bird   a flat 5,000,000 MNT — 546 of 549 rows exactly
 *   Siblings     a percentage of what is left *after* early-bird: 5% (206) or
 *                50% (72), so the catalog default is 5%
 *   Staff        a percentage of gross: 90/80/75/70/60/50/40, negotiated per
 *                family, so the catalog carries no default
 *   Scholarship  a flat negotiated amount (1M / 2M / 5M / 10M / 15M)
 *   Corporate    a flat negotiated amount (one row)
 *   Barter       a flat negotiated amount (four rows)
 *
 * "Deal & Discount" is a column in the sheet with no values in it, so no type
 * is created for it.
 *
 * That sibling percentages read against the post-early-bird running total is
 * why `position` matters and why the order here is not the sheet's column
 * order: `discounts.position` is the compounding order (domain_model.md
 * § Discount), and reproducing it is what makes the stored `unit`/`value` pair
 * regenerate the recorded `amount` exactly.
 *
 * `amount` is always the MNT figure from the workbook, so balances reconcile
 * with the sheet whatever the unit says. A percentage is only claimed when it
 * round-trips to that amount to the last MNT — three rows fall back to `mnt`.
 *
 * Existing catalog rows are never modified. Note the 2025-2026 catalog defines
 * Early-bird as 10% while 2026-2027 bills it as a flat 5,000,000; the discount
 * rows carry their own snapshot, so this only affects what a new contract
 * prefills. Retune the catalog from the Fees screen if that matters.
 *
 * Re-runnable: skips (enrollment, name) pairs that already exist.
 *
 * Usage:
 *   pnpm load:discounts-2627 [--dry-run]
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import {
  academicYears,
  discountTypes,
  discounts,
  enrollments,
  students,
  users,
} from "@/db/schema";

const ACADEMIC_YEAR_NAME = "2026-2027";
const INPUT_PATH = "scripts/processed/tuition_26-27.resolved.json";
const dryRun = process.argv.includes("--dry-run");

// Catalog entries the workbook needs. `value: null` means "custom" — supplied
// when the discount is applied, which is exactly how these are negotiated.
const REQUIRED_TYPES: {
  name: string;
  unit: "percent" | "mnt";
  value: number | null;
  note: string;
}[] = [
  { name: "Staff", unit: "percent", value: null, note: "Staff child. Percentage of gross tuition, agreed per family." },
  { name: "Corporate", unit: "mnt", value: null, note: "Corporate partner allowance." },
  { name: "Barter", unit: "mnt", value: null, note: "Settled in goods or services rather than cash." },
];

interface DiscountLine {
  column: string;
  name: string;
  unit: "percent" | "mnt";
  value: number;
  amount: number;
  position: number;
}

interface ResolvedRow {
  row: number;
  code: string | null;
  student_id: string | null;
  discount_lines: DiscountLine[];
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: { academicYears, discountTypes, discounts, enrollments, students, users },
});

let rows: ResolvedRow[];
try {
  rows = JSON.parse(readFileSync(resolve(process.cwd(), INPUT_PATH), "utf-8"));
} catch {
  console.error(`ERROR: cannot read ${INPUT_PATH} — run the resolver first.`);
  process.exit(1);
}

// `discounts.created_by` is NOT NULL. Prefer a real active admin over the
// seed placeholders, so the audit trail names someone who can be asked about
// the import rather than `placeholder-admin@esm.local`.
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

// 1. Make sure the catalog covers every discount the workbook uses.
const existingTypes = await db
  .select({ id: discountTypes.id, name: discountTypes.name })
  .from(discountTypes);
const typeIdByName = new Map(existingTypes.map((t) => [t.name, t.id]));

const toCreate = REQUIRED_TYPES.filter((t) => !typeIdByName.has(t.name));
if (toCreate.length > 0 && !dryRun) {
  const created = await db
    .insert(discountTypes)
    .values(toCreate.map((t) => ({ ...t, createdBy: actor.id })))
    .returning({ id: discountTypes.id, name: discountTypes.name });
  for (const t of created) typeIdByName.set(t.name, t.id);
  console.log(`Catalog: added ${created.map((t) => t.name).join(", ")}.`);
} else if (toCreate.length > 0) {
  console.log(`Catalog: would add ${toCreate.map((t) => t.name).join(", ")}.`);
} else {
  console.log("Catalog: already complete.");
}

// 2. Map each workbook row to its 2026-2027 enrolment.
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

const enrolled = await db
  .select({ enrollmentId: enrollments.id, studentId: students.studentId })
  .from(enrollments)
  .innerJoin(students, eq(students.id, enrollments.studentId))
  .where(eq(enrollments.academicYearId, year.id));
const enrollmentIdByStudentId = new Map(
  enrolled.map((e) => [e.studentId, e.enrollmentId])
);

// 3. Build the candidate rows.
interface Candidate {
  enrollmentId: number;
  line: DiscountLine;
}
const candidates: Candidate[] = [];
let validationErrors = 0;

for (const row of rows) {
  if (row.discount_lines.length === 0) continue;
  const naturalKey =
    row.student_id ?? (row.code ? `TMP-${row.code}` : `TMP-2627-R${row.row}`);
  const enrollmentId = enrollmentIdByStudentId.get(naturalKey);
  if (enrollmentId === undefined) {
    console.error(
      `ERROR: row ${row.row}: student '${naturalKey}' has no ${ACADEMIC_YEAR_NAME} ` +
        `enrolment — run pnpm load:enrollments-2627 first.`
    );
    validationErrors++;
    continue;
  }
  for (const line of row.discount_lines) {
    if (!typeIdByName.has(line.name) && !dryRun) {
      console.error(`ERROR: row ${row.row}: no catalog entry named '${line.name}'.`);
      validationErrors++;
      continue;
    }
    candidates.push({ enrollmentId, line });
  }
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

// 4. Skip what is already loaded, and keep positions clear of existing rows.
const existing = await db
  .select({
    enrollmentId: discounts.enrollmentId,
    name: discounts.name,
    position: discounts.position,
  })
  .from(discounts);
const existingKeys = new Set(existing.map((d) => `${d.enrollmentId}:${d.name}`));
const nextPosition = new Map<number, number>();
for (const d of existing) {
  nextPosition.set(
    d.enrollmentId,
    Math.max(nextPosition.get(d.enrollmentId) ?? 0, d.position + 1)
  );
}

const values: (typeof discounts.$inferInsert)[] = [];
let skipped = 0;
for (const { enrollmentId, line } of candidates) {
  if (existingKeys.has(`${enrollmentId}:${line.name}`)) {
    skipped++;
    continue;
  }
  // Rebase onto whatever positions the enrolment already has, preserving the
  // resolver's relative order.
  const base = nextPosition.get(enrollmentId) ?? 0;
  values.push({
    enrollmentId,
    discountTypeId: typeIdByName.get(line.name) ?? null,
    name: line.name,
    unit: line.unit,
    value: line.value,
    position: base,
    amount: line.amount,
    createdBy: actor.id,
  });
  nextPosition.set(enrollmentId, base + 1);
}

const byUnit = values.reduce<Record<string, number>>((acc, v) => {
  acc[v.unit] = (acc[v.unit] ?? 0) + 1;
  return acc;
}, {});
const totalMnt = values.reduce((sum, v) => sum + (v.amount as number), 0);
console.log(
  `${values.length} discount line(s) to write (${JSON.stringify(byUnit)}), ` +
    `${skipped} already present. Total ${totalMnt.toLocaleString()} MNT.`
);

if (dryRun) {
  console.log("Dry run. Nothing written.");
  await client.end();
  process.exit(0);
}

if (values.length === 0) {
  console.log("Nothing to insert.");
  await client.end();
  process.exit(0);
}

const result = await db
  .insert(discounts)
  .values(values)
  .returning({ id: discounts.id });
console.log(`Done. ${result.length} inserted, ${skipped} skipped.`);

await client.end();

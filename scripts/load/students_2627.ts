/**
 * Upserts the `students` rows the 2026-2027 workbook implies.
 *
 * Names come from the workbook, which is the accountants' own record and the
 * one the contracts are written against: `Surname` → `last_name`, `Name` →
 * `first_name` (verified against esmlh — 1175 of 1253 directory-matched rows
 * agree exactly and none are transposed). Parent contact details still come
 * from esmlh, and are only ever written when esmlh actually has a value, so a
 * student the new directory has not listed yet keeps last year's contacts.
 *
 * Students the resolver could not tie to an esmlh record are inserted with a
 * placeholder `student_id`, because the column is NOT NULL and unique and the
 * school has not issued them an id yet:
 *
 *   TMP-<code>          when the workbook has a code — stable, since a code
 *                       belongs to the student for life
 *   TMP-2627-R<row>     otherwise — falls back to the workbook row, so it is
 *                       stable only for this export of the file
 *
 * Both are listed in the run's report. Swap them for the real esmlh id once
 * the school issues one; nothing else keys off them.
 *
 * Idempotent: re-running updates names in place rather than duplicating.
 *
 * Usage:
 *   pnpm load:students-2627 [--dry-run]
 *
 * Required env var: DIRECT_URL
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { students } from "@/db/schema";

const INPUT_PATH = "scripts/processed/tuition_26-27.resolved.json";
const REPORT_PATH = "scripts/reports/tuition_26-27.students.md";
const dryRun = process.argv.includes("--dry-run");

interface ResolvedRow {
  row: number;
  code: string | null;
  surname: string | null;
  name: string | null;
  student_id: string | null;
  identity_source: string;
  web_first_name: string | null;
  web_last_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, { schema: { students } });

let rows: ResolvedRow[];
try {
  rows = JSON.parse(readFileSync(resolve(process.cwd(), INPUT_PATH), "utf-8"));
} catch {
  console.error(`ERROR: cannot read ${INPUT_PATH} — run the resolver first.`);
  process.exit(1);
}

function placeholderId(row: ResolvedRow): string {
  return row.code ? `TMP-${row.code}` : `TMP-2627-R${row.row}`;
}

const values: (typeof students.$inferInsert)[] = [];
const placeholders: { studentId: string; row: ResolvedRow }[] = [];
const seen = new Map<string, number>();
let validationErrors = 0;

for (const row of rows) {
  if (!row.surname && !row.name) {
    console.error(`ERROR: row ${row.row} has neither surname nor name.`);
    validationErrors++;
    continue;
  }
  const studentId = row.student_id ?? placeholderId(row);
  const firstSeenAt = seen.get(studentId);
  if (firstSeenAt !== undefined) {
    console.error(
      `ERROR: student_id '${studentId}' is claimed by both row ${firstSeenAt} ` +
        `and row ${row.row}.`
    );
    validationErrors++;
    continue;
  }
  seen.set(studentId, row.row);
  if (!row.student_id) placeholders.push({ studentId, row });

  values.push({
    studentId,
    // The workbook is the billing record; a blank cell falls back to esmlh so
    // the NOT NULL columns always have something meaningful.
    firstName: row.name ?? row.web_first_name ?? "",
    lastName: row.surname ?? row.web_last_name ?? "",
    parentPhone: row.parent_phone,
    parentEmail: row.parent_email,
  });
}

if (validationErrors > 0) {
  console.error(`ERROR: ${validationErrors} validation error(s) — aborting, no rows written.`);
  await client.end();
  process.exit(1);
}

const before = await db
  .select({ studentId: students.studentId, firstName: students.firstName, lastName: students.lastName })
  .from(students);
const beforeById = new Map(before.map((s) => [s.studentId, s]));

const renames = values
  .filter((v) => {
    const prior = beforeById.get(v.studentId!);
    return prior && (prior.firstName !== v.firstName || prior.lastName !== v.lastName);
  })
  .map((v) => ({ ...v, prior: beforeById.get(v.studentId!)! }));

writeReport(renames, placeholders, values.length);

if (dryRun) {
  console.log(
    `Dry run. ${values.length} rows: ` +
      `${values.filter((v) => !beforeById.has(v.studentId!)).length} would be inserted, ` +
      `${renames.length} renamed. Nothing written.`
  );
  await client.end();
  process.exit(0);
}

const result = await db
  .insert(students)
  .values(values)
  .onConflictDoUpdate({
    target: students.studentId,
    set: {
      firstName: sql`excluded.first_name`,
      lastName: sql`excluded.last_name`,
      // Only overwrite contacts when the new scrape actually carries one.
      parentPhone: sql`coalesce(excluded.parent_phone, ${students.parentPhone})`,
      parentEmail: sql`coalesce(excluded.parent_email, ${students.parentEmail})`,
      updatedAt: sql`now()`,
    },
  })
  .returning({ createdAt: students.createdAt, updatedAt: students.updatedAt });

const inserted = result.filter(
  (r) => r.createdAt.getTime() === r.updatedAt.getTime()
).length;

console.log(
  `Done. ${inserted} inserted, ${result.length - inserted} updated ` +
    `(${result.length} total, ${placeholders.length} placeholder ids, ${renames.length} renamed).`
);
console.log(`Report: ${REPORT_PATH}`);

await client.end();

function writeReport(
  renames: { studentId?: string; firstName?: string; lastName?: string; prior: { firstName: string; lastName: string } }[],
  placeholders: { studentId: string; row: ResolvedRow }[],
  total: number
): void {
  const out: string[] = ["# 2026-2027 students load", "", `${total} workbook rows.`, ""];

  out.push(`## Placeholder student ids (${placeholders.length})`, "");
  out.push("These students have no esmlh record yet. Replace the id once the school issues one.", "");
  if (placeholders.length === 0) {
    out.push("None.", "");
  } else {
    out.push("| workbook row | placeholder id | last name | first name | identity |");
    out.push("| ---: | --- | --- | --- | --- |");
    for (const p of placeholders) {
      out.push(
        `| ${p.row.row} | ${p.studentId} | ${p.row.surname ?? "—"} | ` +
          `${p.row.name ?? "—"} | ${p.row.identity_source} |`
      );
    }
    out.push("");
  }

  out.push(`## Names changed to match the workbook (${renames.length})`, "");
  if (renames.length === 0) {
    out.push("None.", "");
  } else {
    out.push("| student id | was | now |");
    out.push("| --- | --- | --- |");
    for (const r of renames) {
      out.push(
        `| ${r.studentId} | ${r.prior.lastName} / ${r.prior.firstName} | ` +
          `${r.lastName} / ${r.firstName} |`
      );
    }
    out.push("");
  }

  const path = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, out.join("\n"), "utf-8");
}

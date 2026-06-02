/**
 * Dry-run the matching pipeline against a bank Excel file.
 *
 * Reads the bank file (default: features/imports/data/bank_transaction.xlsx),
 * pulls students/enrollments/fees/charges from the DB, builds a
 * MatchingContext, runs match() on each transaction, and writes a markdown
 * report to scripts/reports/matching_dry_run.md.
 *
 * No DB writes. No payments persisted.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/qa/dry_run_matching.ts [bank.xlsx]
 *
 * Required env var: DIRECT_URL
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as XLSX from "xlsx";

import {
  academicTerms,
  academicYears,
  charges,
  clubEnrollments,
  discounts,
  enrollments,
  feeStructures,
  grades,
  gradeLevels,
  payments,
  students,
} from "@/db/schema";

import { buildMatchingContext, match } from "@/features/imports/matching";
import type {
  BankTransactionInput,
  BuildIndexInput,
  ChargeWithBalance,
  MatchResult,
} from "@/features/imports/matching";

const DEFAULT_BANK_PATH = "features/imports/data/bank_transaction.xlsx";
const REPORT_PATH = "scripts/reports/matching_dry_run.md";
const CLUB_ALIASES_PATH = "features/imports/matching/club-aliases.json";

// --------------------------- CLI / env ---------------------------
const bankPathArg = process.argv[2] ?? DEFAULT_BANK_PATH;
const bankAbsPath = resolve(process.cwd(), bankPathArg);
if (!existsSync(bankAbsPath)) {
  console.error(`ERROR: bank file not found at ${bankAbsPath}.`);
  console.error(`Place the file at the default path or pass it as the first argument.`);
  process.exit(1);
}

const dbUrl = process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("ERROR: DIRECT_URL is not set.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client, {
  schema: {
    academicTerms,
    academicYears,
    charges,
    clubEnrollments,
    discounts,
    enrollments,
    feeStructures,
    grades,
    gradeLevels,
    payments,
    students,
  },
});

// --------------------------- bank file ---------------------------
function readBankFile(path: string): BankTransactionInput[] {
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  });
  if (rows.length === 0) return [];

  // Detect column names by inspecting the first row.
  const sampleKeys = Object.keys(rows[0]!);
  const find = (...candidates: RegExp[]): string | null => {
    for (const re of candidates) {
      const hit = sampleKeys.find((k) => re.test(k));
      if (hit) return hit;
    }
    return null;
  };

  const memoCol = find(
    /memo/i,
    /^утга$/i,
    /гүйлгээний\s*утга/i,
    /utga/i,
    /description/i,
    /narration/i,
  );
  const amountInCol = find(/орлого/i, /credit/i, /income/i, /^amount$/i, /amount.*in/i);
  const amountOutCol = find(/зарлага/i, /debit/i, /expense/i, /amount.*out/i);
  const senderAccCol = find(
    /харьцсан\s*данс/i,
    /sender.*account/i,
    /from.*account/i,
    /дансны\s*дугаар/i,
    /данс.*дугаар/i,
    /account.*no/i,
  );
  const senderNameCol = find(/sender.*name/i, /from.*name/i, /дансны\s*нэр/i, /данс.*нэр/i);
  const txIdCol = find(/transaction.*id/i, /журнал/i, /гүйлгээний\s*дугаар/i, /reference/i, /tx.*id/i);

  console.log(
    `Column map: memo=${memoCol} in=${amountInCol} out=${amountOutCol} senderAcc=${senderAccCol} senderName=${senderNameCol} txId=${txIdCol}`,
  );

  const result: BankTransactionInput[] = [];
  for (const row of rows) {
    const memo = strVal(memoCol ? row[memoCol] : null);
    const amtIn = numVal(amountInCol ? row[amountInCol] : null);
    const amtOut = numVal(amountOutCol ? row[amountOutCol] : null);
    const senderAccount = strVal(senderAccCol ? row[senderAccCol] : null);
    const senderName = strVal(senderNameCol ? row[senderNameCol] : null);
    const isOutgoing = amtOut !== null && amtOut > 0;
    const amount = BigInt(Math.round(amtIn ?? amtOut ?? 0));
    void txIdCol;
    result.push({
      memo: memo ?? "",
      amount,
      senderAccount,
      senderAccountName: senderName,
      isOutgoing,
    });
  }
  return result;
}

function strVal(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
function numVal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// --------------------------- DB context ---------------------------
async function loadCurrent() {
  const [year] = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  const [term] = await db
    .select()
    .from(academicTerms)
    .where(eq(academicTerms.isCurrent, true))
    .limit(1);
  if (!year) throw new Error("No current academic_year set");
  if (!term) throw new Error("No current academic_term set");
  return { year, term };
}

async function loadStudents() {
  return db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
    })
    .from(students);
}

async function loadEnrollments(yearId: number) {
  return db
    .select({
      studentId: enrollments.studentId,
      gradeName: grades.name,
      gradeLevelCode: gradeLevels.code,
    })
    .from(enrollments)
    .innerJoin(grades, eq(grades.id, enrollments.gradeId))
    .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
    .where(eq(enrollments.academicYearId, yearId));
}

type FeeRow = {
  id: number;
  feeName: string;
  data: unknown;
  academicTermId: number | null;
};

async function loadCurrentFees(termId: number) {
  const rows = await db
    .select({
      id: feeStructures.id,
      feeName: feeStructures.feeName,
      data: feeStructures.data,
      academicTermId: feeStructures.academicTermId,
    })
    .from(feeStructures)
    .where(isNull(feeStructures.supersededAt));

  const termRows: FeeRow[] = [];
  const yearRows: FeeRow[] = [];
  for (const r of rows) {
    if (r.academicTermId === termId) termRows.push(r);
    else if (r.academicTermId === null) yearRows.push(r);
  }
  return { termRows, yearRows };
}

function feeRowToTermInputs(
  r: FeeRow,
): Array<{ feeStructureId: number; feeName: string; amount: bigint; isClub: boolean }> {
  // Club fee: { amount, teacher, schedule }
  // Flat: { amount }
  // Per-grade: { by_grade: { "1": 2_000_000, ... } }
  const d = r.data as Record<string, unknown> | null;
  if (!d) return [];
  if (typeof d["amount"] === "number") {
    // Treat as either club (if feeName ≠ tuition/bus_fee/registration) or flat school-wide fee.
    const isClub = !["tuition", "bus_fee", "bus", "registration"].includes(r.feeName);
    return [
      {
        feeStructureId: r.id,
        feeName: r.feeName,
        amount: BigInt(Math.round(d["amount"] as number)),
        isClub,
      },
    ];
  }
  return [];
}

function feeRowToYearInputs(r: FeeRow): Array<{ feeName: string; amount: bigint }> {
  const d = r.data as Record<string, unknown> | null;
  if (!d) return [];
  if (typeof d["amount"] === "number") {
    return [{ feeName: r.feeName, amount: BigInt(Math.round(d["amount"] as number)) }];
  }
  if (d["by_grade"] && typeof d["by_grade"] === "object") {
    const out: Array<{ feeName: string; amount: bigint }> = [];
    for (const v of Object.values(d["by_grade"] as Record<string, unknown>)) {
      if (typeof v === "number") {
        out.push({ feeName: r.feeName, amount: BigInt(Math.round(v)) });
      }
    }
    return out;
  }
  return [];
}

async function loadOpenCharges(yearId: number, termId: number) {
  // All non-zero-balance charges in the current year + current term.
  const allCharges = await db
    .select({
      id: charges.id,
      studentId: charges.studentId,
      feeName: charges.feeName,
      amount: charges.amount,
      academicYearId: charges.academicYearId,
      academicTermId: charges.academicTermId,
    })
    .from(charges)
    .where(
      sql`${charges.academicYearId} = ${yearId} OR ${charges.academicTermId} = ${termId}`,
    );

  if (allCharges.length === 0) return [];

  const chargeIds = allCharges.map((c) => c.id);

  // Sum of payments per charge.
  const paymentSums = await db
    .select({
      chargeId: payments.chargeId,
      paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.as("paid"),
    })
    .from(payments)
    .where(inArray(payments.chargeId, chargeIds))
    .groupBy(payments.chargeId);
  const paidByCharge = new Map<number, number>();
  for (const p of paymentSums) paidByCharge.set(p.chargeId, Number(p.paid));

  // Tuition discounts per (student, year).
  const tuitionDiscounts = await db
    .select({
      studentId: enrollments.studentId,
      academicYearId: enrollments.academicYearId,
      total: sql<number>`COALESCE(SUM(${discounts.amount}), 0)`.as("total"),
    })
    .from(discounts)
    .innerJoin(enrollments, eq(enrollments.id, discounts.enrollmentId))
    .where(eq(enrollments.academicYearId, yearId))
    .groupBy(enrollments.studentId, enrollments.academicYearId);
  const discountByStudent = new Map<number, number>();
  for (const d of tuitionDiscounts) discountByStudent.set(d.studentId, Number(d.total));

  const out: Array<ChargeWithBalance & { studentId: number }> = [];
  for (const c of allCharges) {
    const paid = paidByCharge.get(c.id) ?? 0;
    const discount = c.feeName === "tuition" ? discountByStudent.get(c.studentId) ?? 0 : 0;
    const balance = Number(c.amount) - discount - paid;
    if (balance <= 0) continue;
    const scope =
      c.academicYearId !== null
        ? { kind: "year" as const, academicYearId: c.academicYearId }
        : { kind: "term" as const, academicTermId: c.academicTermId! };
    out.push({
      id: c.id,
      studentId: c.studentId,
      feeName: c.feeName,
      scope,
      grossAmount: BigInt(Number(c.amount)),
      outstandingBalance: BigInt(balance),
    });
  }
  return out;
}

// --------------------------- report ---------------------------
function fmtMNT(n: bigint): string {
  return n.toLocaleString("en-US") + " MNT";
}

function describeResult(
  tx: BankTransactionInput,
  result: MatchResult,
  index: number,
  studentNamesById: Map<number, string>,
  chargesById: Map<number, ChargeWithBalance & { studentId: number }>,
): string {
  const header = `### Row ${index + 1} — ${fmtMNT(tx.amount)}`;
  const memoLine = `- Memo: \`${tx.memo ?? ""}\``;
  const senderLine = `- Sender: ${tx.senderAccount ?? "(none)"} ${
    tx.senderAccountName ? `(${tx.senderAccountName})` : ""
  }`.trimEnd();

  const lines: string[] = [header, memoLine, senderLine];

  if (result.kind === "unmatched") {
    lines.push(`- Status: **unmatched** (${result.reason})`);
    return lines.join("\n");
  }

  if (result.kind === "matched_multi") {
    lines.push(`- Status: **matched_multi** (total ${fmtMNT(result.proposal.totalAmount)})`);
    for (const p of result.proposal.proposals) {
      const name = studentNamesById.get(p.studentId) ?? `student #${p.studentId}`;
      lines.push(`  - → ${name}`);
      for (const a of p.allocations) {
        const ch = chargesById.get(a.chargeId);
        lines.push(
          `    - alloc charge #${a.chargeId} "${ch?.feeName ?? "?"}" ${fmtMNT(a.amount)}`,
        );
      }
    }
    return lines.join("\n");
  }

  const label = result.kind === "matched" ? "matched" : "low_confidence";
  lines.push(`- Status: **${label}** (${result.proposals.length} proposal(s))`);
  for (const p of result.proposals) {
    const name = studentNamesById.get(p.studentId) ?? `student #${p.studentId}`;
    const sigs = [...p.signals].join(", ");
    const flags = [...p.flags].join(", ");
    lines.push(`  - → ${name} | signals: ${sigs || "(none)"}${flags ? ` | flags: ${flags}` : ""}`);
    for (const a of p.allocations) {
      const ch = chargesById.get(a.chargeId);
      lines.push(
        `    - alloc charge #${a.chargeId} "${ch?.feeName ?? "?"}" ${fmtMNT(a.amount)}`,
      );
    }
    if (p.allocations.length === 0) {
      lines.push(`    - (no allocation)`);
    }
  }
  return lines.join("\n");
}

// --------------------------- main ---------------------------
async function main(): Promise<void> {
  console.log(`Reading bank file: ${bankAbsPath}`);
  const txs = readBankFile(bankAbsPath);
  console.log(`Parsed ${txs.length} transaction rows.`);

  console.log(`Querying DB for current year/term...`);
  const { year, term } = await loadCurrent();
  console.log(`  year=${year.name} (id=${year.id}), term=${term.name} (id=${term.id})`);

  const [studentsRows, enrollmentsRows, currentFees, openCharges] = await Promise.all([
    loadStudents(),
    loadEnrollments(year.id),
    loadCurrentFees(term.id),
    loadOpenCharges(year.id, term.id),
  ]);

  console.log(
    `  students=${studentsRows.length} enrollments=${enrollmentsRows.length} open_charges=${openCharges.length}`,
  );

  const currentTermFees = currentFees.termRows.flatMap(feeRowToTermInputs);
  const currentYearFees = currentFees.yearRows.flatMap(feeRowToYearInputs);

  let clubAliases: Record<string, string[]> = {};
  try {
    const aliasJson = JSON.parse(
      readFileSync(resolve(process.cwd(), CLUB_ALIASES_PATH), "utf-8"),
    ) as { aliases?: Record<string, string[]> };
    clubAliases = aliasJson.aliases ?? {};
  } catch (e) {
    console.warn(`(could not load ${CLUB_ALIASES_PATH}: ${(e as Error).message})`);
  }

  const buildInput: BuildIndexInput = {
    students: studentsRows,
    enrollments: enrollmentsRows,
    currentTermFees,
    currentYearFees,
    clubAliases,
    confirmedAccountLinks: [],
    openCharges,
  };
  const context = buildMatchingContext(buildInput);

  const studentNamesById = new Map<number, string>();
  for (const s of studentsRows) {
    studentNamesById.set(s.id, `${s.firstName} ${s.lastName}`.trim());
  }
  const chargesById = new Map<number, ChargeWithBalance & { studentId: number }>();
  for (const c of openCharges) chargesById.set(c.id, c);

  console.log(`Matching ${txs.length} rows...`);
  const summary = { matched: 0, matched_multi: 0, low_confidence: 0, unmatched: 0 };
  const reasonCounts = new Map<string, number>();
  const reportSections: string[] = [];
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]!;
    const result = match(tx, context);
    switch (result.kind) {
      case "matched":
        summary.matched++;
        break;
      case "matched_multi":
        summary.matched_multi++;
        break;
      case "low_confidence":
        summary.low_confidence++;
        break;
      case "unmatched":
        summary.unmatched++;
        reasonCounts.set(result.reason, (reasonCounts.get(result.reason) ?? 0) + 1);
        break;
    }
    reportSections.push(describeResult(tx, result, i, studentNamesById, chargesById));
  }

  const reportHeader: string[] = [
    "# Bank Transaction Matching — Dry Run",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Source: \`${bankPathArg}\``,
    `- Academic year: ${year.name} (id=${year.id}), term: ${term.name} (id=${term.id})`,
    `- Students=${studentsRows.length}, enrollments=${enrollmentsRows.length}, open charges=${openCharges.length}`,
    `- Rows: ${txs.length}`,
    "",
    "## Summary",
    "",
    `- matched: ${summary.matched}`,
    `- matched_multi: ${summary.matched_multi}`,
    `- low_confidence: ${summary.low_confidence}`,
    `- unmatched: ${summary.unmatched}`,
  ];
  if (reasonCounts.size > 0) {
    reportHeader.push("");
    reportHeader.push("Unmatched reasons:");
    for (const [r, n] of reasonCounts) reportHeader.push(`- ${r}: ${n}`);
  }
  reportHeader.push("", "## Rows", "");

  const reportText = [...reportHeader, reportSections.join("\n\n")].join("\n");
  const reportAbs = resolve(process.cwd(), REPORT_PATH);
  writeFileSync(reportAbs, reportText, "utf-8");
  console.log(`Report written to ${reportAbs}`);
  console.log(JSON.stringify(summary, null, 2));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

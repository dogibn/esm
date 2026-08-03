import { readFileSync } from "node:fs";

import { eq, isNull } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicTerms,
  academicYears,
  bankTransactions,
  charges,
  enrollments,
  feeStructures,
  gradeLevels,
  grades,
  payments,
  students,
} from "@/db/schema";
import { loadChargeBalances } from "@/features/students/balance";

import type { BuildIndexInput } from "./types";

/**
 * Single source of truth for "what context matching runs against."
 *
 * Both the QA dry-run script (scripts/qa/dry_run_matching.ts) and the
 * read-only proposals route (app/api/imports/proposals/route.ts) call
 * `loadMatchingContextInput()` so they observe the same students, fees,
 * and open charges. This module loads; it does not match and does not
 * format reports.
 *
 * Open-charge computation goes through `loadChargeBalances` in
 * features/students/balance.ts (the schema.md "single source of truth"
 * for the balance formula) — never inline the balance formula again.
 */

const CLUB_ALIASES_URL = new URL("./club-aliases.json", import.meta.url);

export type MatchingPeriod = {
  yearId: number;
  yearName: string;
  termId: number;
  termName: string;
};

type FeeRow = {
  id: number;
  feeName: string;
  data: unknown;
  academicTermId: number | null;
};

function feeRowToTermInputs(
  r: FeeRow,
): Array<{ feeStructureId: number; feeName: string; amount: bigint; isClub: boolean }> {
  // Club fee: { amount, teacher, schedule }
  // Flat: { amount }
  // Per-grade: { by_grade: { "1": 2_000_000, ... } }
  const d = r.data as Record<string, unknown> | null;
  if (!d) return [];
  if (typeof d["amount"] === "number") {
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

export async function loadCurrentPeriod(): Promise<MatchingPeriod> {
  const [year] = await db
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) {
    throw new Error("No current academic_year set");
  }

  const [term] = await db
    .select({ id: academicTerms.id, name: academicTerms.name })
    .from(academicTerms)
    .where(eq(academicTerms.isCurrent, true))
    .limit(1);
  if (!term) {
    throw new Error("No current academic_term set");
  }

  return {
    yearId: year.id,
    yearName: year.name,
    termId: term.id,
    termName: term.name,
  };
}

async function loadStudentsForMatching() {
  return db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
    })
    .from(students);
}

async function loadEnrollmentsForMatching(yearId: number) {
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

async function loadCurrentFeesForMatching(termId: number) {
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

/**
 * Sender account → student, learned from what has already been confirmed.
 *
 * Every matched transaction is a statement that this account pays for this
 * student, and parents pay from the same account term after term — so the
 * strongest signal available (an account link is an identification, not an
 * inference) costs one query to reconstruct. Voided payments are excluded: an
 * undone match is not evidence of anything.
 *
 * One account maps to several students when siblings share a payer; the index
 * is many-to-many by design and the charge stage separates them.
 */
async function loadConfirmedAccountLinks(): Promise<
  Array<{ senderAccount: string; studentId: number }>
> {
  const rows = await db
    .selectDistinct({
      senderAccount: bankTransactions.senderAccount,
      studentId: charges.studentId,
    })
    .from(payments)
    .innerJoin(charges, eq(charges.id, payments.chargeId))
    .innerJoin(
      bankTransactions,
      eq(bankTransactions.id, payments.bankTransactionId),
    )
    .where(isNull(payments.voidedAt));

  const links: Array<{ senderAccount: string; studentId: number }> = [];
  for (const r of rows) {
    const account = r.senderAccount?.trim();
    if (account) links.push({ senderAccount: account, studentId: r.studentId });
  }
  return links;
}

function loadClubAliases(): Record<string, string[]> {
  try {
    const raw = readFileSync(CLUB_ALIASES_URL, "utf-8");
    const json = JSON.parse(raw) as { aliases?: Record<string, string[]> };
    return json.aliases ?? {};
  } catch {
    // Matching still works without aliases; treat as empty.
    return {};
  }
}

export type LoadMatchingContextInputResult = {
  period: MatchingPeriod;
  input: BuildIndexInput;
};

/**
 * Build the `BuildIndexInput` the matching pipeline consumes. Runs the
 * supporting queries in parallel; no N+1.
 *
 * Reads from `bank_transactions` are NOT included here — those are the
 * caller's concern (the dry-run script reads from a file; the proposals
 * route reads unmatched rows from the DB).
 */
export async function loadMatchingContextInput(): Promise<LoadMatchingContextInputResult> {
  const period = await loadCurrentPeriod();

  const [studentsRows, enrollmentsRows, currentFees, openCharges, accountLinks] =
    await Promise.all([
      loadStudentsForMatching(),
      loadEnrollmentsForMatching(period.yearId),
      loadCurrentFeesForMatching(period.termId),
      loadChargeBalances({
        academicYearId: period.yearId,
        academicTermId: period.termId,
        openOnly: true,
      }),
      loadConfirmedAccountLinks(),
    ]);

  const currentTermFees = currentFees.termRows.flatMap(feeRowToTermInputs);
  const currentYearFees = currentFees.yearRows.flatMap(feeRowToYearInputs);

  const input: BuildIndexInput = {
    academicTermId: period.termId,
    students: studentsRows,
    enrollments: enrollmentsRows,
    currentTermFees,
    currentYearFees,
    clubAliases: loadClubAliases(),
    confirmedAccountLinks: accountLinks,
    openCharges,
  };

  return { period, input };
}

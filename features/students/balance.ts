import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { bankTransactions, charges, discounts, enrollments, payments } from "@/db/schema";

import type { FeeScopeValue } from "./schemas";
import type { FeeStatus } from "./types";

export type ChargeScope =
  | { kind: "year"; academicYearId: number }
  | { kind: "term"; academicTermId: number };

export type ChargeWithBalance = {
  id: number;
  feeName: string;
  scope: ChargeScope;
  grossAmount: bigint;
  outstandingBalance: bigint;
};

export type ChargeWithBalanceForStudent = ChargeWithBalance & { studentId: number };

export type StudentChargeDetail = ChargeWithBalanceForStudent & {
  paidTotal: number;
  discountTotal: number;
};

// Pure formula. Discounts only subtract for tuition (schema.md invariant).
// Returns a signed number — overpayments produce a negative balance rather than
// being silently clamped to zero, so callers can decide policy.
export function computeChargeBalance(input: {
  feeName: string;
  amount: number;
  studentDiscountTotal: number;
  paidTotal: number;
}): number {
  const discount = input.feeName === "tuition" ? input.studentDiscountTotal : 0;
  return input.amount - discount - input.paidTotal;
}

// Fee names that are school-wide. Anything else on a charge is a club — clubs
// are stored under their own display name ("Chess Club", "Cheerleading GR3"),
// so they are recognised by exclusion, not by a list.
const FEE_NAMES_BY_SCOPE: Record<
  Exclude<FeeScopeValue, "all" | "clubs">,
  readonly string[]
> = {
  tuition: ["tuition"],
  // Both spellings exist in imported data.
  bus: ["bus_fee", "bus"],
  registration: ["registration"],
};

const SCHOOL_WIDE_FEE_NAMES = new Set(
  Object.values(FEE_NAMES_BY_SCOPE).flat(),
);

/** Which fee tab a charge belongs to. Every charge maps to exactly one. */
export function classifyFeeScope(feeName: string): Exclude<FeeScopeValue, "all"> {
  for (const [scope, names] of Object.entries(FEE_NAMES_BY_SCOPE)) {
    if (names.includes(feeName)) {
      return scope as Exclude<FeeScopeValue, "all" | "clubs">;
    }
  }
  return "clubs";
}

/** True when the charge belongs in the selected fee scope. */
export function chargeMatchesScope(feeName: string, scope: FeeScopeValue): boolean {
  if (scope === "all") return true;
  if (scope === "clubs") return !SCHOOL_WIDE_FEE_NAMES.has(feeName);
  return classifyFeeScope(feeName) === scope;
}

export type ChargeTotals = {
  /** Gross charged minus applicable discounts — what the student owes. */
  due: number;
  paid: number;
  /** `due − paid`. Signed: an overpayment is negative. */
  balance: number;
};

/**
 * Sum a student's charges into one row's worth of money. Clubs are the case
 * that needs it — a student can hold several club charges in a term and the
 * tracker still shows one row per student.
 */
export function foldChargeTotals(rows: StudentChargeDetail[]): ChargeTotals {
  let due = 0;
  let paid = 0;
  let balance = 0;
  for (const r of rows) {
    due += Number(r.grossAmount) - r.discountTotal;
    paid += r.paidTotal;
    balance += Number(r.outstandingBalance);
  }
  return { due, paid, balance };
}

/**
 * The derived payment status — never stored (domain_model.md § Charge). The one
 * mapping, shared by the tracking table and the student detail page.
 */
export function deriveFeeStatus(totals: {
  balance: number;
  paid: number;
}): Exclude<FeeStatus, "none"> {
  if (totals.balance <= 0) return "paid";
  if (totals.paid > 0) return "partial";
  return "unpaid";
}

/**
 * Load every charge in the given year/term scope with its outstanding balance
 * AND the breakdown (paid total, applied discount) that produced the balance.
 * Single source of truth for the schema.md balance formula.
 */
export async function loadStudentChargeDetails(opts: {
  academicYearId: number;
  academicTermId: number;
}): Promise<StudentChargeDetail[]> {
  const { academicYearId, academicTermId } = opts;

  // Lazy: db/index validates env at module load. Keep this module's type-only
  // consumers (pure-formula tests) free of env requirements.
  const { db } = await import("@/db/index");

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
      sql`${charges.academicYearId} = ${academicYearId} OR ${charges.academicTermId} = ${academicTermId}`,
    );

  if (allCharges.length === 0) return [];

  const chargeIds = allCharges.map((c) => c.id);

  const paymentSums = await db
    .select({
      chargeId: payments.chargeId,
      paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.as("paid"),
    })
    .from(payments)
    // Voided payments (undone confirms) never count toward paid/balance.
    .where(and(inArray(payments.chargeId, chargeIds), isNull(payments.voidedAt)))
    .groupBy(payments.chargeId);
  const paidByCharge = new Map<number, number>();
  for (const p of paymentSums) paidByCharge.set(p.chargeId, Number(p.paid));

  const tuitionDiscounts = await db
    .select({
      studentId: enrollments.studentId,
      total: sql<number>`COALESCE(SUM(${discounts.amount}), 0)`.as("total"),
    })
    .from(discounts)
    .innerJoin(enrollments, eq(enrollments.id, discounts.enrollmentId))
    .where(eq(enrollments.academicYearId, academicYearId))
    .groupBy(enrollments.studentId, enrollments.academicYearId);
  const discountByStudent = new Map<number, number>();
  for (const d of tuitionDiscounts) discountByStudent.set(d.studentId, Number(d.total));

  const out: StudentChargeDetail[] = [];
  for (const c of allCharges) {
    const paidTotal = paidByCharge.get(c.id) ?? 0;
    const studentDiscountTotal = discountByStudent.get(c.studentId) ?? 0;
    const balance = computeChargeBalance({
      feeName: c.feeName,
      amount: c.amount,
      studentDiscountTotal,
      paidTotal,
    });
    // Discount is only APPLIED to tuition charges, even if the student has a
    // discount record. Non-tuition rows expose discountTotal=0 so a fold across
    // several charges never double-counts the discount.
    const discountTotal = c.feeName === "tuition" ? studentDiscountTotal : 0;

    const scope: ChargeScope =
      c.academicYearId !== null
        ? { kind: "year", academicYearId: c.academicYearId }
        : { kind: "term", academicTermId: c.academicTermId! };

    out.push({
      id: c.id,
      studentId: c.studentId,
      feeName: c.feeName,
      scope,
      grossAmount: BigInt(c.amount),
      outstandingBalance: BigInt(balance),
      paidTotal,
      discountTotal,
    });
  }
  return out;
}

/**
 * Most recent payment date per charge, as ISO strings.
 *
 * Dated by `bank_transactions.transaction_at` — when the money moved — not by
 * `payments.recorded_at`, which is when an accountant keyed it in. Voided
 * payments are excluded, same as everywhere else.
 *
 * One grouped query for the whole page; charges with no live payment are
 * simply absent from the map.
 */
export async function loadLastPaymentDates(
  chargeIds: number[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (chargeIds.length === 0) return out;

  const { db } = await import("@/db/index");

  const rows = await db
    .select({
      chargeId: payments.chargeId,
      lastPaidAt: sql<Date>`MAX(${bankTransactions.transactionAt})`.as("last_paid_at"),
    })
    .from(payments)
    .innerJoin(bankTransactions, eq(bankTransactions.id, payments.bankTransactionId))
    .where(and(inArray(payments.chargeId, chargeIds), isNull(payments.voidedAt)))
    .groupBy(payments.chargeId);

  for (const r of rows) {
    if (r.lastPaidAt === null) continue;
    out.set(r.chargeId, new Date(r.lastPaidAt).toISOString());
  }
  return out;
}

/**
 * Slim matching-pipeline view: drops paidTotal/discountTotal so the matching
 * code stays narrow. `openOnly` filters to outstandingBalance > 0.
 */
export async function loadChargeBalances(opts: {
  academicYearId: number;
  academicTermId: number;
  openOnly?: boolean;
}): Promise<ChargeWithBalanceForStudent[]> {
  const details = await loadStudentChargeDetails({
    academicYearId: opts.academicYearId,
    academicTermId: opts.academicTermId,
  });
  const zero = BigInt(0);
  const filtered =
    opts.openOnly === true
      ? details.filter((d) => d.outstandingBalance > zero)
      : details;
  return filtered.map(({ paidTotal: _p, discountTotal: _d, ...slim }) => slim);
}

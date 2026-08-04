import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { charges, discounts, enrollments, payments } from "@/db/schema";

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
    // discount record. Non-tuition rows expose discountTotal=0 so the FeeCell
    // never double-counts the discount across multiple fees.
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

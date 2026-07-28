import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicTerms,
  academicYears,
  bankTransactions,
  charges,
  discounts,
  enrollments,
  gradeLevels,
  grades,
  payments,
  students,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";

import { computeChargeBalance } from "./balance";
import type { FeeStatus } from "./types";

// ─── DTO shapes (all fields serializable so the server component can hand the
// whole thing to a client view) ───────────────────────────────────────────────

export type StudentDetailHeader = {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  parentEmail: string | null;
  parentPhone: string | null;
  gradeName: string;
  gradeLevelCode: string;
  teacherName: string;
  teacherEmail: string | null;
  teacherPhone: string | null;
  studentCategory: string;
  tuitionContractId: string | null;
  academicYearName: string;
};

export type DiscountLine = { name: string; amount: number };

export type TuitionBreakdown = {
  gross: number;
  discounts: DiscountLine[];
  discountTotal: number;
  net: number;
  paid: number;
  balance: number;
  status: FeeStatus;
};

export type FeeLine = {
  chargeId: number;
  feeName: string;
  charged: number;
  discount: number;
  net: number;
  paid: number;
  balance: number;
  status: FeeStatus;
  notes: string | null;
};

export type TermColumn = { id: number; name: string; isCurrent: boolean };

export type TermCell =
  | { hasCharge: false }
  | {
      hasCharge: true;
      chargeId: number;
      charged: number;
      paid: number;
      balance: number;
      status: FeeStatus;
      notes: string | null;
    };

export type TermFeeRow = {
  feeName: string;
  cells: TermCell[]; // aligned to StudentDetail.terms
  charged: number;
  paid: number;
  balance: number;
};

export type PaymentHistoryRow = {
  paymentId: number;
  transactionAt: string; // ISO
  feeName: string;
  amount: number;
  senderName: string | null;
  reference: string;
  memo: string | null;
};

export type StudentDetail = {
  header: StudentDetailHeader;
  tuition: TuitionBreakdown | null;
  annualFees: FeeLine[];
  terms: TermColumn[];
  termFees: TermFeeRow[];
  payments: PaymentHistoryRow[];
  totals: { charged: number; paid: number; balance: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveFeeStatus(balance: number, paid: number): FeeStatus {
  if (balance <= 0) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

// Stable ordering so the ledger reads the same for every student. Known fees
// first; anything else (club names) sorts alphabetically after.
const FEE_ORDER: Record<string, number> = {
  tuition: 0,
  registration: 1,
  bus_fee: 2,
  bus: 2,
};

function byFeeOrder(a: string, b: string): number {
  const oa = FEE_ORDER[a] ?? 100;
  const ob = FEE_ORDER[b] ?? 100;
  return oa === ob ? a.localeCompare(b) : oa - ob;
}

/**
 * Everything the per-student detail page needs, resolved for the current
 * academic year. Charges span every term of the year (not just the current
 * term) so the term matrix can show history. Read-only: no mutation surface.
 */
export async function getStudentDetail(studentDbId: number): Promise<StudentDetail> {
  const [year] = await db
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) throw new HttpError(500, "No current academic year is set");

  const termRows = await db
    .select({
      id: academicTerms.id,
      name: academicTerms.name,
      isCurrent: academicTerms.isCurrent,
    })
    .from(academicTerms)
    .where(eq(academicTerms.academicYearId, year.id))
    .orderBy(asc(academicTerms.startDate));

  const [base] = await db
    .select({
      enrollmentId: enrollments.id,
      studentDbId: students.id,
      studentCode: students.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
      studentCategory: enrollments.studentCategory,
      tuitionContractId: enrollments.tuitionContractId,
      gradeName: grades.name,
      gradeLevelCode: gradeLevels.code,
      teacherName: grades.teacherName,
      teacherEmail: grades.teacherEmail,
      teacherPhone: grades.teacherPhone,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(grades, eq(grades.id, enrollments.gradeId))
    .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
    .where(
      and(
        eq(enrollments.studentId, studentDbId),
        eq(enrollments.academicYearId, year.id),
      ),
    )
    .limit(1);
  if (!base) throw new HttpError(404, "Student not found for the current year");

  const discountRows = await db
    .select({ name: discounts.name, amount: discounts.amount })
    .from(discounts)
    .where(eq(discounts.enrollmentId, base.enrollmentId));
  const discountTotal = discountRows.reduce((s, d) => s + Number(d.amount), 0);

  const termIds = termRows.map((t) => t.id);
  const scopeClause =
    termIds.length > 0
      ? or(
          eq(charges.academicYearId, year.id),
          inArray(charges.academicTermId, termIds),
        )
      : eq(charges.academicYearId, year.id);
  const chargeRows = await db
    .select({
      id: charges.id,
      feeName: charges.feeName,
      amount: charges.amount,
      academicYearId: charges.academicYearId,
      academicTermId: charges.academicTermId,
      notes: charges.notes,
    })
    .from(charges)
    .where(and(eq(charges.studentId, studentDbId), scopeClause));

  const chargeIds = chargeRows.map((c) => c.id);

  const paidByCharge = new Map<number, number>();
  if (chargeIds.length > 0) {
    const paymentSums = await db
      .select({
        chargeId: payments.chargeId,
        paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.as("paid"),
      })
      .from(payments)
      .where(inArray(payments.chargeId, chargeIds))
      .groupBy(payments.chargeId);
    for (const p of paymentSums) paidByCharge.set(p.chargeId, Number(p.paid));
  }

  // Enrich each charge with the schema.md balance formula.
  const enriched = chargeRows.map((c) => {
    const amount = Number(c.amount);
    const paid = paidByCharge.get(c.id) ?? 0;
    const balance = computeChargeBalance({
      feeName: c.feeName,
      amount,
      studentDiscountTotal: discountTotal,
      paidTotal: paid,
    });
    const appliedDiscount = c.feeName === "tuition" ? discountTotal : 0;
    return {
      id: c.id,
      feeName: c.feeName,
      notes: c.notes,
      academicTermId: c.academicTermId,
      isYear: c.academicYearId !== null,
      amount,
      paid,
      balance,
      appliedDiscount,
    };
  });

  // Annual (year-scoped) fee lines: tuition, registration, …
  const annualFees: FeeLine[] = enriched
    .filter((e) => e.isYear)
    .map((e) => ({
      chargeId: e.id,
      feeName: e.feeName,
      charged: e.amount,
      discount: e.appliedDiscount,
      net: e.amount - e.appliedDiscount,
      paid: e.paid,
      balance: e.balance,
      status: deriveFeeStatus(e.balance, e.paid),
      notes: e.notes,
    }))
    .sort((a, b) => byFeeOrder(a.feeName, b.feeName));

  const tuitionCharge = enriched.find((e) => e.feeName === "tuition");
  const tuition: TuitionBreakdown | null = tuitionCharge
    ? {
        gross: tuitionCharge.amount,
        discounts: discountRows.map((d) => ({
          name: d.name,
          amount: Number(d.amount),
        })),
        discountTotal,
        net: tuitionCharge.amount - discountTotal,
        paid: tuitionCharge.paid,
        balance: tuitionCharge.balance,
        status: deriveFeeStatus(tuitionCharge.balance, tuitionCharge.paid),
      }
    : null;

  // Term matrix: one row per term-scoped fee, one cell per term of the year.
  const termCharges = enriched.filter((e) => !e.isYear);
  const byFee = new Map<string, typeof termCharges>();
  for (const c of termCharges) {
    const arr = byFee.get(c.feeName);
    if (arr) arr.push(c);
    else byFee.set(c.feeName, [c]);
  }
  const termFees: TermFeeRow[] = [...byFee.entries()]
    .sort((a, b) => byFeeOrder(a[0], b[0]))
    .map(([feeName, list]) => {
      const cells: TermCell[] = termRows.map((t) => {
        const ch = list.find((c) => c.academicTermId === t.id);
        if (!ch) return { hasCharge: false };
        return {
          hasCharge: true,
          chargeId: ch.id,
          charged: ch.amount,
          paid: ch.paid,
          balance: ch.balance,
          status: deriveFeeStatus(ch.balance, ch.paid),
          notes: ch.notes,
        };
      });
      return {
        feeName,
        cells,
        charged: list.reduce((s, c) => s + c.amount, 0),
        paid: list.reduce((s, c) => s + c.paid, 0),
        balance: list.reduce((s, c) => s + c.balance, 0),
      };
    });

  let paymentHistory: PaymentHistoryRow[] = [];
  if (chargeIds.length > 0) {
    const rows = await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        feeName: charges.feeName,
        transactionAt: bankTransactions.transactionAt,
        senderName: bankTransactions.senderName,
        reference: bankTransactions.transactionId,
        memo: bankTransactions.memo,
      })
      .from(payments)
      .innerJoin(charges, eq(charges.id, payments.chargeId))
      .innerJoin(
        bankTransactions,
        eq(bankTransactions.id, payments.bankTransactionId),
      )
      .where(inArray(payments.chargeId, chargeIds))
      .orderBy(desc(bankTransactions.transactionAt));
    paymentHistory = rows.map((r) => ({
      paymentId: r.paymentId,
      transactionAt: r.transactionAt.toISOString(),
      feeName: r.feeName,
      amount: Number(r.amount),
      senderName: r.senderName,
      reference: r.reference,
      memo: r.memo,
    }));
  }

  // Totals use net charged (post-discount) so charged − paid == balance.
  const totals = enriched.reduce(
    (acc, e) => {
      acc.charged += e.amount - e.appliedDiscount;
      acc.paid += e.paid;
      acc.balance += e.balance;
      return acc;
    },
    { charged: 0, paid: 0, balance: 0 },
  );

  return {
    header: {
      id: base.studentDbId,
      code: base.studentCode,
      firstName: base.firstName,
      lastName: base.lastName,
      parentEmail: base.parentEmail,
      parentPhone: base.parentPhone,
      gradeName: base.gradeName,
      gradeLevelCode: base.gradeLevelCode,
      teacherName: base.teacherName,
      teacherEmail: base.teacherEmail,
      teacherPhone: base.teacherPhone,
      studentCategory: base.studentCategory,
      tuitionContractId: base.tuitionContractId,
      academicYearName: year.name,
    },
    tuition,
    annualFees,
    terms: termRows.map((t) => ({
      id: t.id,
      name: t.name,
      isCurrent: t.isCurrent,
    })),
    termFees,
    payments: paymentHistory,
    totals,
  };
}

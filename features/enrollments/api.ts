import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicYears,
  charges,
  discounts,
  enrollments,
  feeStructures,
  gradeLevels,
  grades,
  payments,
  students,
  type Operation,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";
import { recordOperation, undoableUntil } from "@/features/history";

import { parseCreateEnrollmentDetails } from "./undo-details";

import type { CreateEnrollmentInput } from "./schemas";
import { strings } from "./strings";
import type {
  ClassOption,
  CreateEnrollmentResult,
  EnrollmentFormContext,
  ExistingStudentOption,
} from "./types";

// Optional text fields arrive as possibly-empty strings from the form.
function nullify(v: string | undefined | null): string | null {
  const t = v?.trim();
  return t ? t : null;
}

async function currentYear(): Promise<{ id: number; name: string }> {
  const [year] = await db
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) throw new HttpError(500, strings.errors.noCurrentYear);
  return year;
}

// The active tuition fee_structure stores its per-level amounts either as a
// flat `{ code: amount }` map (what the load scripts wrote) or nested under
// `by_grade` (the domain_model.md catalog shape). Accept both.
function resolveTuitionMap(data: unknown): Record<string, number> {
  if (!data || typeof data !== "object") return {};
  const obj = data as Record<string, unknown>;
  const src =
    obj.by_grade && typeof obj.by_grade === "object"
      ? (obj.by_grade as Record<string, unknown>)
      : obj;
  const out: Record<string, number> = {};
  for (const [code, value] of Object.entries(src)) {
    if (typeof value === "number" && Number.isFinite(value)) out[code] = value;
  }
  return out;
}

function resolveFlatAmount(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const amount = (data as { amount?: unknown }).amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

async function activeFeeData(feeName: string): Promise<unknown | null> {
  const rows = await db
    .select({ data: feeStructures.data })
    .from(feeStructures)
    .where(
      and(
        eq(feeStructures.feeName, feeName),
        isNull(feeStructures.academicTermId),
        isNull(feeStructures.supersededAt),
      ),
    )
    .limit(1);
  return rows[0]?.data ?? null;
}

/**
 * Everything the New Contract form needs, resolved for the current year:
 * class options (with their grade level), the base-tuition map, the
 * registration fee, and existing students for the returning-student picker.
 */
export async function getEnrollmentFormContext(): Promise<EnrollmentFormContext> {
  const year = await currentYear();

  const [classRows, tuitionData, registrationData, studentRows, enrolledRows] =
    await Promise.all([
      db
        .select({
          gradeId: grades.id,
          name: grades.name,
          gradeLevelId: grades.gradeLevelId,
          gradeLevelCode: gradeLevels.code,
          teacherName: grades.teacherName,
        })
        .from(grades)
        .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
        .where(eq(grades.academicYearId, year.id))
        .orderBy(asc(gradeLevels.sortOrder), asc(grades.name)),
      activeFeeData("tuition"),
      activeFeeData("registration"),
      db
        .select({
          id: students.id,
          studentId: students.studentId,
          firstName: students.firstName,
          lastName: students.lastName,
          parentEmail: students.parentEmail,
          parentPhone: students.parentPhone,
        })
        .from(students)
        .orderBy(asc(students.lastName), asc(students.firstName)),
      db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(eq(enrollments.academicYearId, year.id)),
    ]);

  const enrolledSet = new Set(enrolledRows.map((r) => r.studentId));

  const classes: ClassOption[] = classRows;
  const studentOptions: ExistingStudentOption[] = studentRows.map((s) => ({
    ...s,
    enrolledThisYear: enrolledSet.has(s.id),
  }));

  return {
    academicYear: year,
    classes,
    tuitionByGradeLevel: resolveTuitionMap(tuitionData),
    registrationFee: resolveFlatAmount(registrationData),
    students: studentOptions,
  };
}

/**
 * Creates (or reuses) a Student, enrols them for the current year, and records
 * the tuition contract: a year-scoped tuition Charge, an optional registration
 * Charge (new students), and any tuition Discounts. All in one transaction so a
 * partial failure leaves nothing behind.
 *
 * Mirrors the year-start import's per-student output (domain_model.md
 * § Year-start data import), which the docs otherwise expect a script to do.
 */
export async function createEnrollment(
  user: User,
  input: CreateEnrollmentInput,
): Promise<CreateEnrollmentResult> {
  const year = await currentYear();

  return db.transaction(async (tx) => {
    // 1. The class must belong to the current year (enrollment invariant).
    const [grade] = await tx
      .select({
        id: grades.id,
        academicYearId: grades.academicYearId,
        name: grades.name,
      })
      .from(grades)
      .where(eq(grades.id, input.gradeId))
      .limit(1);
    if (!grade || grade.academicYearId !== year.id) {
      throw new HttpError(400, strings.errors.classNotInYear);
    }

    // 2. Resolve the Student row — insert a new one or update the reused one.
    // `studentCreated` is recorded on the operation so undo only removes a
    // student this contract brought into existence, never a reused one.
    let studentDbId: number;
    let studentCreated = false;
    if (input.mode === "existing") {
      if (input.existingStudentId === undefined) {
        throw new HttpError(400, strings.errors.studentNotFound);
      }
      const [existing] = await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.id, input.existingStudentId))
        .limit(1);
      if (!existing) throw new HttpError(404, strings.errors.studentNotFound);
      studentDbId = existing.id;
      await tx
        .update(students)
        .set({
          firstName: input.firstName,
          lastName: input.lastName,
          parentEmail: nullify(input.parentEmail),
          parentPhone: nullify(input.parentPhone),
          updatedAt: new Date(),
        })
        .where(eq(students.id, studentDbId));
    } else {
      const [clash] = await tx
        .select({ id: students.id })
        .from(students)
        .where(eq(students.studentId, input.studentId))
        .limit(1);
      if (clash) {
        throw new HttpError(
          409,
          strings.errors.duplicateStudentId(input.studentId),
        );
      }
      const [inserted] = await tx
        .insert(students)
        .values({
          studentId: input.studentId,
          firstName: input.firstName,
          lastName: input.lastName,
          parentEmail: nullify(input.parentEmail),
          parentPhone: nullify(input.parentPhone),
        })
        .returning({ id: students.id });
      studentDbId = inserted!.id;
      studentCreated = true;
    }

    // 3. One enrollment per student per year (unique constraint).
    const [dupEnrollment] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentDbId),
          eq(enrollments.academicYearId, year.id),
        ),
      )
      .limit(1);
    if (dupEnrollment) {
      throw new HttpError(409, strings.errors.alreadyEnrolled);
    }

    const [enrollment] = await tx
      .insert(enrollments)
      .values({
        studentId: studentDbId,
        academicYearId: year.id,
        gradeId: input.gradeId,
        status: "active",
        studentCategory: input.studentCategory,
        tuitionContractId: nullify(input.tuitionContractId),
        studentCode: nullify(input.studentCode),
      })
      .returning({ id: enrollments.id });
    const enrollmentId = enrollment!.id;

    // 4. Tuition charge — year-scoped, gross amount stored at creation time.
    const [tuitionCharge] = await tx
      .insert(charges)
      .values({
        studentId: studentDbId,
        academicYearId: year.id,
        academicTermId: null,
        feeName: "tuition",
        amount: input.tuitionAmount,
      })
      .returning({ id: charges.id });
    const tuitionChargeId = tuitionCharge!.id;

    // 5. Registration charge — new students only, when a positive amount is set.
    let registrationChargeId: number | null = null;
    if (input.studentCategory === "new" && input.registrationAmount > 0) {
      const [registrationCharge] = await tx
        .insert(charges)
        .values({
          studentId: studentDbId,
          academicYearId: year.id,
          academicTermId: null,
          feeName: "registration",
          amount: input.registrationAmount,
        })
        .returning({ id: charges.id });
      registrationChargeId = registrationCharge!.id;
    }

    // 6. Tuition discounts, linked to the enrollment.
    if (input.discounts.length > 0) {
      await tx.insert(discounts).values(
        input.discounts.map((d) => ({
          enrollmentId,
          name: d.name,
          amount: d.amount,
          notes: nullify(d.notes),
          createdBy: user.id,
        })),
      );
    }

    // 7. Record the whole contract as one undoable operation. Undo reverses it
    // by the ids captured here (docs/history_and_reversibility.md Phase 4.2);
    // there is no bank transaction involved, so bankTransactionId stays null.
    const chargeIds = [tuitionChargeId];
    if (registrationChargeId !== null) chargeIds.push(registrationChargeId);
    const studentName = `${input.lastName} ${input.firstName}`.trim();
    await recordOperation(tx, {
      actorUserId: user.id,
      kind: "create_enrollment",
      undoableUntil: undoableUntil(new Date()),
      summary: `New contract · ${studentName} · ${grade.name}`,
      details: {
        studentId: studentDbId,
        studentCreated,
        enrollmentId,
        chargeIds,
        discountCount: input.discounts.length,
      },
    });

    return {
      studentDbId,
      enrollmentId,
      tuitionChargeId,
      registrationChargeId,
      discountCount: input.discounts.length,
    };
  });
}

/**
 * Reverse a create_enrollment operation. Runs inside the caller's undo
 * transaction. Because the contract is brand-new, this DELETES the rows the
 * operation created (mirroring how a confirm undo deletes charges it created) —
 * the operations log retains the audit trail. Guarded: if any created charge
 * has since taken a live payment, the contract is no longer purely new and undo
 * is refused with 409. A reused student is never deleted; a student this
 * contract created is deleted only once nothing else references it.
 */
export async function undoCreateEnrollment(
  tx: Parameters<Parameters<(typeof db)["transaction"]>[0]>[0],
  op: Operation,
): Promise<void> {
  const details = parseCreateEnrollmentDetails(op.details);
  if (!details) {
    throw new HttpError(500, "Enrollment operation is missing its details");
  }

  // Guard: a live payment on any created charge means real money attached to
  // this contract; undoing it would strand that payment. Refuse.
  if (details.chargeIds.length > 0) {
    const paid = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          inArray(payments.chargeId, details.chargeIds),
          isNull(payments.voidedAt),
        ),
      )
      .limit(1);
    if (paid.length > 0) {
      throw new HttpError(
        409,
        "This contract already has a payment and can no longer be undone",
      );
    }
  }

  // Delete children before parents to satisfy FKs: discounts → charges →
  // enrollment → (optionally) the newly-created student.
  await tx.delete(discounts).where(eq(discounts.enrollmentId, details.enrollmentId));
  if (details.chargeIds.length > 0) {
    await tx.delete(charges).where(inArray(charges.id, details.chargeIds));
  }
  await tx.delete(enrollments).where(eq(enrollments.id, details.enrollmentId));

  if (details.studentCreated) {
    // Only remove the student if this undo leaves them with nothing — no other
    // enrollment and no remaining charge. Anything else means they were used
    // beyond this contract; keep the row.
    const [otherEnrollment] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.studentId, details.studentId))
      .limit(1);
    const [otherCharge] = await tx
      .select({ id: charges.id })
      .from(charges)
      .where(eq(charges.studentId, details.studentId))
      .limit(1);
    if (!otherEnrollment && !otherCharge) {
      await tx.delete(students).where(eq(students.id, details.studentId));
    }
  }
}

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicYears,
  charges,
  discounts,
  enrollments,
  feeStructures,
  gradeLevels,
  grades,
  students,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";

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
      .select({ id: grades.id, academicYearId: grades.academicYearId })
      .from(grades)
      .where(eq(grades.id, input.gradeId))
      .limit(1);
    if (!grade || grade.academicYearId !== year.id) {
      throw new HttpError(400, strings.errors.classNotInYear);
    }

    // 2. Resolve the Student row — insert a new one or update the reused one.
    let studentDbId: number;
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

    return {
      studentDbId,
      enrollmentId,
      tuitionChargeId,
      registrationChargeId,
      discountCount: input.discounts.length,
    };
  });
}

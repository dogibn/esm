// Options and prefill data the New Contract form needs, resolved once on the
// server and handed to the client component.

import type { DiscountTypeRow } from "@/features/discounts";

export type ClassOption = {
  gradeId: number;
  name: string;
  gradeLevelId: number;
  gradeLevelCode: string;
  teacherName: string;
};

export type ExistingStudentOption = {
  id: number; // students.id (DB)
  studentId: string; // school-assigned id
  firstName: string;
  lastName: string;
  parentEmail: string | null;
  parentPhone: string | null;
  // True when this student already has an enrollment in the current year —
  // the unique (student_id, academic_year_id) constraint would reject a second.
  enrolledThisYear: boolean;
};

export type EnrollmentFormContext = {
  academicYear: { id: number; name: string };
  classes: ClassOption[];
  // grade_level code → base tuition (MNT) from the active fee structure.
  tuitionByGradeLevel: Record<string, number>;
  // Flat registration fee (MNT) from the active fee structure, if any.
  registrationFee: number | null;
  students: ExistingStudentOption[];
  // Active catalog entries an accountant can apply as discounts.
  discountTypes: DiscountTypeRow[];
};

export type CreateEnrollmentResult = {
  studentDbId: number;
  enrollmentId: number;
  tuitionChargeId: number;
  registrationChargeId: number | null;
  discountCount: number;
};

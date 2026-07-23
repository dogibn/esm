import { z } from "zod";

// The New Contract flow either creates a brand-new Student row ("new") or
// reuses an existing one ("existing"). This axis is about the DB record; it is
// distinct from `studentCategory`, which is the domain flag that drives the
// registration fee (see domain_model.md § Enrollment).
export const ENROLLMENT_MODES = ["new", "existing"] as const;
export type EnrollmentMode = (typeof ENROLLMENT_MODES)[number];

export const STUDENT_CATEGORIES = ["new", "old"] as const;
export type StudentCategory = (typeof STUDENT_CATEGORIES)[number];

// Optional free text for nullable columns. The form always sends a string
// (possibly empty); the service layer normalizes "" → null. Kept transform-free
// so react-hook-form's input and output types stay aligned.
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const discountInputSchema = z.object({
  name: z.string().trim().min(1, "Discount needs a name").max(100),
  amount: z.number().int().positive("Discount must be positive"),
  notes: optionalText(500),
});

export type DiscountInput = z.infer<typeof discountInputSchema>;

export const createEnrollmentSchema = z
  .object({
    mode: z.enum(ENROLLMENT_MODES),
    // DB id of the reused student (mode === "existing" only).
    existingStudentId: z.number().int().positive().optional(),

    // Personal information (Student row).
    studentId: z.string().trim().min(1, "Student ID is required").max(50),
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Surname is required").max(100),
    parentEmail: optionalText(200),
    parentPhone: optionalText(50),

    // Contract / enrollment (Enrollment row).
    gradeId: z.number().int().positive("Choose a class"),
    studentCategory: z.enum(STUDENT_CATEGORIES),
    tuitionContractId: optionalText(100),
    studentCode: optionalText(100),

    // Tuition charge — resolved from the fee structure, but editable.
    tuitionAmount: z.number().int().nonnegative(),
    // Registration charge — applied only for `studentCategory === "new"`,
    // and only when the amount is positive. The form always supplies these two
    // (never omitted), so they stay required — keeping the schema's input and
    // output types identical for react-hook-form.
    registrationAmount: z.number().int().nonnegative(),

    discounts: z.array(discountInputSchema),
  })
  .refine((d) => d.mode !== "existing" || d.existingStudentId !== undefined, {
    message: "Select an existing student",
    path: ["existingStudentId"],
  });

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

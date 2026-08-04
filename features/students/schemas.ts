import { z } from "zod";

export const STATUS_FILTER_VALUES = ["unpaid", "partial", "paid"] as const;
export type StatusFilterValue = (typeof STATUS_FILTER_VALUES)[number];

export const studentListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).optional(),
  gradeLevelId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUS_FILTER_VALUES).optional(),
});

export type StudentListParams = z.infer<typeof studentListParamsSchema>;

export const studentIdParamSchema = z.coerce.number().int().positive();

// Blank optional contact fields collapse to NULL rather than empty strings.
const optionalContact = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable(),
  );

// Student-owned profile fields editable from the detail page. Class, teacher,
// tuition contract, charges, and payments are intentionally excluded — they
// live on other tables and (for charges/payments) are immutable per the
// domain model's audit-trail rules.
export const studentUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  parentEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("Enter a valid email").max(255).nullable(),
  ),
  parentPhone: optionalContact(50),
});

export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

// Tuition breakdown edit: the base (gross) tuition amount plus the set of
// discount lines on the enrollment. Net = base − Σ discounts is derived, never
// stored. Money is integer MNT. The "net ≥ already paid" floor is enforced
// server-side (it needs the payment total), the "discounts ≤ base" invariant
// here.
export const tuitionUpdateSchema = z
  .object({
    baseAmount: z.coerce.number().int().nonnegative(),
    discounts: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Discount name is required").max(100),
          amount: z.coerce.number().int().nonnegative(),
          // Optional link to the sibling Student (DB id) for a sibling
          // discount; NULL otherwise. See discounts.sibling_student_id.
          siblingStudentId: z.coerce.number().int().positive().nullish(),
        }),
      )
      .max(20)
      .default([]),
  })
  .refine(
    (d) => d.discounts.reduce((s, x) => s + x.amount, 0) <= d.baseAmount,
    { message: "Discounts can't exceed the base tuition.", path: ["discounts"] },
  );

export type TuitionUpdateInput = z.infer<typeof tuitionUpdateSchema>;

// ── Charges (non-tuition fees) ────────────────────────────────────────────────

export const CHARGE_SCOPES = ["annual", "term"] as const;
export type ChargeScopeValue = (typeof CHARGE_SCOPES)[number];

const optionalNotes = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(500).nullish(),
);

export const chargeCreateSchema = z
  .object({
    feeName: z.string().trim().min(1, "Fee name is required").max(60),
    scope: z.enum(CHARGE_SCOPES),
    academicTermId: z.coerce.number().int().positive().optional(),
    amount: z.coerce.number().int().nonnegative(),
    notes: optionalNotes,
  })
  .refine(
    (d) =>
      d.scope === "annual" ? d.academicTermId === undefined : d.academicTermId !== undefined,
    { message: "Choose a term for a term-based fee.", path: ["academicTermId"] },
  );

export type ChargeCreateInput = z.infer<typeof chargeCreateSchema>;

export const chargeUpdateSchema = z.object({
  amount: z.coerce.number().int().nonnegative(),
  notes: optionalNotes,
});

export type ChargeUpdateInput = z.infer<typeof chargeUpdateSchema>;

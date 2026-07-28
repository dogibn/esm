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

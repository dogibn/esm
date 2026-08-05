import { z } from "zod";

// From the pure calc module (not the barrel) so this schema — imported by client
// components — never transitively bundles server-only code.
import { DISCOUNT_UNITS } from "@/features/discounts/calc";

export const STATUS_FILTER_VALUES = ["unpaid", "partial", "paid"] as const;
export type StatusFilterValue = (typeof STATUS_FILTER_VALUES)[number];

// Which fee the tracking table is scoped to. Everything but `all` narrows the
// result set to students who hold a charge for that fee. Tuition is the
// default because it is the fee every enrolled student carries.
export const FEE_SCOPE_VALUES = [
  "all",
  "tuition",
  "bus",
  "registration",
  "clubs",
] as const;
export type FeeScopeValue = (typeof FEE_SCOPE_VALUES)[number];

export const DEFAULT_FEE_SCOPE: FeeScopeValue = "tuition";

// Shared by the route handler and the UI, so `?fee=` means the same thing on
// both sides. An unknown value falls back to the default rather than 400-ing —
// a stale bookmark should still open the tracker.
export const feeScopeSchema = z
  .enum(FEE_SCOPE_VALUES)
  .catch(DEFAULT_FEE_SCOPE)
  .default(DEFAULT_FEE_SCOPE);

// How the tracking table is laid out. `class` folds each class's students
// under one class row and paginates by class, so a class is never split across
// two pages — `page`/`pageSize` count classes, not students. `none` is the flat
// list. Display only: it narrows nothing and changes no total.
export const GROUP_BY_VALUES = ["none", "class"] as const;
export type GroupByValue = (typeof GROUP_BY_VALUES)[number];

export const DEFAULT_GROUP_BY: GroupByValue = "none";

export const groupBySchema = z
  .enum(GROUP_BY_VALUES)
  .catch(DEFAULT_GROUP_BY)
  .default(DEFAULT_GROUP_BY);

/** Students per page in the flat table. */
export const STUDENT_PAGE_SIZE = 50;

/**
 * Classes per page when grouping. Far fewer, because a class row carries its
 * students with it — ten classes is already ~250 rows on the page.
 */
export const CLASS_PAGE_SIZE = 10;

export function pageSizeFor(groupBy: GroupByValue): number {
  return groupBy === "class" ? CLASS_PAGE_SIZE : STUDENT_PAGE_SIZE;
}

/**
 * The one scope that offers grouping: tuition is the fee every enrolled
 * student carries, so a class row there sums the whole class. In a scope that
 * drops students holding no such charge, it would sum a subset while naming
 * the class (`user_flows.md` § 1).
 */
export const GROUPABLE_FEE_SCOPE: FeeScopeValue = "tuition";

/** Grouping asked for outside that scope is dropped, not honoured. */
export function resolveGroupBy(
  fee: FeeScopeValue,
  groupBy: GroupByValue,
): GroupByValue {
  return fee === GROUPABLE_FEE_SCOPE ? groupBy : DEFAULT_GROUP_BY;
}

export const studentListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(STUDENT_PAGE_SIZE),
  search: z.string().trim().min(1).optional(),
  gradeLevelId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUS_FILTER_VALUES).optional(),
  fee: feeScopeSchema,
  groupBy: groupBySchema,
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
// Tuition breakdown edit: the base (gross) amount plus the ordered set of
// applied discounts. Each references a catalog entry; discounts compound onto
// the base in array order. Unit/name/resolved MNT are derived server-side from
// the catalog, so the client only sends the type, an optional custom value, and
// an optional sibling link. Net = compound(base, discounts) is computed, never
// stored; the "net ≥ already paid" floor is enforced server-side.
export const tuitionUpdateSchema = z.object({
  baseAmount: z.coerce.number().int().nonnegative(),
  discounts: z
    .array(
      z
        .object({
          // A catalog entry, or null for a legacy/manual passthrough row that
          // carries its own name/unit/value (preserves pre-catalog discounts).
          discountTypeId: z.coerce.number().int().positive().nullable(),
          name: z.string().trim().max(100).nullish(),
          unit: z.enum(DISCOUNT_UNITS).nullish(),
          value: z.coerce.number().nonnegative().nullish(),
          siblingStudentId: z.coerce.number().int().positive().nullish(),
        })
        .refine(
          (d) =>
            d.discountTypeId !== null ||
            (!!d.name && !!d.unit && d.value !== null && d.value !== undefined),
          {
            message: "A manual discount needs a name, unit, and value.",
            path: ["discountTypeId"],
          },
        ),
    )
    .max(20)
    .default([]),
});

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

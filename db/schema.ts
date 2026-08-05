import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  bigint,
  jsonb,
  date,
  numeric,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    // Internal PK, independent of the Supabase auth user id. Authorization
    // matches on `email` (see lib/auth.ts) so the same allowlist row serves a
    // password identity and a Google identity for the same address. Default
    // lets the provisioning script seed the allowlist before any auth user
    // (e.g. a Google-only account) exists.
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull().unique(),
    role: text("role").notNull(),
    // Access is revoked by clearing this flag, never by deleting the row:
    // operations.actor_user_id points here, so a delete would either fail or
    // orphan the audit trail. An inactive row keeps the history readable and
    // makes re-granting access a one-click reversal.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("users_role_check", sql`${t.role} IN ('accountant', 'admin')`)]
);

export const gradeLevels = pgTable("grade_levels", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academicYears = pgTable(
  "academic_years",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("academic_years_is_current_unique")
      .on(t.isCurrent)
      .where(sql`${t.isCurrent} = TRUE`),
  ]
);

export const academicTerms = pgTable(
  "academic_terms",
  {
    id: serial("id").primaryKey(),
    academicYearId: integer("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("academic_terms_academic_year_id_name_unique").on(t.academicYearId, t.name),
    uniqueIndex("academic_terms_is_current_unique")
      .on(t.isCurrent)
      .where(sql`${t.isCurrent} = TRUE`),
    index("academic_terms_academic_year_id_idx").on(t.academicYearId),
  ]
);

export const grades = pgTable(
  "grades",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    gradeLevelId: integer("grade_level_id")
      .notNull()
      .references(() => gradeLevels.id),
    academicYearId: integer("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    teacherName: text("teacher_name").notNull(),
    teacherEmail: text("teacher_email"),
    teacherPhone: text("teacher_phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("grades_academic_year_id_name_unique").on(t.academicYearId, t.name),
    index("grades_academic_year_id_grade_level_id_idx").on(t.academicYearId, t.gradeLevelId),
  ]
);

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    studentId: text("student_id").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    parentEmail: text("parent_email"),
    parentPhone: text("parent_phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("students_last_name_first_name_idx").on(t.lastName, t.firstName)]
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id),
    academicYearId: integer("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    gradeId: integer("grade_id")
      .notNull()
      .references(() => grades.id),
    status: text("status").notNull(),
    studentCategory: text("student_category").notNull(),
    tuitionContractId: text("tuition_contract_id"),
    studentCode: text("student_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollments_student_id_academic_year_id_unique").on(
      t.studentId,
      t.academicYearId
    ),
    uniqueIndex("enrollments_academic_year_id_student_code_unique")
      .on(t.academicYearId, t.studentCode)
      .where(sql`${t.studentCode} IS NOT NULL`),
    index("enrollments_academic_year_id_grade_id_idx").on(t.academicYearId, t.gradeId),
    check("enrollments_status_check", sql`${t.status} IN ('active', 'inactive', 'withdrawn')`),
    check("enrollments_student_category_check", sql`${t.studentCategory} IN ('new', 'old')`),
  ]
);

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: serial("id").primaryKey(),
    feeName: text("fee_name").notNull(),
    data: jsonb("data").notNull(),
    academicTermId: integer("academic_term_id").references(() => academicTerms.id),
    effectiveFrom: date("effective_from").notNull(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("fee_structures_fee_name_academic_term_id_effective_from_unique").on(
      t.feeName,
      t.academicTermId,
      t.effectiveFrom
    ),
    // sql template used to avoid the drizzle-kit eq() parameterization bug with partial indexes
    index("fee_structures_fee_name_active_idx")
      .on(t.feeName)
      .where(sql`${t.supersededAt} IS NULL`),
  ]
);

export const clubEnrollments = pgTable(
  "club_enrollments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id),
    feeStructureId: integer("fee_structure_id")
      .notNull()
      .references(() => feeStructures.id),
    academicTermId: integer("academic_term_id")
      .notNull()
      .references(() => academicTerms.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("club_enrollments_student_id_fee_structure_id_unique").on(
      t.studentId,
      t.feeStructureId
    ),
  ]
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: serial("id").primaryKey(),
    transactionId: text("transaction_id").notNull().unique(),
    senderName: text("sender_name"),
    senderAccount: text("sender_account"),
    memo: text("memo"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    transactionAt: timestamp("transaction_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    // Set when status = 'discarded' (a soft delete for non-student rows).
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
    discardedByUserId: uuid("discarded_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // sql template used to avoid the drizzle-kit eq() parameterization bug with partial indexes
    index("bank_transactions_unmatched_idx")
      .on(t.status)
      .where(sql`${t.status} = 'unmatched'`),
    index("bank_transactions_transaction_at_idx").on(t.transactionAt),
    check(
      "bank_transactions_status_check",
      sql`${t.status} IN ('matched', 'unmatched', 'discarded')`
    ),
  ]
);

export const charges = pgTable(
  "charges",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id),
    academicYearId: integer("academic_year_id").references(() => academicYears.id),
    academicTermId: integer("academic_term_id").references(() => academicTerms.id),
    feeName: text("fee_name").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "charges_scope_check",
      sql`(${t.academicYearId} IS NOT NULL AND ${t.academicTermId} IS NULL) OR (${t.academicYearId} IS NULL AND ${t.academicTermId} IS NOT NULL)`
    ),
    index("charges_student_id_academic_year_id_idx").on(t.studentId, t.academicYearId),
    index("charges_student_id_academic_term_id_idx").on(t.studentId, t.academicTermId),
    index("charges_fee_name_idx").on(t.feeName),
    // Prevent duplicate charges for the same student + scope + fee. Split into
    // two partial unique indexes so the nullable scope column is never part of
    // the comparison (matches charges_scope_check: exactly one of year/term is
    // set). Guards against a re-run load script or UI action silently creating
    // a second charge and doubling a student's computed balance.
    uniqueIndex("charges_student_year_fee_unique")
      .on(t.studentId, t.academicYearId, t.feeName)
      .where(sql`${t.academicTermId} IS NULL`),
    uniqueIndex("charges_student_term_fee_unique")
      .on(t.studentId, t.academicTermId, t.feeName)
      .where(sql`${t.academicYearId} IS NULL`),
  ]
);

// Catalog of reusable tuition discount definitions ("early-bird", "sibling",
// "scholarship"). Admins curate these; every accountant reads them. A row is a
// template — `value` NULL means the amount/percent is entered when applied
// ("custom"). See domain_model.md § DiscountType.
export const discountTypes = pgTable(
  "discount_types",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    // 'percent' → `value` is a percentage (0–100); 'mnt' → `value` is a flat
    // MNT amount.
    unit: text("unit").notNull(),
    // Default value for the discount, or NULL for "custom" (supplied at apply
    // time). Numeric so percents can carry a fraction; MNT values stay whole.
    value: numeric("value", { precision: 12, scale: 4, mode: "number" }),
    note: text("note"),
    // Retire a type without deleting it (applied discounts still reference it).
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    check("discount_types_unit_check", sql`${t.unit} IN ('percent', 'mnt')`),
    check(
      "discount_types_value_check",
      sql`${t.value} IS NULL OR (${t.value} >= 0 AND (${t.unit} <> 'percent' OR ${t.value} <= 100))`
    ),
  ]
);

export const discounts = pgTable(
  "discounts",
  {
    id: serial("id").primaryKey(),
    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    // The catalog entry this discount was applied from. Nullable so legacy
    // free-text discounts (pre-catalog) remain valid. RESTRICT: retire a type
    // via is_active instead of deleting one that's in use.
    discountTypeId: integer("discount_type_id").references(() => discountTypes.id),
    name: text("name").notNull(),
    // Snapshot of how this discount was expressed, captured at apply time so
    // the row is self-describing and survives edits to the catalog entry.
    // 'percent' | 'mnt'.
    unit: text("unit").notNull(),
    // The percent (0–100) or MNT amount that was applied.
    value: numeric("value", { precision: 12, scale: 4, mode: "number" }).notNull(),
    // Application order within the enrollment (0-based). Discounts compound in
    // this order onto the running tuition (domain_model.md § Discount).
    position: integer("position").notNull(),
    // Resolved MNT reduction this line contributed, in sequence. The balance
    // formula sums this, so order is already baked in and reads stay a SUM.
    amount: bigint("amount", { mode: "number" }).notNull(),
    notes: text("notes"),
    // Optional soft pointer to the sibling Student a sibling discount is tied
    // to. Nullable — only sibling discounts set it; every other discount type
    // leaves it NULL. References the Student (not their Enrollment) so the link
    // is stable across years and enrolled-this-year can be resolved at read
    // time. ON DELETE SET NULL: removing a student clears the reference rather
    // than blocking the delete, and the discount itself stays valid.
    siblingStudentId: integer("sibling_student_id").references(() => students.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    index("discounts_enrollment_id_idx").on(t.enrollmentId),
    index("discounts_sibling_student_id_idx").on(t.siblingStudentId),
    index("discounts_discount_type_id_idx").on(t.discountTypeId),
    uniqueIndex("discounts_enrollment_id_position_unique").on(
      t.enrollmentId,
      t.position
    ),
    check("discounts_unit_check", sql`${t.unit} IN ('percent', 'mnt')`),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    bankTransactionId: integer("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id),
    chargeId: integer("charge_id")
      .notNull()
      .references(() => charges.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    // The confirm operation that created this payment (nullable: pre-dates the
    // operations log). Undo voids exactly the payments carrying its id.
    operationId: integer("operation_id").references(() => operations.id),
    // A voided payment no longer counts toward paid totals or balances, but is
    // kept for audit. Live iff voided_at IS NULL.
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUserId: uuid("voided_by_user_id").references(() => users.id),
  },
  (t) => [
    index("payments_charge_id_idx").on(t.chargeId),
    index("payments_bank_transaction_id_idx").on(t.bankTransactionId),
    index("payments_operation_id_idx").on(t.operationId),
  ]
);

// Append-only log of user-initiated actions, and the unit of undo. Each
// mutation writes one row; undoable ones carry `undoable_until`. See
// docs/history_and_reversibility.md.
export const operations = pgTable(
  "operations",
  {
    id: serial("id").primaryKey(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    // The bank transaction this operation concerns (all Phase 1-2 kinds do).
    bankTransactionId: integer("bank_transaction_id").references(
      () => bankTransactions.id
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Undo deadline, stored at write time. NULL = not undoable (e.g. an `undo`).
    undoableUntil: timestamp("undoable_until", { withTimezone: true }),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
    undoneByUserId: uuid("undone_by_user_id").references(() => users.id),
    // The `undo` operation that reversed this one (self-reference).
    undoOperationId: integer("undo_operation_id").references(
      (): AnyPgColumn => operations.id
    ),
    summary: text("summary").notNull(),
    details: jsonb("details"),
  },
  (t) => [
    check(
      "operations_kind_check",
      sql`${t.kind} IN ('confirm_match', 'discard_transaction', 'restore_transaction', 'create_enrollment', 'add_discount', 'user_access', 'undo')`
    ),
    index("operations_actor_user_id_idx").on(t.actorUserId),
    index("operations_bank_transaction_id_idx").on(t.bankTransactionId),
    index("operations_kind_idx").on(t.kind),
    index("operations_created_at_idx").on(t.createdAt),
  ]
);

// Inferred types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type GradeLevel = typeof gradeLevels.$inferSelect;
export type NewGradeLevel = typeof gradeLevels.$inferInsert;

export type AcademicYear = typeof academicYears.$inferSelect;
export type NewAcademicYear = typeof academicYears.$inferInsert;

export type AcademicTerm = typeof academicTerms.$inferSelect;
export type NewAcademicTerm = typeof academicTerms.$inferInsert;

export type Grade = typeof grades.$inferSelect;
export type NewGrade = typeof grades.$inferInsert;

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export type FeeStructure = typeof feeStructures.$inferSelect;
export type NewFeeStructure = typeof feeStructures.$inferInsert;

export type ClubEnrollment = typeof clubEnrollments.$inferSelect;
export type NewClubEnrollment = typeof clubEnrollments.$inferInsert;

export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;

export type Charge = typeof charges.$inferSelect;
export type NewCharge = typeof charges.$inferInsert;

export type DiscountType = typeof discountTypes.$inferSelect;
export type NewDiscountType = typeof discountTypes.$inferInsert;

export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type Operation = typeof operations.$inferSelect;
export type NewOperation = typeof operations.$inferInsert;

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  bigint,
  jsonb,
  date,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollments_student_id_academic_year_id_unique").on(
      t.studentId,
      t.academicYearId
    ),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // sql template used to avoid the drizzle-kit eq() parameterization bug with partial indexes
    index("bank_transactions_unmatched_idx")
      .on(t.status)
      .where(sql`${t.status} = 'unmatched'`),
    index("bank_transactions_transaction_at_idx").on(t.transactionAt),
    check("bank_transactions_status_check", sql`${t.status} IN ('matched', 'unmatched')`),
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
  ]
);

export const discounts = pgTable(
  "discounts",
  {
    id: serial("id").primaryKey(),
    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    name: text("name").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
  },
  (t) => [index("discounts_enrollment_id_idx").on(t.enrollmentId)]
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
  },
  (t) => [
    index("payments_charge_id_idx").on(t.chargeId),
    index("payments_bank_transaction_id_idx").on(t.bankTransactionId),
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

export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

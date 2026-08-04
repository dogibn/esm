import { relations } from "drizzle-orm";
import {
  users,
  gradeLevels,
  academicYears,
  academicTerms,
  grades,
  students,
  enrollments,
  feeStructures,
  clubEnrollments,
  bankTransactions,
  charges,
  discountTypes,
  discounts,
  payments,
  operations,
} from "./schema";

export const studentsRelations = relations(students, ({ many }) => ({
  enrollments: many(enrollments),
  charges: many(charges),
  clubEnrollments: many(clubEnrollments),
  siblingDiscounts: many(discounts),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  academicYear: one(academicYears, {
    fields: [enrollments.academicYearId],
    references: [academicYears.id],
  }),
  grade: one(grades, {
    fields: [enrollments.gradeId],
    references: [grades.id],
  }),
  discounts: many(discounts),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  gradeLevel: one(gradeLevels, {
    fields: [grades.gradeLevelId],
    references: [gradeLevels.id],
  }),
  academicYear: one(academicYears, {
    fields: [grades.academicYearId],
    references: [academicYears.id],
  }),
}));

export const gradeLevelsRelations = relations(gradeLevels, ({ many }) => ({
  grades: many(grades),
}));

export const academicYearsRelations = relations(academicYears, ({ many }) => ({
  academicTerms: many(academicTerms),
  grades: many(grades),
  enrollments: many(enrollments),
  charges: many(charges),
}));

export const academicTermsRelations = relations(academicTerms, ({ one, many }) => ({
  academicYear: one(academicYears, {
    fields: [academicTerms.academicYearId],
    references: [academicYears.id],
  }),
  feeStructures: many(feeStructures),
  clubEnrollments: many(clubEnrollments),
  charges: many(charges),
}));

export const feeStructuresRelations = relations(feeStructures, ({ many }) => ({
  clubEnrollments: many(clubEnrollments),
}));

export const clubEnrollmentsRelations = relations(clubEnrollments, ({ one }) => ({
  student: one(students, {
    fields: [clubEnrollments.studentId],
    references: [students.id],
  }),
  feeStructure: one(feeStructures, {
    fields: [clubEnrollments.feeStructureId],
    references: [feeStructures.id],
  }),
  academicTerm: one(academicTerms, {
    fields: [clubEnrollments.academicTermId],
    references: [academicTerms.id],
  }),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ many }) => ({
  payments: many(payments),
}));

export const chargesRelations = relations(charges, ({ one, many }) => ({
  student: one(students, {
    fields: [charges.studentId],
    references: [students.id],
  }),
  payments: many(payments),
}));

export const discountTypesRelations = relations(discountTypes, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [discountTypes.createdBy],
    references: [users.id],
  }),
  discounts: many(discounts),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [discounts.enrollmentId],
    references: [enrollments.id],
  }),
  discountType: one(discountTypes, {
    fields: [discounts.discountTypeId],
    references: [discountTypes.id],
  }),
  sibling: one(students, {
    fields: [discounts.siblingStudentId],
    references: [students.id],
  }),
  createdByUser: one(users, {
    fields: [discounts.createdBy],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  bankTransaction: one(bankTransactions, {
    fields: [payments.bankTransactionId],
    references: [bankTransactions.id],
  }),
  charge: one(charges, {
    fields: [payments.chargeId],
    references: [charges.id],
  }),
  recordedByUser: one(users, {
    fields: [payments.recordedBy],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  discounts: many(discounts),
  discountTypes: many(discountTypes),
  payments: many(payments),
  operations: many(operations),
}));

export const operationsRelations = relations(operations, ({ one }) => ({
  actor: one(users, {
    fields: [operations.actorUserId],
    references: [users.id],
  }),
  bankTransaction: one(bankTransactions, {
    fields: [operations.bankTransactionId],
    references: [bankTransactions.id],
  }),
}));

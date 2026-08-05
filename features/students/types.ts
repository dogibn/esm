export type { Student, NewStudent, Enrollment, Grade } from "@/db/schema";
export type {
  ChargeWithBalance,
  ChargeScope,
  ChargeWithBalanceForStudent,
} from "./balance";
import type { FeeScopeValue } from "./schemas";

export type FeeStatus = "paid" | "partial" | "unpaid" | "none";

// One student in the tracking table, resolved for the selected fee scope. One
// row per student always — a student holding several club charges is folded
// into a single row (see balance.ts § foldChargeTotals).
export type StudentRow = {
  studentId: number;
  studentCode: string;
  firstName: string;
  lastName: string;
  /** The class (`grades.id`) this row is enrolled in — what grouping folds on. */
  gradeId: number;
  gradeName: string;
  gradeLevelCode: string;
  /** Gross charged minus applicable discounts, summed over the scoped charges. */
  due: number;
  paid: number;
  /** `due − paid`. Signed: an overpayment is negative. */
  balance: number;
  /** Derived, never stored. `none` only in the all-fees rollup, for a student
   *  who holds no charges at all. */
  status: FeeStatus;
  /** ISO date of the most recent payment against the scoped charges — dated by
   *  when the money moved (`bank_transactions.transaction_at`). */
  lastPaymentAt: string | null;
};

// Aggregates over every student matching the current filters and fee scope
// (all pages), shown in the summary cards above the tracking table.
export type StudentListSummary = {
  students: number;
  /** Σ due — the scoped charges net of discounts. */
  totalDue: number;
  /** Σ paid. */
  totalCollected: number;
  /** Σ balance — what is still outstanding within the scope. */
  totalOutstanding: number;
};

// One class in the grouped table: the class row's own figures, plus every
// student in it. Totals are the sum over `rows`, and `rows` is the whole class
// — grouping paginates by class, so a class is never split across pages.
export type StudentClassGroup = {
  gradeId: number;
  gradeName: string;
  gradeLevelCode: string;
  /** Denormalized on `grades` (domain_model.md § Grade); "" if unset. */
  teacherName: string;
  students: number;
  due: number;
  paid: number;
  balance: number;
  rows: StudentRow[];
};

export type StudentListResponse = {
  /** The page's students, flat. When grouped, the groups' rows concatenated. */
  rows: StudentRow[];
  /** The page's classes. Null unless the request asked to group by class. */
  groups: StudentClassGroup[] | null;
  page: number;
  /** Students per page — or classes per page, when grouped. */
  pageSize: number;
  /** Students matching the filters, over every page. Never the class count. */
  total: number;
  /** Classes matching the filters, over every page. Null unless grouped. */
  totalGroups: number | null;
  /** Pages available: over students, or over classes when grouped. */
  pageCount: number;
  fee: FeeScopeValue;
  summary: StudentListSummary;
};

export type GradeLevelOption = {
  id: number;
  code: string;
  sortOrder: number;
};

export type GradeOption = {
  id: number;
  name: string;
  gradeLevelId: number;
};

export type FilterOptions = {
  gradeLevels: GradeLevelOption[];
  grades: GradeOption[];
};

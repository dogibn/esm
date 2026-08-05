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

export type StudentListResponse = {
  rows: StudentRow[];
  page: number;
  pageSize: number;
  total: number;
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

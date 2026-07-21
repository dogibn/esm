export type { Student, NewStudent, Enrollment, Grade } from "@/db/schema";
export type {
  ChargeWithBalance,
  ChargeScope,
  ChargeWithBalanceForStudent,
} from "./balance";

export type FeeStatus = "paid" | "partial" | "unpaid" | "none";

export type FeeCell = {
  hasCharge: boolean;
  charged: number;
  discount: number;
  paid: number;
  balance: number;
  status: FeeStatus;
};

export type ClubFeeItem = {
  feeName: string;
  charged: number;
  paid: number;
  balance: number;
  status: FeeStatus;
};

export type ClubsFeeCell = FeeCell & {
  chargeCount: number;
  items: ClubFeeItem[];
};

export type StudentRow = {
  studentId: number;
  studentCode: string;
  firstName: string;
  lastName: string;
  gradeName: string;
  gradeLevelCode: string;
  tuition: FeeCell;
  bus: FeeCell;
  registration: FeeCell;
  clubs: ClubsFeeCell;
  totalCharged: number;
  totalDiscount: number;
  totalPaid: number;
  totalBalance: number;
  overallStatus: FeeStatus;
};

// Aggregates over every student matching the current filters (all pages),
// shown in the summary cards above the tracking table.
export type StudentListSummary = {
  students: number;
  totalCharged: number;
  totalCollected: number;
  totalDue: number;
};

export type StudentListResponse = {
  rows: StudentRow[];
  page: number;
  pageSize: number;
  total: number;
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

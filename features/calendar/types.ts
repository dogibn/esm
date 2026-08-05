export type { AcademicYear, AcademicTerm } from "@/db/schema";

// What already points at a term. Anything non-zero makes the row undeletable —
// the FKs are ON DELETE RESTRICT, so the DB would refuse anyway; counting first
// lets the UI explain *why* instead of surfacing a constraint error.
export type TermUsage = {
  charges: number;
  clubEnrollments: number;
  feeStructures: number;
};

export type YearUsage = {
  terms: number;
  grades: number;
  enrollments: number;
  charges: number;
};

export type AcademicTermRow = {
  id: number;
  academicYearId: number;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  isCurrent: boolean;
  usage: TermUsage;
  /** False when the term is current or something references it. */
  canDelete: boolean;
};

export type AcademicYearRow = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: AcademicTermRow[];
  usage: YearUsage;
  canDelete: boolean;
};

export type AcademicCalendar = {
  years: AcademicYearRow[];
};

// What `setCurrentAcademicYear` did, so the UI can say which term came along
// with the year (the two flags always move together — see api.ts).
export type SetCurrentYearResult = {
  yearId: number;
  termId: number;
  termName: string;
};

export type { Grade, GradeLevel } from "@/db/schema";

export type GradeLevelUsage = {
  /** Classes at this level, across every year. */
  grades: number;
  /** Students enrolled in those classes, across every year. */
  enrollments: number;
};

export type GradeLevelRow = {
  id: number;
  code: string;
  sortOrder: number;
  usage: GradeLevelUsage;
  /** True when the code appears in a live tuition rate's `by_grade` map. */
  usedInTuition: boolean;
  canDelete: boolean;
};

export type ClassRow = {
  id: number;
  name: string;
  gradeLevelId: number;
  gradeLevelCode: string;
  academicYearId: number;
  teacherName: string;
  teacherEmail: string | null;
  teacherPhone: string | null;
  /** Students enrolled in this class (any status). */
  enrollments: number;
  /**
   * False once anyone is enrolled: the level decides which tuition rate a
   * student is charged, so re-pointing a populated class would leave what was
   * charged disagreeing with what the class now claims.
   */
  canChangeLevel: boolean;
  canDelete: boolean;
};

export type ClassesYearOption = {
  id: number;
  name: string;
  isCurrent: boolean;
};

export type ClassesOverview = {
  years: ClassesYearOption[];
  selectedYearId: number;
  levels: GradeLevelRow[];
  classes: ClassRow[];
};

export type { FeeStructure } from "@/db/schema";
export type { ByGradeEntry, ParsedFeeData } from "./shape";

import type { ByGradeEntry } from "./shape";

export type FeeShape = "flat" | "by_grade" | "unknown";

export type FeeRateRow = {
  id: number;
  /** The date the rate applies from (calendar day, YYYY-MM-DD). */
  effectiveFrom: string;
  /** ISO timestamp; null means this is the row currently in force. */
  supersededAt: string | null;
  isCurrent: boolean;
  shape: FeeShape;
  /** Set for a flat fee. */
  amount: number | null;
  /** Set for a per-grade fee, ordered by the levels' sort order. */
  byGrade: ByGradeEntry[] | null;
};

export type SchoolFeeGroup = {
  feeName: string;
  label: string;
  /** The shape a new rate for this fee must keep. */
  shape: FeeShape;
  current: FeeRateRow | null;
  /** Superseded rows, newest first. */
  history: FeeRateRow[];
};

export type ClubFeeRow = {
  id: number;
  feeName: string;
  amount: number | null;
  teacher: string | null;
  schedule: string | null;
};

export type ClubTermGroup = {
  termId: number;
  termName: string;
  yearName: string;
  isCurrent: boolean;
  fees: ClubFeeRow[];
};

export type FeeLevelOption = {
  id: number;
  code: string;
  sortOrder: number;
};

export type FeesOverview = {
  schoolFees: SchoolFeeGroup[];
  clubTerms: ClubTermGroup[];
  /** Every grade level, so a per-grade rate can be priced against all of them. */
  levels: FeeLevelOption[];
};

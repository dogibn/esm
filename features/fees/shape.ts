// Pure module — the `fee_structures.data` JSONB shapes from
// domain_model.md § FeeStructure, read and written in one place. No db import,
// so the client can share it.
//
//   Flat fee (bus, registration):  { "amount": 450000 }
//   Per-grade fee (tuition):       { "by_grade": { "1": 2000000, "5+": 1800000 } }
//   Club fee:                      { "amount": 300000, "teacher": …, "schedule": … }

// The stored name of the one fee every student is charged and the only one
// priced per grade level. It gets its own section on /fees; every other
// school-wide fee is listed together.
export const TUITION_FEE_NAME = "tuition";

export type ParsedFeeData =
  | {
      shape: "flat";
      amount: number;
      // Club rows are flat plus metadata. What makes a fee a club is its term
      // scoping, not its data shape, so both surface here.
      teacher: string | null;
      schedule: string | null;
    }
  | { shape: "by_grade"; byGrade: Record<string, number> }
  | { shape: "unknown" };

export type ByGradeEntry = { code: string; amount: number };

function asRecord(data: unknown): Record<string, unknown> | null {
  return data !== null && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function numericMap(src: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [code, value] of Object.entries(src)) {
    const n = numberOrNull(value);
    if (n !== null) out[code] = n;
  }
  return out;
}

/**
 * Read a stored fee's data.
 *
 * `amount` is checked before `by_grade` on purpose: a flat `{ amount: 450000 }`
 * would otherwise fall into the bare-map tolerance below and read as a grade
 * level literally named "amount".
 *
 * The bare-map tolerance mirrors what the charge-creating path already accepts
 * (`features/enrollments/api.ts` § resolveByGrade): some loaded tuition rows are
 * a plain `{ "1": 2000000, … }` with no `by_grade` wrapper, and the app charges
 * from them, so this view must show the same thing rather than "unknown".
 */
export function parseFeeData(data: unknown): ParsedFeeData {
  const obj = asRecord(data);
  if (obj === null) return { shape: "unknown" };

  const amount = numberOrNull(obj["amount"]);
  if (amount !== null) {
    return {
      shape: "flat",
      amount,
      teacher: stringOrNull(obj["teacher"]),
      schedule: stringOrNull(obj["schedule"]),
    };
  }

  const nested = asRecord(obj["by_grade"]);
  if (nested !== null) return { shape: "by_grade", byGrade: numericMap(nested) };

  const bare = numericMap(obj);
  if (Object.keys(bare).length > 0) return { shape: "by_grade", byGrade: bare };

  return { shape: "unknown" };
}

/** The grade-level codes a per-grade fee prices. Empty for any other shape. */
export function feeGradeCodes(data: unknown): string[] {
  const parsed = parseFeeData(data);
  return parsed.shape === "by_grade" ? Object.keys(parsed.byGrade) : [];
}

export function buildFlatData(amount: number): { amount: number } {
  return { amount };
}

// Always writes the wrapped form, whatever the row being superseded looked
// like: new data should be canonical even when the old row was a bare map.
export function buildByGradeData(entries: ByGradeEntry[]): {
  by_grade: Record<string, number>;
} {
  const by_grade: Record<string, number> = {};
  for (const e of entries) by_grade[e.code] = e.amount;
  return { by_grade };
}

export type ByGradeCoverage = {
  /** Levels that exist but the new rate doesn't price. */
  missing: string[];
  /** Codes in the new rate that match no grade level. */
  unknown: string[];
};

/**
 * A per-grade rate has to price every grade level, and nothing else: a level
 * with no entry silently yields no tuition when a contract is created for it,
 * and a stray code is a typo that will never be looked up.
 */
export function checkByGradeCoverage(
  levelCodes: string[],
  entries: ByGradeEntry[],
): ByGradeCoverage {
  const levels = new Set(levelCodes);
  const priced = new Set(entries.map((e) => e.code));
  return {
    missing: levelCodes.filter((c) => !priced.has(c)),
    unknown: entries.map((e) => e.code).filter((c) => !levels.has(c)),
  };
}

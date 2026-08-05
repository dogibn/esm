import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicTerms,
  academicYears,
  feeStructures,
  gradeLevels,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";

import type { FeeRatePublishInput } from "./schemas";
import {
  buildByGradeData,
  buildFlatData,
  checkByGradeCoverage,
  parseFeeData,
  type ByGradeEntry,
} from "./shape";
import type {
  ClubTermGroup,
  FeeRateRow,
  FeeShape,
  FeesOverview,
  SchoolFeeGroup,
} from "./types";

// Human labels for the stored fee names. Anything unlabelled falls back to a
// prettified version of the stored name.
const FEE_LABELS: Record<string, string> = {
  tuition: "Tuition",
  registration: "Registration",
  bus_fee: "Bus fee",
  bus: "Bus fee",
};

function feeLabel(feeName: string): string {
  return (
    FEE_LABELS[feeName] ??
    feeName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Display order: the fees the school charges everyone, in the order they are
// talked about. Anything else sorts after, alphabetically.
const FEE_ORDER: Record<string, number> = {
  tuition: 0,
  registration: 1,
  bus_fee: 2,
  bus: 2,
};

function toRateRow(
  row: {
    id: number;
    effectiveFrom: string;
    supersededAt: Date | null;
    data: unknown;
  },
  levelOrder: Map<string, number>,
): FeeRateRow {
  const parsed = parseFeeData(row.data);
  const base = {
    id: row.id,
    effectiveFrom: row.effectiveFrom,
    supersededAt: row.supersededAt === null ? null : row.supersededAt.toISOString(),
    isCurrent: row.supersededAt === null,
  };

  if (parsed.shape === "flat") {
    return { ...base, shape: "flat", amount: parsed.amount, byGrade: null };
  }
  if (parsed.shape === "by_grade") {
    const byGrade: ByGradeEntry[] = Object.entries(parsed.byGrade)
      .map(([code, amount]) => ({ code, amount }))
      // Grade-level order, so "2" reads before "10"; unknown codes last.
      .sort(
        (a, b) =>
          (levelOrder.get(a.code) ?? Number.MAX_SAFE_INTEGER) -
            (levelOrder.get(b.code) ?? Number.MAX_SAFE_INTEGER) ||
          a.code.localeCompare(b.code),
      );
    return { ...base, shape: "by_grade", amount: null, byGrade };
  }
  return { ...base, shape: "unknown", amount: null, byGrade: null };
}

/**
 * Every school-wide fee with the rate in force and the rates it replaced, plus
 * club fees grouped by term.
 *
 * Readable by any signed-in user: what the school charges is context, not a
 * secret. A fixed number of queries.
 */
export async function listFeeRates(): Promise<FeesOverview> {
  const [levelRows, feeRows, termRows] = await Promise.all([
    db
      .select({
        id: gradeLevels.id,
        code: gradeLevels.code,
        sortOrder: gradeLevels.sortOrder,
      })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.sortOrder), asc(gradeLevels.code)),
    db
      .select({
        id: feeStructures.id,
        feeName: feeStructures.feeName,
        data: feeStructures.data,
        academicTermId: feeStructures.academicTermId,
        effectiveFrom: feeStructures.effectiveFrom,
        supersededAt: feeStructures.supersededAt,
      })
      .from(feeStructures)
      .orderBy(desc(feeStructures.effectiveFrom), desc(feeStructures.id)),
    db
      .select({
        id: academicTerms.id,
        name: academicTerms.name,
        isCurrent: academicTerms.isCurrent,
        startDate: academicTerms.startDate,
        yearName: academicYears.name,
      })
      .from(academicTerms)
      .innerJoin(academicYears, eq(academicYears.id, academicTerms.academicYearId))
      .orderBy(desc(academicTerms.startDate)),
  ]);

  const levelOrder = new Map(levelRows.map((l) => [l.code, l.sortOrder]));

  // School-wide fees: academic_term_id IS NULL (domain_model.md § FeeStructure).
  const schoolByName = new Map<string, FeeRateRow[]>();
  const clubsByTerm = new Map<number, typeof feeRows>();
  for (const row of feeRows) {
    if (row.academicTermId === null) {
      const arr = schoolByName.get(row.feeName);
      const mapped = toRateRow(row, levelOrder);
      if (arr) arr.push(mapped);
      else schoolByName.set(row.feeName, [mapped]);
    } else {
      const arr = clubsByTerm.get(row.academicTermId);
      if (arr) arr.push(row);
      else clubsByTerm.set(row.academicTermId, [row]);
    }
  }

  const schoolFees: SchoolFeeGroup[] = [...schoolByName.entries()]
    .map(([feeName, rows]) => {
      const current = rows.find((r) => r.isCurrent) ?? null;
      const history = rows.filter((r) => !r.isCurrent);
      // A new rate keeps the shape of the one in force; with no current row,
      // fall back to the most recent one's shape.
      const shape: FeeShape = current?.shape ?? rows[0]?.shape ?? "unknown";
      return { feeName, label: feeLabel(feeName), shape, current, history };
    })
    .sort((a, b) => {
      const oa = FEE_ORDER[a.feeName] ?? 100;
      const ob = FEE_ORDER[b.feeName] ?? 100;
      return oa === ob ? a.feeName.localeCompare(b.feeName) : oa - ob;
    });

  const clubTerms: ClubTermGroup[] = termRows
    .map((t) => {
      const rows = clubsByTerm.get(t.id) ?? [];
      return {
        termId: t.id,
        termName: t.name,
        yearName: t.yearName,
        isCurrent: t.isCurrent,
        fees: rows
          .map((r) => {
            const parsed = parseFeeData(r.data);
            return {
              id: r.id,
              feeName: r.feeName,
              amount: parsed.shape === "flat" ? parsed.amount : null,
              teacher: parsed.shape === "flat" ? parsed.teacher : null,
              schedule: parsed.shape === "flat" ? parsed.schedule : null,
            };
          })
          .sort((a, b) => a.feeName.localeCompare(b.feeName)),
      };
    })
    .filter((t) => t.fees.length > 0);

  return { schoolFees, clubTerms, levels: levelRows };
}

// A calendar day, in the same YYYY-MM-DD form the `date` columns use.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Publish a new rate for a school-wide fee: supersede the row in force and
 * insert a new one, in one transaction. The only write this feature has.
 *
 * Admin-only (the route enforces `requireAdmin`).
 *
 * **This does not change a single existing charge.** A Charge stores the
 * resolved gross amount at creation time (domain_model.md § Charge), so a new
 * rate reaches only charges created after it. The UI says so before publishing.
 */
export async function publishFeeRate(
  _user: User,
  input: FeeRatePublishInput,
): Promise<{ id: number }> {
  const feeName = input.feeName.trim();

  const existing = await db
    .select({
      id: feeStructures.id,
      data: feeStructures.data,
      effectiveFrom: feeStructures.effectiveFrom,
      supersededAt: feeStructures.supersededAt,
    })
    .from(feeStructures)
    .where(and(eq(feeStructures.feeName, feeName), isNull(feeStructures.academicTermId)))
    .orderBy(desc(feeStructures.effectiveFrom), desc(feeStructures.id));

  // Rates are published for fees the school already has. Inventing a fee here
  // would create one nothing charges against — new fees arrive with the
  // year/term-start import.
  if (existing.length === 0) {
    throw new HttpError(400, `"${feeName}" isn't a school-wide fee.`);
  }

  const live = existing.filter((r) => r.supersededAt === null);
  const reference = live[0] ?? existing[0]!;
  const currentShape = parseFeeData(reference.data).shape;
  const wantsByGrade = input.byGrade !== null && input.byGrade !== undefined;

  // A fee keeps its shape. Turning tuition into a flat fee (or the reverse)
  // would break every reader that expects one of them.
  if (currentShape === "by_grade" && !wantsByGrade) {
    throw new HttpError(400, `${feeLabel(feeName)} is priced per grade level.`);
  }
  if (currentShape === "flat" && wantsByGrade) {
    throw new HttpError(400, `${feeLabel(feeName)} is a single amount, not per grade.`);
  }

  // A published rate takes effect immediately — the app reads "the rate in
  // force" as the row with `superseded_at IS NULL`, without consulting
  // `effective_from`. A future date would therefore apply today while claiming
  // otherwise, so publish it on the day it starts. One day of slack keeps a
  // Ulaanbaatar "today" (UTC+8) from being rejected as the future.
  if (input.effectiveFrom > addDays(today(), 1)) {
    throw new HttpError(
      400,
      "A new rate applies as soon as it's published, so its date can't be in the future.",
    );
  }
  if (live.length > 0 && input.effectiveFrom < reference.effectiveFrom) {
    throw new HttpError(
      400,
      `The rate in force starts ${reference.effectiveFrom}; a replacement can't start before it.`,
    );
  }
  if (existing.some((r) => r.effectiveFrom === input.effectiveFrom)) {
    throw new HttpError(
      409,
      `A ${feeLabel(feeName)} rate already starts ${input.effectiveFrom}. Pick another date.`,
    );
  }

  let data: unknown;
  if (wantsByGrade) {
    const entries = input.byGrade!;
    const levels = await db
      .select({ code: gradeLevels.code })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.sortOrder));
    const coverage = checkByGradeCoverage(
      levels.map((l) => l.code),
      entries,
    );
    if (coverage.unknown.length > 0) {
      throw new HttpError(
        400,
        `No grade level matches ${coverage.unknown.join(", ")}.`,
      );
    }
    if (coverage.missing.length > 0) {
      throw new HttpError(
        400,
        `Give an amount for every grade level — missing ${coverage.missing.join(", ")}.`,
      );
    }
    data = buildByGradeData(entries);
  } else {
    data = buildFlatData(input.amount!);
  }

  const created = await db.transaction(async (tx) => {
    await tx
      .update(feeStructures)
      .set({ supersededAt: new Date() })
      .where(
        and(
          eq(feeStructures.feeName, feeName),
          isNull(feeStructures.academicTermId),
          isNull(feeStructures.supersededAt),
        ),
      );
    const [row] = await tx
      .insert(feeStructures)
      .values({
        feeName,
        data: data as never,
        academicTermId: null,
        effectiveFrom: input.effectiveFrom,
        supersededAt: null,
      })
      .returning({ id: feeStructures.id });
    return row!;
  });

  return { id: created.id };
}

// Exposed for the tracker's "is this fee school-wide?" question and for tests.
export async function currentSchoolFeeNames(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ feeName: feeStructures.feeName })
    .from(feeStructures)
    .where(and(isNull(feeStructures.academicTermId), isNull(feeStructures.supersededAt)))
    .orderBy(sql`${feeStructures.feeName} ASC`);
  return rows.map((r) => r.feeName);
}

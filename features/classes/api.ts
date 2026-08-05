import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicYears,
  enrollments,
  feeStructures,
  gradeLevels,
  grades,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";
import { feeGradeCodes } from "@/features/fees";

import type {
  ClassCreateInput,
  ClassUpdateInput,
  ClassesQuery,
  GradeLevelCreateInput,
  GradeLevelUpdateInput,
} from "./schemas";
import type { ClassRow, ClassesOverview, GradeLevelRow } from "./types";

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Grade levels (school-wide) plus the classes of one academic year.
 *
 * Levels are stable across years; classes are per-year (domain_model.md
 * § Cadence of change), which is why the page picks a year for the second half
 * and not the first.
 *
 * A fixed number of queries — the counts are grouped, never per row.
 */
export async function listClasses(query: ClassesQuery): Promise<ClassesOverview> {
  const yearRows = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      isCurrent: academicYears.isCurrent,
    })
    .from(academicYears)
    .orderBy(sql`${academicYears.startDate} DESC`);

  if (yearRows.length === 0) {
    throw new HttpError(400, "No academic year exists yet. Add one in the calendar.");
  }

  const selected =
    (query.year !== undefined
      ? yearRows.find((y) => y.id === query.year)
      : undefined) ??
    yearRows.find((y) => y.isCurrent) ??
    yearRows[0]!;

  const [levelRows, classRows, gradeCounts, levelEnrollmentCounts, classEnrollmentCounts, tuitionRows] =
    await Promise.all([
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
          id: grades.id,
          name: grades.name,
          gradeLevelId: grades.gradeLevelId,
          gradeLevelCode: gradeLevels.code,
          academicYearId: grades.academicYearId,
          teacherName: grades.teacherName,
          teacherEmail: grades.teacherEmail,
          teacherPhone: grades.teacherPhone,
        })
        .from(grades)
        .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
        .where(eq(grades.academicYearId, selected.id))
        .orderBy(asc(gradeLevels.sortOrder), asc(grades.name)),
      db
        .select({ key: grades.gradeLevelId, count: sql<number>`COUNT(*)`.as("count") })
        .from(grades)
        .groupBy(grades.gradeLevelId),
      // Enrolments per level, across every year — deleting a level is a
      // school-wide decision, not a per-year one.
      db
        .select({
          key: grades.gradeLevelId,
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(enrollments)
        .innerJoin(grades, eq(grades.id, enrollments.gradeId))
        .groupBy(grades.gradeLevelId),
      db
        .select({
          key: enrollments.gradeId,
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(enrollments)
        .groupBy(enrollments.gradeId),
      // Live per-grade rates, to show which levels tuition actually prices.
      db
        .select({ data: feeStructures.data })
        .from(feeStructures)
        .where(
          and(isNull(feeStructures.academicTermId), isNull(feeStructures.supersededAt)),
        ),
    ]);

  const gradeCountBy = new Map(gradeCounts.map((r) => [r.key, Number(r.count)]));
  const levelEnrollmentBy = new Map(
    levelEnrollmentCounts.map((r) => [r.key, Number(r.count)]),
  );
  const classEnrollmentBy = new Map(
    classEnrollmentCounts.map((r) => [r.key, Number(r.count)]),
  );
  const pricedCodes = new Set(tuitionRows.flatMap((r) => feeGradeCodes(r.data)));

  const levels: GradeLevelRow[] = levelRows.map((l) => {
    const usage = {
      grades: gradeCountBy.get(l.id) ?? 0,
      enrollments: levelEnrollmentBy.get(l.id) ?? 0,
    };
    return {
      ...l,
      usage,
      usedInTuition: pricedCodes.has(l.code),
      canDelete: usage.grades === 0 && !pricedCodes.has(l.code),
    };
  });

  const classes: ClassRow[] = classRows.map((c) => {
    const enrolled = classEnrollmentBy.get(c.id) ?? 0;
    return {
      ...c,
      enrollments: enrolled,
      canChangeLevel: enrolled === 0,
      canDelete: enrolled === 0,
    };
  });

  return { years: yearRows, selectedYearId: selected.id, levels, classes };
}

// ─── Grade levels ─────────────────────────────────────────────────────────────

async function loadLevel(id: number) {
  const [level] = await db
    .select({
      id: gradeLevels.id,
      code: gradeLevels.code,
      sortOrder: gradeLevels.sortOrder,
    })
    .from(gradeLevels)
    .where(eq(gradeLevels.id, id))
    .limit(1);
  if (!level) throw new HttpError(404, "Grade level not found");
  return level;
}

// Admin-only (routes enforce requireAdmin). `user` is carried for the audit
// author these will gain — see the change note.
export async function createGradeLevel(
  _user: User,
  input: GradeLevelCreateInput,
): Promise<{ id: number }> {
  const [clash] = await db
    .select({ id: gradeLevels.id })
    .from(gradeLevels)
    .where(eq(gradeLevels.code, input.code))
    .limit(1);
  if (clash) {
    throw new HttpError(409, `Grade level "${input.code}" already exists.`);
  }

  const [created] = await db
    .insert(gradeLevels)
    .values({ code: input.code, sortOrder: input.sortOrder })
    .returning({ id: gradeLevels.id });
  return { id: created!.id };
}

// Only the display order. `code` is the tuition lookup key and is fixed at
// creation — see schemas.ts.
export async function updateGradeLevel(
  _user: User,
  id: number,
  input: GradeLevelUpdateInput,
): Promise<{ ok: true }> {
  await loadLevel(id);
  await db
    .update(gradeLevels)
    .set({ sortOrder: input.sortOrder })
    .where(eq(gradeLevels.id, id));
  return { ok: true };
}

export async function deleteGradeLevel(
  _user: User,
  id: number,
): Promise<{ ok: true }> {
  const level = await loadLevel(id);

  const [grade] = await db
    .select({ id: grades.id })
    .from(grades)
    .where(eq(grades.gradeLevelId, id))
    .limit(1);
  if (grade) {
    throw new HttpError(409, "This level has classes and can't be deleted.");
  }

  // Not an FK — tuition references the level by its code inside JSONB — so
  // nothing but this check stands between a delete and a rate that prices a
  // level no longer offered.
  const tuitionRows = await db
    .select({ data: feeStructures.data })
    .from(feeStructures)
    .where(and(isNull(feeStructures.academicTermId), isNull(feeStructures.supersededAt)));
  if (tuitionRows.some((r) => feeGradeCodes(r.data).includes(level.code))) {
    throw new HttpError(
      409,
      `Tuition still prices "${level.code}". Publish a rate without it first.`,
    );
  }

  await db.delete(gradeLevels).where(eq(gradeLevels.id, id));
  return { ok: true };
}

// ─── Classes ──────────────────────────────────────────────────────────────────

async function loadClass(id: number) {
  const [row] = await db
    .select({
      id: grades.id,
      name: grades.name,
      gradeLevelId: grades.gradeLevelId,
      academicYearId: grades.academicYearId,
    })
    .from(grades)
    .where(eq(grades.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, "Class not found");
  return row;
}

async function ensureClassNameFree(
  academicYearId: number,
  name: string,
  exceptId?: number,
): Promise<void> {
  const filters = [eq(grades.academicYearId, academicYearId), eq(grades.name, name)];
  if (exceptId !== undefined) filters.push(ne(grades.id, exceptId));
  const [clash] = await db
    .select({ id: grades.id })
    .from(grades)
    .where(and(...filters))
    .limit(1);
  if (clash) {
    throw new HttpError(409, `That year already has a class named "${name}".`);
  }
}

async function ensureLevelExists(gradeLevelId: number): Promise<void> {
  const [level] = await db
    .select({ id: gradeLevels.id })
    .from(gradeLevels)
    .where(eq(gradeLevels.id, gradeLevelId))
    .limit(1);
  if (!level) throw new HttpError(400, "That grade level doesn't exist.");
}

async function enrollmentCount(gradeId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(enrollments)
    .where(eq(enrollments.gradeId, gradeId));
  return Number(row?.count ?? 0);
}

export async function createClass(
  _user: User,
  input: ClassCreateInput,
): Promise<{ id: number }> {
  const [year] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.id, input.academicYearId))
    .limit(1);
  if (!year) throw new HttpError(400, "That academic year doesn't exist.");
  await ensureLevelExists(input.gradeLevelId);
  await ensureClassNameFree(input.academicYearId, input.name);

  const [created] = await db
    .insert(grades)
    .values({
      name: input.name,
      gradeLevelId: input.gradeLevelId,
      academicYearId: input.academicYearId,
      teacherName: input.teacherName,
      teacherEmail: input.teacherEmail,
      teacherPhone: input.teacherPhone,
    })
    .returning({ id: grades.id });
  return { id: created!.id };
}

/**
 * Edit a class. Teacher details are always editable — they are denormalized
 * display data (domain_model.md § Grade) and the likeliest thing to be wrong.
 *
 * The grade **level** is different: it decides which tuition rate a student at
 * this class is charged, so it can only change while nobody is enrolled.
 * Afterwards, what students were charged would disagree with what the class
 * claims, and moving it here would not recompute a single existing charge.
 */
export async function updateClass(
  _user: User,
  id: number,
  input: ClassUpdateInput,
): Promise<{ ok: true }> {
  const existing = await loadClass(id);
  await ensureClassNameFree(existing.academicYearId, input.name, id);

  if (input.gradeLevelId !== existing.gradeLevelId) {
    await ensureLevelExists(input.gradeLevelId);
    if ((await enrollmentCount(id)) > 0) {
      throw new HttpError(
        409,
        "This class has students, so its grade level is fixed — the level sets their tuition rate.",
      );
    }
  }

  await db
    .update(grades)
    .set({
      name: input.name,
      gradeLevelId: input.gradeLevelId,
      teacherName: input.teacherName,
      teacherEmail: input.teacherEmail,
      teacherPhone: input.teacherPhone,
      updatedAt: new Date(),
    })
    .where(eq(grades.id, id));
  return { ok: true };
}

export async function deleteClass(_user: User, id: number): Promise<{ ok: true }> {
  await loadClass(id);
  if ((await enrollmentCount(id)) > 0) {
    throw new HttpError(409, "This class has students and can't be deleted.");
  }
  await db.delete(grades).where(eq(grades.id, id));
  return { ok: true };
}

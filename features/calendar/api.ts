import { and, asc, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicTerms,
  academicYears,
  charges,
  clubEnrollments,
  enrollments,
  feeStructures,
  grades,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";

import { pickCurrentTerm } from "./current";
import type {
  AcademicTermCreateInput,
  AcademicTermUpdateInput,
  AcademicYearInput,
} from "./schemas";
import type {
  AcademicCalendar,
  AcademicTermRow,
  AcademicYearRow,
  SetCurrentYearResult,
} from "./types";

// ─── Read ─────────────────────────────────────────────────────────────────────

type CountRow = { key: number | null; count: number };

function countMap(rows: CountRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (r.key !== null) m.set(r.key, Number(r.count));
  }
  return m;
}

/**
 * The whole calendar: every year, its terms, and what already references each
 * row. Readable by any signed-in user — knowing which year and term the app is
 * operating in is context everyone needs.
 *
 * A fixed number of grouped queries (no per-row counting), so adding years
 * never multiplies the query count.
 */
export async function listAcademicCalendar(): Promise<AcademicCalendar> {
  const [
    yearRows,
    termRows,
    gradesByYear,
    enrollmentsByYear,
    chargesByYear,
    chargesByTerm,
    clubsByTerm,
    feesByTerm,
  ] = await Promise.all([
    db
      .select({
        id: academicYears.id,
        name: academicYears.name,
        startDate: academicYears.startDate,
        endDate: academicYears.endDate,
        isCurrent: academicYears.isCurrent,
      })
      .from(academicYears)
      // Newest first: the year someone wants is nearly always the recent one.
      .orderBy(desc(academicYears.startDate)),
    db
      .select({
        id: academicTerms.id,
        academicYearId: academicTerms.academicYearId,
        name: academicTerms.name,
        startDate: academicTerms.startDate,
        endDate: academicTerms.endDate,
        isCurrent: academicTerms.isCurrent,
      })
      .from(academicTerms)
      .orderBy(asc(academicTerms.startDate)),
    db
      .select({
        key: grades.academicYearId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(grades)
      .groupBy(grades.academicYearId),
    db
      .select({
        key: enrollments.academicYearId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(enrollments)
      .groupBy(enrollments.academicYearId),
    db
      .select({
        key: charges.academicYearId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(charges)
      .groupBy(charges.academicYearId),
    db
      .select({
        key: charges.academicTermId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(charges)
      .groupBy(charges.academicTermId),
    db
      .select({
        key: clubEnrollments.academicTermId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(clubEnrollments)
      .groupBy(clubEnrollments.academicTermId),
    db
      .select({
        key: feeStructures.academicTermId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(feeStructures)
      .groupBy(feeStructures.academicTermId),
  ]);

  const gradeCounts = countMap(gradesByYear);
  const enrollmentCounts = countMap(enrollmentsByYear);
  const yearChargeCounts = countMap(chargesByYear);
  const termChargeCounts = countMap(chargesByTerm);
  const clubCounts = countMap(clubsByTerm);
  const feeCounts = countMap(feesByTerm);

  const termsByYear = new Map<number, AcademicTermRow[]>();
  for (const t of termRows) {
    const usage = {
      charges: termChargeCounts.get(t.id) ?? 0,
      clubEnrollments: clubCounts.get(t.id) ?? 0,
      feeStructures: feeCounts.get(t.id) ?? 0,
    };
    const row: AcademicTermRow = {
      ...t,
      usage,
      canDelete:
        !t.isCurrent &&
        usage.charges === 0 &&
        usage.clubEnrollments === 0 &&
        usage.feeStructures === 0,
    };
    const arr = termsByYear.get(t.academicYearId);
    if (arr) arr.push(row);
    else termsByYear.set(t.academicYearId, [row]);
  }

  const years: AcademicYearRow[] = yearRows.map((y) => {
    const terms = termsByYear.get(y.id) ?? [];
    const usage = {
      terms: terms.length,
      grades: gradeCounts.get(y.id) ?? 0,
      enrollments: enrollmentCounts.get(y.id) ?? 0,
      charges: yearChargeCounts.get(y.id) ?? 0,
    };
    return {
      ...y,
      terms,
      usage,
      canDelete:
        !y.isCurrent &&
        usage.terms === 0 &&
        usage.grades === 0 &&
        usage.enrollments === 0 &&
        usage.charges === 0,
    };
  });

  return { years };
}

// ─── Shared guards ────────────────────────────────────────────────────────────

// Two ranges overlap unless one ends before the other begins. A date belongs to
// exactly one academic year, and to one term within it — nothing downstream
// (charge generation, "the current term") is meaningful otherwise.
function overlapClause(
  table: typeof academicYears | typeof academicTerms,
  startDate: string,
  endDate: string,
): SQL {
  return and(lte(table.startDate, endDate), gte(table.endDate, startDate))!;
}

async function loadYear(id: number) {
  const [year] = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      startDate: academicYears.startDate,
      endDate: academicYears.endDate,
      isCurrent: academicYears.isCurrent,
    })
    .from(academicYears)
    .where(eq(academicYears.id, id))
    .limit(1);
  if (!year) throw new HttpError(404, "Academic year not found");
  return year;
}

async function loadTerm(id: number) {
  const [term] = await db
    .select({
      id: academicTerms.id,
      academicYearId: academicTerms.academicYearId,
      name: academicTerms.name,
      startDate: academicTerms.startDate,
      endDate: academicTerms.endDate,
      isCurrent: academicTerms.isCurrent,
    })
    .from(academicTerms)
    .where(eq(academicTerms.id, id))
    .limit(1);
  if (!term) throw new HttpError(404, "Term not found");
  return term;
}

async function ensureYearNameFree(name: string, exceptId?: number): Promise<void> {
  const [clash] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.name, name))
    .limit(1);
  if (clash && clash.id !== exceptId) {
    throw new HttpError(409, `An academic year named "${name}" already exists.`);
  }
}

async function ensureYearRangeFree(
  input: AcademicYearInput,
  exceptId?: number,
): Promise<void> {
  const filters: SQL[] = [overlapClause(academicYears, input.startDate, input.endDate)];
  if (exceptId !== undefined) filters.push(ne(academicYears.id, exceptId));
  const [clash] = await db
    .select({ name: academicYears.name })
    .from(academicYears)
    .where(and(...filters))
    .limit(1);
  if (clash) {
    throw new HttpError(
      409,
      `Those dates overlap "${clash.name}". Academic years can't overlap.`,
    );
  }
}

async function ensureTermNameFree(
  academicYearId: number,
  name: string,
  exceptId?: number,
): Promise<void> {
  const filters: SQL[] = [
    eq(academicTerms.academicYearId, academicYearId),
    eq(academicTerms.name, name),
  ];
  if (exceptId !== undefined) filters.push(ne(academicTerms.id, exceptId));
  const [clash] = await db
    .select({ id: academicTerms.id })
    .from(academicTerms)
    .where(and(...filters))
    .limit(1);
  if (clash) {
    throw new HttpError(409, `That year already has a term named "${name}".`);
  }
}

async function ensureTermFits(
  year: { name: string; startDate: string; endDate: string },
  academicYearId: number,
  input: { startDate: string; endDate: string },
  exceptId?: number,
): Promise<void> {
  if (input.startDate < year.startDate || input.endDate > year.endDate) {
    throw new HttpError(
      400,
      `A term has to fall inside ${year.name} (${year.startDate} to ${year.endDate}).`,
    );
  }
  const filters: SQL[] = [
    eq(academicTerms.academicYearId, academicYearId),
    overlapClause(academicTerms, input.startDate, input.endDate),
  ];
  if (exceptId !== undefined) filters.push(ne(academicTerms.id, exceptId));
  const [clash] = await db
    .select({ name: academicTerms.name })
    .from(academicTerms)
    .where(and(...filters))
    .limit(1);
  if (clash) {
    throw new HttpError(
      409,
      `Those dates overlap "${clash.name}". Terms in a year can't overlap.`,
    );
  }
}

// ─── Academic years ───────────────────────────────────────────────────────────

// All writes here are admin-only; the routes enforce `requireAdmin`. `user` is
// carried for the audit author these will gain (see the change note).
export async function createAcademicYear(
  _user: User,
  input: AcademicYearInput,
): Promise<{ id: number }> {
  await ensureYearNameFree(input.name);
  await ensureYearRangeFree(input);

  const [created] = await db
    .insert(academicYears)
    .values({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      // Never current on creation — that is its own deliberate action.
      isCurrent: false,
    })
    .returning({ id: academicYears.id });
  return { id: created!.id };
}

export async function updateAcademicYear(
  _user: User,
  id: number,
  input: AcademicYearInput,
): Promise<{ ok: true }> {
  await loadYear(id);
  await ensureYearNameFree(input.name, id);
  await ensureYearRangeFree(input, id);

  // Narrowing a year's dates could strand its terms outside it, so re-check the
  // ones already attached rather than only the row being edited.
  const strays = await db
    .select({ name: academicTerms.name })
    .from(academicTerms)
    .where(
      and(
        eq(academicTerms.academicYearId, id),
        sql`(${academicTerms.startDate} < ${input.startDate} OR ${academicTerms.endDate} > ${input.endDate})`,
      ),
    )
    .limit(1);
  if (strays.length > 0) {
    throw new HttpError(
      409,
      `"${strays[0]!.name}" would fall outside these dates. Move the term first.`,
    );
  }

  await db
    .update(academicYears)
    .set({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .where(eq(academicYears.id, id));
  return { ok: true };
}

/**
 * Make a year current — the single most consequential switch in the app: every
 * view, and every charge the import creates, is scoped by it.
 *
 * The current term moves with it. `academic_years.is_current` and
 * `academic_terms.is_current` are read independently all over the app (the
 * tracker resolves both, then loads year-scoped and term-scoped charges), so a
 * current term belonging to a *different* year would quietly mix two years'
 * money. Keeping the pair consistent is this function's job, not the caller's:
 * an already-current term inside the target year is kept, otherwise the year's
 * earliest term takes over. The UI states which term that will be before the
 * user confirms.
 */
export async function setCurrentAcademicYear(
  _user: User,
  id: number,
): Promise<SetCurrentYearResult> {
  const year = await loadYear(id);

  const terms = await db
    .select({
      id: academicTerms.id,
      name: academicTerms.name,
      isCurrent: academicTerms.isCurrent,
    })
    .from(academicTerms)
    .where(eq(academicTerms.academicYearId, id))
    .orderBy(asc(academicTerms.startDate));

  const target = pickCurrentTerm(terms);
  if (target === null) {
    throw new HttpError(
      400,
      `${year.name} has no terms yet. Add at least one before making it current.`,
    );
  }

  // One transaction, clear-then-set: the partial unique indexes allow only one
  // current row per table, so the old flag has to be gone before the new one
  // lands.
  await db.transaction(async (tx) => {
    await tx
      .update(academicYears)
      .set({ isCurrent: false })
      .where(eq(academicYears.isCurrent, true));
    await tx
      .update(academicTerms)
      .set({ isCurrent: false })
      .where(eq(academicTerms.isCurrent, true));
    await tx
      .update(academicYears)
      .set({ isCurrent: true })
      .where(eq(academicYears.id, id));
    await tx
      .update(academicTerms)
      .set({ isCurrent: true })
      .where(eq(academicTerms.id, target.id));
  });

  return { yearId: id, termId: target.id, termName: target.name };
}

export async function deleteAcademicYear(
  _user: User,
  id: number,
): Promise<{ ok: true }> {
  const year = await loadYear(id);
  if (year.isCurrent) {
    throw new HttpError(409, "The current academic year can't be deleted.");
  }

  // The FKs are ON DELETE RESTRICT, so this is about the message, not the
  // enforcement — a bare constraint error tells the user nothing.
  const [[term], [grade], [enrollment], [charge]] = await Promise.all([
    db
      .select({ id: academicTerms.id })
      .from(academicTerms)
      .where(eq(academicTerms.academicYearId, id))
      .limit(1),
    db
      .select({ id: grades.id })
      .from(grades)
      .where(eq(grades.academicYearId, id))
      .limit(1),
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.academicYearId, id))
      .limit(1),
    db
      .select({ id: charges.id })
      .from(charges)
      .where(eq(charges.academicYearId, id))
      .limit(1),
  ]);
  if (term) throw new HttpError(409, "Delete this year's terms first.");
  if (grade) throw new HttpError(409, "This year has classes and can't be deleted.");
  if (enrollment) {
    throw new HttpError(409, "This year has enrolments and can't be deleted.");
  }
  if (charge) throw new HttpError(409, "This year has charges and can't be deleted.");

  await db.delete(academicYears).where(eq(academicYears.id, id));
  return { ok: true };
}

// ─── Academic terms ───────────────────────────────────────────────────────────

export async function createAcademicTerm(
  _user: User,
  input: AcademicTermCreateInput,
): Promise<{ id: number }> {
  const year = await loadYear(input.academicYearId);
  await ensureTermNameFree(input.academicYearId, input.name);
  await ensureTermFits(year, input.academicYearId, input);

  const [created] = await db
    .insert(academicTerms)
    .values({
      academicYearId: input.academicYearId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: false,
    })
    .returning({ id: academicTerms.id });
  return { id: created!.id };
}

export async function updateAcademicTerm(
  _user: User,
  id: number,
  input: AcademicTermUpdateInput,
): Promise<{ ok: true }> {
  const term = await loadTerm(id);
  const year = await loadYear(term.academicYearId);
  await ensureTermNameFree(term.academicYearId, input.name, id);
  await ensureTermFits(year, term.academicYearId, input, id);

  await db
    .update(academicTerms)
    .set({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .where(eq(academicTerms.id, id));
  return { ok: true };
}

/**
 * Make a term current. Only a term of the *current* year qualifies — see
 * `setCurrentAcademicYear` for why the two flags must agree. Switching year is
 * the way to reach another year's terms.
 */
export async function setCurrentAcademicTerm(
  _user: User,
  id: number,
): Promise<{ ok: true }> {
  const term = await loadTerm(id);
  const year = await loadYear(term.academicYearId);
  if (!year.isCurrent) {
    throw new HttpError(
      400,
      `"${term.name}" belongs to ${year.name}, which isn't the current year. Make that year current instead — its term follows.`,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(academicTerms)
      .set({ isCurrent: false })
      .where(eq(academicTerms.isCurrent, true));
    await tx
      .update(academicTerms)
      .set({ isCurrent: true })
      .where(eq(academicTerms.id, id));
  });
  return { ok: true };
}

export async function deleteAcademicTerm(
  _user: User,
  id: number,
): Promise<{ ok: true }> {
  const term = await loadTerm(id);
  if (term.isCurrent) {
    throw new HttpError(409, "The current term can't be deleted.");
  }

  const [[charge], [club], [fee]] = await Promise.all([
    db
      .select({ id: charges.id })
      .from(charges)
      .where(eq(charges.academicTermId, id))
      .limit(1),
    db
      .select({ id: clubEnrollments.id })
      .from(clubEnrollments)
      .where(eq(clubEnrollments.academicTermId, id))
      .limit(1),
    db
      .select({ id: feeStructures.id })
      .from(feeStructures)
      .where(eq(feeStructures.academicTermId, id))
      .limit(1),
  ]);
  if (charge) throw new HttpError(409, "This term has charges and can't be deleted.");
  if (club) {
    throw new HttpError(409, "This term has club enrolments and can't be deleted.");
  }
  if (fee) throw new HttpError(409, "This term has club fees and can't be deleted.");

  await db.delete(academicTerms).where(eq(academicTerms.id, id));
  return { ok: true };
}

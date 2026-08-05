import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicTerms,
  academicYears,
  charges,
  discounts,
  enrollments,
  gradeLevels,
  grades,
  payments,
  students,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";
import { computeTuition, resolveDiscountApplications } from "@/features/discounts";

import {
  chargeMatchesScope,
  deriveFeeStatus,
  foldChargeTotals,
  loadLastPaymentDates,
  loadStudentChargeDetails,
  type StudentChargeDetail,
} from "./balance";
import { groupRowsByClass } from "./grouping";
import type {
  ChargeCreateInput,
  ChargeUpdateInput,
  StudentListParams,
  StudentUpdateInput,
  TuitionUpdateInput,
} from "./schemas";
import type { FilterOptions, StudentListResponse, StudentRow } from "./types";

// One enrolment as the query returns it. `teacherName` is class metadata the
// grouped view puts on the class row, so it is picked off here rather than
// riding along into every StudentRow.
type EnrollmentBase = {
  studentId: number;
  studentCode: string;
  firstName: string;
  lastName: string;
  gradeId: number;
  gradeName: string;
  gradeLevelCode: string;
  teacherName: string;
};

// Fold a student's scoped charges into their single tracking row. Money math
// lives in balance.ts; this only assembles the DTO.
function buildStudentRow(
  base: EnrollmentBase,
  scopedCharges: StudentChargeDetail[],
  lastPaymentByCharge: Map<number, string>,
): StudentRow {
  const totals = foldChargeTotals(scopedCharges);

  let lastPaymentAt: string | null = null;
  for (const c of scopedCharges) {
    const at = lastPaymentByCharge.get(c.id);
    if (at !== undefined && (lastPaymentAt === null || at > lastPaymentAt)) {
      lastPaymentAt = at;
    }
  }

  return {
    studentId: base.studentId,
    studentCode: base.studentCode,
    firstName: base.firstName,
    lastName: base.lastName,
    gradeId: base.gradeId,
    gradeName: base.gradeName,
    gradeLevelCode: base.gradeLevelCode,
    due: totals.due,
    paid: totals.paid,
    balance: totals.balance,
    // A student with no charge at all only occurs in the all-fees rollup; the
    // per-fee scopes drop them from the result set entirely.
    status: scopedCharges.length === 0 ? "none" : deriveFeeStatus(totals),
    lastPaymentAt,
  };
}

// `user` accepted for future per-user scoping; not used yet.
//
// Why this is in-memory paginated: both the fee scope and the status filter are
// derived from the schema.md balance formula (computed by balance.ts), not
// stored. To filter on them we must fold per-student rows first, then apply the
// predicates. Pagination has to follow that filter — so we resolve everything
// for the current academic year/term in a fixed number of queries (no per-row
// lookups), then slice the page. Scale here is ~1.4k enrollments + ~5-10k
// charges per query; trivial to hold in memory.
export async function listStudents(
  _user: User,
  params: StudentListParams,
): Promise<StudentListResponse> {
  const [year] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) throw new HttpError(500, "No current academic year is set");

  const [term] = await db
    .select({ id: academicTerms.id })
    .from(academicTerms)
    .where(eq(academicTerms.isCurrent, true))
    .limit(1);
  if (!term) throw new HttpError(500, "No current academic term is set");

  const sqlFilters: SQL[] = [
    eq(enrollments.academicYearId, year.id),
    eq(enrollments.status, "active"),
  ];
  if (params.search) {
    const pattern = `%${params.search}%`;
    const searchClause = or(
      ilike(students.firstName, pattern),
      ilike(students.lastName, pattern),
      ilike(students.studentId, pattern),
      ilike(students.parentEmail, pattern),
      ilike(students.parentPhone, pattern),
    );
    if (searchClause) sqlFilters.push(searchClause);
  }
  if (params.gradeLevelId !== undefined) {
    sqlFilters.push(eq(gradeLevels.id, params.gradeLevelId));
  }
  if (params.gradeId !== undefined) {
    sqlFilters.push(eq(grades.id, params.gradeId));
  }
  const where = and(...sqlFilters);

  const [allRows, chargeDetails] = await Promise.all([
    db
      .select({
        studentId: students.id,
        studentCode: students.studentId,
        firstName: students.firstName,
        lastName: students.lastName,
        gradeId: grades.id,
        gradeName: grades.name,
        gradeLevelCode: gradeLevels.code,
        teacherName: grades.teacherName,
      })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .innerJoin(grades, eq(grades.id, enrollments.gradeId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
      .where(where)
      // Class first, then surname: accountants work class by class, so a
      // filtered view reads like their spreadsheet. Classes are ordered by
      // grade level (sort_order knows "2" < "10") then section name.
      //
      // '-' and '.' are the import's "surname unknown" markers; they sort
      // before every letter and would otherwise lead each class. Send them to
      // the end.
      .orderBy(
        asc(gradeLevels.sortOrder),
        asc(grades.name),
        sql`CASE WHEN ${students.lastName} IN ('-', '.') THEN NULL ELSE ${students.lastName} END ASC NULLS LAST`,
        asc(students.firstName),
      ),
    loadStudentChargeDetails({
      academicYearId: year.id,
      academicTermId: term.id,
    }),
  ]);

  // Narrow to the selected fee before anything else — in a per-fee scope a
  // student with no such charge drops out of the result set entirely, so the
  // table never renders an empty cell.
  const scopedCharges = chargeDetails.filter((c) =>
    chargeMatchesScope(c.feeName, params.fee),
  );

  const lastPaymentByCharge = await loadLastPaymentDates(
    scopedCharges.map((c) => c.id),
  );

  const chargesByStudent = new Map<number, StudentChargeDetail[]>();
  for (const c of scopedCharges) {
    let arr = chargesByStudent.get(c.studentId);
    if (!arr) {
      arr = [];
      chargesByStudent.set(c.studentId, arr);
    }
    arr.push(c);
  }

  const applicable =
    params.fee === "all"
      ? allRows
      : allRows.filter((r) => chargesByStudent.has(r.studentId));

  let folded = applicable.map((r) =>
    buildStudentRow(r, chargesByStudent.get(r.studentId) ?? [], lastPaymentByCharge),
  );

  if (params.status !== undefined) {
    const target = params.status;
    folded = folded.filter((row) => row.status === target);
  }

  const total = folded.length;

  // Class metadata the grouped view puts on the class row. It lives on the
  // enrolment query, not on the row DTOs.
  const teacherByGrade = new Map(allRows.map((r) => [r.gradeId, r.teacherName]));

  // Grouping paginates over classes rather than students, so a class is always
  // whole on the page it lands on — a class split across two pages would show
  // the same class row twice, each with a partial count.
  const allGroups =
    params.groupBy === "class" ? groupRowsByClass(folded, teacherByGrade) : null;
  const pageUnits = allGroups === null ? total : allGroups.length;
  const pageCount = Math.max(1, Math.ceil(pageUnits / params.pageSize));

  const offset = (params.page - 1) * params.pageSize;
  const groups =
    allGroups === null ? null : allGroups.slice(offset, offset + params.pageSize);
  const rows =
    groups === null
      ? folded.slice(offset, offset + params.pageSize)
      : groups.flatMap((g) => g.rows);

  const summary = folded.reduce(
    (acc, row) => {
      acc.totalDue += row.due;
      acc.totalCollected += row.paid;
      acc.totalOutstanding += row.balance;
      return acc;
    },
    { students: total, totalDue: 0, totalCollected: 0, totalOutstanding: 0 },
  );

  return {
    rows,
    groups,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalGroups: allGroups === null ? null : allGroups.length,
    pageCount,
    fee: params.fee,
    summary,
  };
}

export type UpdatedStudent = {
  id: number;
  firstName: string;
  lastName: string;
  parentEmail: string | null;
  parentPhone: string | null;
};

// `user` accepted for future audit/scoping; every accountant may edit profiles
// (domain_model.md § User: accountants do everything except manage FeeStructure).
export async function updateStudent(
  _user: User,
  studentId: number,
  input: StudentUpdateInput,
): Promise<UpdatedStudent> {
  const [existing] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!existing) throw new HttpError(404, "Student not found");

  const [updated] = await db
    .update(students)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      parentEmail: input.parentEmail,
      parentPhone: input.parentPhone,
      updatedAt: new Date(),
    })
    .where(eq(students.id, studentId))
    .returning({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
    });

  return updated!;
}

// Edit the tuition breakdown: correct the base (gross) amount and replace the
// enrollment's discount lines. Base tuition is normally immutable per
// domain_model.md § Charge, but an accountant may correct it here; the floor
// below keeps net tuition from dropping under what's already been paid.
export async function updateTuition(
  user: User,
  studentId: number,
  input: TuitionUpdateInput,
): Promise<{ ok: true }> {
  const [year] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) throw new HttpError(500, "No current academic year is set");

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.academicYearId, year.id),
      ),
    )
    .limit(1);
  if (!enrollment) throw new HttpError(404, "Student not found for the current year");

  const [tuitionCharge] = await db
    .select({ id: charges.id })
    .from(charges)
    .where(
      and(
        eq(charges.studentId, studentId),
        eq(charges.academicYearId, year.id),
        eq(charges.feeName, "tuition"),
      ),
    )
    .limit(1);
  if (!tuitionCharge) {
    throw new HttpError(400, "This student has no tuition charge to edit.");
  }

  const [paidRow] = await db
    .select({ paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.chargeId, tuitionCharge.id));
  const paid = Number(paidRow?.paid ?? 0);

  // Resolve against the catalog (order preserved) and compound onto the base.
  const resolved = await resolveDiscountApplications(input.discounts);
  const computed = computeTuition(
    input.baseAmount,
    resolved.map((r) => ({ unit: r.unit, value: r.value })),
  );
  if (computed.net < paid) {
    throw new HttpError(
      400,
      `Net tuition (${computed.net.toLocaleString("en-US")}₮) can't be below the ${paid.toLocaleString("en-US")}₮ already paid.`,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(charges)
      .set({ amount: input.baseAmount })
      .where(eq(charges.id, tuitionCharge.id));
    await tx.delete(discounts).where(eq(discounts.enrollmentId, enrollment.id));
    if (resolved.length > 0) {
      await tx.insert(discounts).values(
        resolved.map((r, index) => ({
          enrollmentId: enrollment.id,
          discountTypeId: r.discountTypeId,
          name: r.name,
          unit: r.unit,
          value: r.value,
          position: index,
          amount: computed.lines[index]!.amount,
          // Keep a sibling link only when it points at another student.
          siblingStudentId:
            r.siblingStudentId && r.siblingStudentId !== studentId
              ? r.siblingStudentId
              : null,
          createdBy: user.id,
        })),
      );
    }
  });

  return { ok: true };
}

// Tuition is edited through updateTuition (base + discounts); block it here so
// there's a single source of truth for the tuition charge.
const TUITION_FEE = "tuition";

async function paidForCharge(chargeId: number): Promise<number> {
  const [row] = await db
    .select({ paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.chargeId, chargeId));
  return Number(row?.paid ?? 0);
}

/**
 * A drizzle transaction handle (or the base client) — see features/history.
 * `insertCharge` takes one so the import flow can create a charge inside the
 * same transaction that records the payment against it.
 */
type DbClient =
  | typeof db
  | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/**
 * Insert one ad-hoc fee charge, with every rule that governs charge creation:
 * tuition is off-limits (it belongs to the tuition breakdown), the term must
 * belong to the current year, and a fee may exist only once per period.
 *
 * The single writer for new charges. `createCharge` is the student-page entry
 * point; `confirmAllocation` in features/imports calls this directly so a bank
 * payment can create the charge it pays for atomically.
 */
export async function insertCharge(
  client: DbClient,
  studentId: number,
  input: ChargeCreateInput,
): Promise<{ chargeId: number }> {
  const feeName = input.feeName.trim();
  if (feeName.toLowerCase() === TUITION_FEE) {
    throw new HttpError(400, "Tuition is managed from the tuition breakdown.");
  }

  const [year] = await client
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) throw new HttpError(500, "No current academic year is set");

  const [student] = await client
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) throw new HttpError(404, "Student not found");

  const scopeColumns: { academicYearId: number | null; academicTermId: number | null } =
    input.scope === "annual"
      ? { academicYearId: year.id, academicTermId: null }
      : { academicYearId: null, academicTermId: input.academicTermId! };

  if (input.scope === "term") {
    const [term] = await client
      .select({ id: academicTerms.id })
      .from(academicTerms)
      .where(
        and(
          eq(academicTerms.id, input.academicTermId!),
          eq(academicTerms.academicYearId, year.id),
        ),
      )
      .limit(1);
    if (!term) throw new HttpError(400, "That term is not part of the current year.");
  }

  // Reject a duplicate of the same fee in the same scope so the ledger stays
  // one-row-per-(fee, period).
  const dupeScope =
    input.scope === "annual"
      ? eq(charges.academicYearId, year.id)
      : eq(charges.academicTermId, input.academicTermId!);
  const [dupe] = await client
    .select({ id: charges.id })
    .from(charges)
    .where(and(eq(charges.studentId, studentId), eq(charges.feeName, feeName), dupeScope))
    .limit(1);
  if (dupe) {
    throw new HttpError(409, "This student already has that fee for the chosen period.");
  }

  const [created] = await client
    .insert(charges)
    .values({
      studentId,
      academicYearId: scopeColumns.academicYearId,
      academicTermId: scopeColumns.academicTermId,
      feeName,
      amount: input.amount,
      notes: input.notes ?? null,
    })
    .returning({ id: charges.id });

  return { chargeId: created!.id };
}

// Add an ad-hoc fee (registration, bus, a club, etc.) as a charge — annual
// (year-scoped) or attached to a specific term.
export async function createCharge(
  _user: User,
  studentId: number,
  input: ChargeCreateInput,
): Promise<{ chargeId: number }> {
  return insertCharge(db, studentId, input);
}

async function loadOwnedCharge(studentId: number, chargeId: number) {
  const [charge] = await db
    .select({ id: charges.id, feeName: charges.feeName, studentId: charges.studentId })
    .from(charges)
    .where(eq(charges.id, chargeId))
    .limit(1);
  if (!charge || charge.studentId !== studentId) {
    throw new HttpError(404, "Charge not found");
  }
  if (charge.feeName.toLowerCase() === TUITION_FEE) {
    throw new HttpError(400, "Tuition is managed from the tuition breakdown.");
  }
  return charge;
}

// Edit a charge's amount / notes. Amount can't drop below what's already been
// paid against it (balance would go negative).
export async function updateCharge(
  _user: User,
  studentId: number,
  chargeId: number,
  input: ChargeUpdateInput,
): Promise<{ ok: true }> {
  await loadOwnedCharge(studentId, chargeId);
  const paid = await paidForCharge(chargeId);
  if (input.amount < paid) {
    throw new HttpError(
      400,
      `Amount can't be below the ${paid.toLocaleString("en-US")}₮ already paid.`,
    );
  }
  await db
    .update(charges)
    .set({ amount: input.amount, notes: input.notes ?? null })
    .where(eq(charges.id, chargeId));
  return { ok: true };
}

// Delete a charge, but only when nothing has been paid against it (a paid
// charge is referenced by payments and part of the audit trail).
export async function deleteCharge(
  _user: User,
  studentId: number,
  chargeId: number,
): Promise<{ ok: true }> {
  await loadOwnedCharge(studentId, chargeId);
  const paid = await paidForCharge(chargeId);
  if (paid > 0) {
    throw new HttpError(409, "This fee has recorded payments and can't be deleted.");
  }
  await db.delete(charges).where(eq(charges.id, chargeId));
  return { ok: true };
}

export async function listFilterOptions(): Promise<FilterOptions> {
  const [year] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.isCurrent, true))
    .limit(1);
  if (!year) throw new HttpError(500, "No current academic year is set");

  const [gradeLevelRows, gradeRows] = await Promise.all([
    db
      .select({
        id: gradeLevels.id,
        code: gradeLevels.code,
        sortOrder: gradeLevels.sortOrder,
      })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.sortOrder)),
    db
      .select({
        id: grades.id,
        name: grades.name,
        gradeLevelId: grades.gradeLevelId,
      })
      .from(grades)
      .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
      .where(eq(grades.academicYearId, year.id))
      // Level order first (sort_order knows "2" < "10"), letters within a
      // level alphabetical.
      .orderBy(asc(gradeLevels.sortOrder), asc(grades.name)),
  ]);

  return {
    gradeLevels: gradeLevelRows,
    grades: gradeRows,
  };
}

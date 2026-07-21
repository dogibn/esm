import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/index";
import {
  academicTerms,
  academicYears,
  enrollments,
  gradeLevels,
  grades,
  students,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";

import { loadStudentChargeDetails, type StudentChargeDetail } from "./balance";
import type { StudentListParams } from "./schemas";
import type {
  ClubFeeItem,
  ClubsFeeCell,
  FeeCell,
  FeeStatus,
  FilterOptions,
  StudentListResponse,
  StudentRow,
} from "./types";

const NON_CLUB_FEE_NAMES = new Set(["tuition", "bus_fee", "bus", "registration"]);

function deriveStatus(opts: {
  hasCharge: boolean;
  balance: number;
  paid: number;
}): FeeStatus {
  if (!opts.hasCharge) return "none";
  if (opts.balance <= 0) return "paid";
  if (opts.paid > 0) return "partial";
  return "unpaid";
}

function emptyFeeCell(): FeeCell {
  return {
    hasCharge: false,
    charged: 0,
    discount: 0,
    paid: 0,
    balance: 0,
    status: "none",
  };
}

function foldFeeCell(rows: StudentChargeDetail[]): FeeCell {
  if (rows.length === 0) return emptyFeeCell();
  let charged = 0;
  let discount = 0;
  let paid = 0;
  let balance = 0;
  for (const r of rows) {
    charged += Number(r.grossAmount);
    discount += r.discountTotal;
    paid += r.paidTotal;
    balance += Number(r.outstandingBalance);
  }
  return {
    hasCharge: true,
    charged,
    discount,
    paid,
    balance,
    status: deriveStatus({ hasCharge: true, balance, paid }),
  };
}

function deriveOverallStatus(row: {
  hasAnyCharge: boolean;
  totalBalance: number;
  totalPaid: number;
}): FeeStatus {
  return deriveStatus({
    hasCharge: row.hasAnyCharge,
    balance: row.totalBalance,
    paid: row.totalPaid,
  });
}

function buildStudentRow(
  base: {
    studentId: number;
    studentCode: string;
    firstName: string;
    lastName: string;
    gradeName: string;
    gradeLevelCode: string;
  },
  studentCharges: StudentChargeDetail[],
): StudentRow {
  const tuitionCharges = studentCharges.filter((c) => c.feeName === "tuition");
  const busCharges = studentCharges.filter(
    (c) => c.feeName === "bus_fee" || c.feeName === "bus",
  );
  const registrationCharges = studentCharges.filter(
    (c) => c.feeName === "registration",
  );
  const clubCharges = studentCharges.filter(
    (c) => !NON_CLUB_FEE_NAMES.has(c.feeName),
  );

  const tuition = foldFeeCell(tuitionCharges);
  const bus = foldFeeCell(busCharges);
  const registration = foldFeeCell(registrationCharges);
  const clubsBase = foldFeeCell(clubCharges);
  const clubItems: ClubFeeItem[] = clubCharges.map((c) => {
    const charged = Number(c.grossAmount);
    const balance = Number(c.outstandingBalance);
    return {
      feeName: c.feeName,
      charged,
      paid: c.paidTotal,
      balance,
      status: deriveStatus({ hasCharge: true, balance, paid: c.paidTotal }),
    };
  });
  const clubs: ClubsFeeCell = {
    ...clubsBase,
    chargeCount: clubCharges.length,
    items: clubItems,
  };

  const totalCharged = tuition.charged + bus.charged + registration.charged + clubs.charged;
  const totalDiscount = tuition.discount + bus.discount + registration.discount + clubs.discount;
  const totalPaid = tuition.paid + bus.paid + registration.paid + clubs.paid;
  const totalBalance = tuition.balance + bus.balance + registration.balance + clubs.balance;

  return {
    studentId: base.studentId,
    studentCode: base.studentCode,
    firstName: base.firstName,
    lastName: base.lastName,
    gradeName: base.gradeName,
    gradeLevelCode: base.gradeLevelCode,
    tuition,
    bus,
    registration,
    clubs,
    totalCharged,
    totalDiscount,
    totalPaid,
    totalBalance,
    overallStatus: deriveOverallStatus({
      hasAnyCharge: studentCharges.length > 0,
      totalBalance,
      totalPaid,
    }),
  };
}

// `user` accepted for future per-user scoping; not used yet.
//
// Why this is in-memory paginated: the status filter is derived from the
// schema.md balance formula (computed by balance.ts), not stored. To filter on
// it we must fold per-student rows first, then apply the status predicate.
// Pagination has to follow that filter — so we resolve everything for the
// current academic year/term in one pass, then slice the page. Scale here is
// ~1.4k enrollments + ~5-10k charges per query; trivial to hold in memory.
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
        gradeName: grades.name,
        gradeLevelCode: gradeLevels.code,
      })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .innerJoin(grades, eq(grades.id, enrollments.gradeId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, grades.gradeLevelId))
      .where(where)
      // '-' and '.' are the import's "surname unknown" markers; they sort
      // before every letter and would otherwise fill page 1. Send them to
      // the end.
      .orderBy(
        sql`CASE WHEN ${students.lastName} IN ('-', '.') THEN NULL ELSE ${students.lastName} END ASC NULLS LAST`,
        asc(students.firstName),
      ),
    loadStudentChargeDetails({
      academicYearId: year.id,
      academicTermId: term.id,
    }),
  ]);

  const chargesByStudent = new Map<number, StudentChargeDetail[]>();
  for (const c of chargeDetails) {
    let arr = chargesByStudent.get(c.studentId);
    if (!arr) {
      arr = [];
      chargesByStudent.set(c.studentId, arr);
    }
    arr.push(c);
  }

  let folded = allRows.map((r) =>
    buildStudentRow(r, chargesByStudent.get(r.studentId) ?? []),
  );

  if (params.status !== undefined) {
    const target = params.status;
    folded = folded.filter((row) => row.overallStatus === target);
  }

  const total = folded.length;
  const offset = (params.page - 1) * params.pageSize;
  const rows = folded.slice(offset, offset + params.pageSize);

  const summary = folded.reduce(
    (acc, row) => {
      acc.totalCharged += row.totalCharged - row.totalDiscount;
      acc.totalCollected += row.totalPaid;
      acc.totalDue += row.totalBalance;
      return acc;
    },
    { students: total, totalCharged: 0, totalCollected: 0, totalDue: 0 },
  );

  return {
    rows,
    page: params.page,
    pageSize: params.pageSize,
    total,
    summary,
  };
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

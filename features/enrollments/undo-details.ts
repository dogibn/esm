// Pure parsing of the operations.details JSON that createEnrollment writes for a
// create_enrollment row. Kept free of any DB import so the undo's safety core is
// unit-testable in isolation (see undo-details.test.ts).

export type CreateEnrollmentDetails = {
  studentId: number;
  studentCreated: boolean;
  enrollmentId: number;
  chargeIds: number[];
};

/**
 * Read a create_enrollment operation's details back into a typed shape, or null
 * if it is missing/malformed. Undo must refuse rather than guess when the
 * details it needs to reverse the contract aren't intact.
 */
export function parseCreateEnrollmentDetails(
  details: unknown,
): CreateEnrollmentDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  if (typeof d.enrollmentId !== "number" || !Number.isInteger(d.enrollmentId)) {
    return null;
  }
  if (typeof d.studentId !== "number" || !Number.isInteger(d.studentId)) {
    return null;
  }
  const chargeIds = Array.isArray(d.chargeIds)
    ? d.chargeIds.filter(
        (v): v is number => typeof v === "number" && Number.isInteger(v),
      )
    : [];
  return {
    studentId: d.studentId,
    studentCreated: d.studentCreated === true,
    enrollmentId: d.enrollmentId,
    chargeIds,
  };
}

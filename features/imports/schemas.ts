import { z } from "zod";

import { NEW_CHARGE_PLACEHOLDER_ID } from "./matching";

const ACCEPTED_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
  "application/octet-stream", // some browsers fall back here for .xls
]);

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

// 25 MB ceiling. Bank exports are routinely well under 1 MB; this is a guard,
// not a target.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const uploadFileSchema = z
  .instanceof(File)
  .refine((f) => f.size > 0, "File is empty")
  .refine((f) => f.size <= MAX_FILE_BYTES, "File exceeds 25 MB limit")
  .refine(
    (f) =>
      ACCEPTED_MIMES.has(f.type) ||
      ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
    "File must be .xlsx, .xls, or .csv",
  );

// Used to validate row shape coming OUT of the parser before insert. Belt and
// suspenders — the parser builds these rows itself, but Zod here guards the
// DB boundary in case the parser is later modified.
export const parsedBankRowSchema = z.object({
  transactionId: z.string().min(1),
  senderName: z.string().nullable(),
  senderAccount: z.string().nullable(),
  memo: z.string().nullable(),
  amount: z.number().int(),
  transactionAt: z.date(),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type ParsedBankRowInput = z.infer<typeof parsedBankRowSchema>;

// ----------------------------------------------------------------------
// Allocation form — the editable shape the accountant submits per
// bank_transaction. Pre-filled from MatchResult, then validated client +
// server with this SAME schema. Step C's confirm endpoint will accept
// exactly this payload — design accordingly.
// ----------------------------------------------------------------------

export const allocationLineSchema = z.object({
  studentId: z.number().int().positive(),
  // Either a real charge id, or NEW_CHARGE_PLACEHOLDER_ID (-1) meaning "the
  // charge `createCharges` will make for this student" — see below.
  chargeId: z
    .number()
    .int()
    .refine((v) => v > 0 || v === NEW_CHARGE_PLACEHOLDER_ID, {
      message: "Charge id must be a real charge or the new-charge placeholder",
    }),
  amount: z.number().int().positive(),
});

/**
 * A charge to create as part of confirming this transaction. The school has a
 * rate for the fee but no Charge row for this student — bus, most often, whose
 * opt-in list is not imported. Confirming does both: create the charge, then
 * pay it, in one operation that undoes as a unit.
 *
 * At most one per student, so a line's placeholder `chargeId` is unambiguous.
 */
export const createChargeSchema = z.object({
  studentId: z.number().int().positive(),
  feeName: z.string().trim().min(1).max(60),
  amount: z.number().int().positive(),
  scope: z.enum(["term", "annual"]),
  academicTermId: z.number().int().positive().nullable(),
});

export const allocationFormSchema = z
  .object({
    bankTransactionId: z.number().int().positive(),
    lines: z.array(allocationLineSchema).min(1, "At least one allocation line is required"),
    createCharges: z.array(createChargeSchema).optional(),
  })
  .refine(
    (d) =>
      new Set((d.createCharges ?? []).map((c) => c.studentId)).size ===
      (d.createCharges ?? []).length,
    { message: "Only one new fee per student per transaction", path: ["createCharges"] },
  )
  .refine(
    (d) =>
      d.lines
        .filter((l) => l.chargeId === NEW_CHARGE_PLACEHOLDER_ID)
        .every((l) => (d.createCharges ?? []).some((c) => c.studentId === l.studentId)),
    {
      message: "A line refers to a new charge that is not being created",
      path: ["lines"],
    },
  )
  .refine(
    (d) =>
      (d.createCharges ?? []).every((c) =>
        d.lines.some(
          (l) => l.studentId === c.studentId && l.chargeId === NEW_CHARGE_PLACEHOLDER_ID,
        ),
      ),
    {
      // Otherwise a confirm could add a fee to a student's ledger that this
      // transaction never pays — a charge nobody asked for and nobody owes to.
      message: "Every new fee must be paid by a line on this transaction",
      path: ["createCharges"],
    },
  )
  .refine(
    (d) =>
      (d.createCharges ?? []).every((c) =>
        c.scope === "term" ? c.academicTermId !== null : c.academicTermId === null,
      ),
    { message: "A term fee needs a term; an annual fee must not have one", path: ["createCharges"] },
  );

export type AllocationLine = z.infer<typeof allocationLineSchema>;
export type CreateChargeInput = z.infer<typeof createChargeSchema>;
export type AllocationFormValues = z.infer<typeof allocationFormSchema>;

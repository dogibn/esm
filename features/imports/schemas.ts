import { z } from "zod";

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
  chargeId: z.number().int().positive(),
  amount: z.number().int().positive(),
});

export const allocationFormSchema = z.object({
  bankTransactionId: z.number().int().positive(),
  lines: z.array(allocationLineSchema).min(1, "At least one allocation line is required"),
});

export type AllocationLine = z.infer<typeof allocationLineSchema>;
export type AllocationFormValues = z.infer<typeof allocationFormSchema>;

import { z } from "zod";

// Postgres `date` columns round-trip as "YYYY-MM-DD" strings (schema.md
// § Dates vs timestamps), which is also what <Input type="date"> produces — so
// dates stay strings end to end and compare correctly with `<` / `>`.
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD");

const dateRange = <T extends { startDate: string; endDate: string }>(
  schema: z.ZodType<T>,
) =>
  schema.refine((d) => d.endDate > d.startDate, {
    message: "The end date must be after the start date.",
    path: ["endDate"],
  });

export const academicYearInputSchema = dateRange(
  z.object({
    // e.g. "2025-2026". UNIQUE in the DB.
    name: z.string().trim().min(1, "Name is required").max(50),
    startDate: isoDate,
    endDate: isoDate,
  }),
);

export type AcademicYearInput = z.infer<typeof academicYearInputSchema>;

export const academicTermCreateSchema = dateRange(
  z.object({
    academicYearId: z.coerce.number().int().positive(),
    // e.g. "Term 2". UNIQUE per year in the DB.
    name: z.string().trim().min(1, "Name is required").max(50),
    startDate: isoDate,
    endDate: isoDate,
  }),
);

export type AcademicTermCreateInput = z.infer<typeof academicTermCreateSchema>;

// A term cannot be moved to another year: its charges and club enrolments are
// scoped to it, and re-parenting would silently re-scope them. The year is
// fixed at creation, so the update schema simply has no field for it.
export const academicTermUpdateSchema = dateRange(
  z.object({
    name: z.string().trim().min(1, "Name is required").max(50),
    startDate: isoDate,
    endDate: isoDate,
  }),
);

export type AcademicTermUpdateInput = z.infer<typeof academicTermUpdateSchema>;

export const calendarIdParamSchema = z.coerce.number().int().positive();

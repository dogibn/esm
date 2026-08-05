import { z } from "zod";

// The page's two sections. The selection lives in the URL so a section is
// linkable and survives the year picker's navigation.
export const CLASSES_TABS = ["classes", "levels"] as const;

export type ClassesTab = (typeof CLASSES_TABS)[number];

// Which year's classes to show. Absent → the current year.
export const classesQuerySchema = z.object({
  year: z.coerce.number().int().positive().optional(),
  // A tab nobody recognises falls back to the default rather than erroring a
  // link that is otherwise perfectly usable.
  tab: z.enum(CLASSES_TABS).catch("classes"),
});

export type ClassesQuery = z.infer<typeof classesQuerySchema>;

// ─── Grade levels ─────────────────────────────────────────────────────────────

// `code` is the JSONB key tuition is looked up by (`fee_structures.data.by_grade`
// — domain_model.md § FeeStructure), so it is set once at creation and never
// edited: renaming it would silently detach every class at that level from its
// tuition rate. Only the display order stays editable.
export const gradeLevelCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(10),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});

export type GradeLevelCreateInput = z.infer<typeof gradeLevelCreateSchema>;

export const gradeLevelUpdateSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).max(1000),
});

export type GradeLevelUpdateInput = z.infer<typeof gradeLevelUpdateSchema>;

// ─── Classes ──────────────────────────────────────────────────────────────────

// Blank contact fields collapse to NULL rather than empty strings.
const optionalContact = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable(),
  );

const classFields = {
  name: z.string().trim().min(1, "Name is required").max(50),
  gradeLevelId: z.coerce.number().int().positive(),
  // NOT NULL in the schema, and the tracker shows it on every student.
  teacherName: z.string().trim().min(1, "Teacher name is required").max(120),
  teacherEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("Enter a valid email").max(255).nullable(),
  ),
  teacherPhone: optionalContact(50),
};

export const classCreateSchema = z.object({
  academicYearId: z.coerce.number().int().positive(),
  ...classFields,
});

export type ClassCreateInput = z.infer<typeof classCreateSchema>;

// A class belongs to the year it was created in. Enrolments are scoped by
// (student, year) and the class is the year's own object, so moving one between
// years would strand them — the update schema has no field for the year.
export const classUpdateSchema = z.object(classFields);

export type ClassUpdateInput = z.infer<typeof classUpdateSchema>;

export const classIdParamSchema = z.coerce.number().int().positive();

import { z } from "zod";

// The page's three sections. The selection lives in the URL so a section is
// linkable and survives a refresh.
export const FEES_TABS = ["tuition", "clubs", "others"] as const;

export type FeesTab = (typeof FEES_TABS)[number];

export const feesQuerySchema = z.object({
  // A tab nobody recognises falls back to the default rather than erroring a
  // link that is otherwise perfectly usable.
  tab: z.enum(FEES_TABS).catch("tuition"),
});

export type FeesQuery = z.infer<typeof feesQuerySchema>;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD");

// Money is integer MNT (schema.md § Money).
const mnt = z.coerce.number().int().nonnegative("An amount can't be negative");

/**
 * Publish a new rate for an existing school-wide fee.
 *
 * There is no update or delete schema, by design: a rate is never edited in
 * place. Publishing supersedes the row in force and inserts a new one
 * (domain_model.md § FeeStructure), so the validity chain stays the history of
 * what the school charged and when.
 *
 * Exactly one of `amount` (flat fee) or `byGrade` (per-grade fee) — which one
 * is decided by the shape of the fee being replaced, not by the caller.
 */
export const feeRatePublishSchema = z
  .object({
    feeName: z.string().trim().min(1, "Fee is required").max(60),
    effectiveFrom: isoDate,
    amount: mnt.nullish(),
    byGrade: z
      .array(
        z.object({
          code: z.string().trim().min(1).max(10),
          amount: mnt,
        }),
      )
      .max(50)
      .nullish(),
  })
  .refine(
    (d) =>
      (d.amount !== null && d.amount !== undefined) !==
      (d.byGrade !== null && d.byGrade !== undefined && d.byGrade.length > 0),
    {
      message: "Give either one amount or a per-grade table, not both.",
      path: ["amount"],
    },
  );

export type FeeRatePublishInput = z.infer<typeof feeRatePublishSchema>;

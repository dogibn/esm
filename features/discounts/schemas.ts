import { z } from "zod";

import { DISCOUNT_UNITS } from "./calc";

export { DISCOUNT_UNITS } from "./calc";
export type { DiscountUnit } from "./calc";

const optionalNote = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(500).nullable(),
);

// A discount-catalog entry. `value === null` means "custom" — the amount or
// percent is entered each time the discount is applied to a student.
export const discountTypeInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    unit: z.enum(DISCOUNT_UNITS),
    value: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.coerce.number().nonnegative("Value can't be negative").nullable(),
    ),
    note: optionalNote,
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.value === null || d.unit !== "percent" || d.value <= 100, {
    message: "A percent can't exceed 100.",
    path: ["value"],
  });

export type DiscountTypeInput = z.infer<typeof discountTypeInputSchema>;

export const discountTypeIdParamSchema = z.coerce.number().int().positive();

import { z } from "zod";

export const STATUS_FILTER_VALUES = ["unpaid", "partial", "paid"] as const;
export type StatusFilterValue = (typeof STATUS_FILTER_VALUES)[number];

export const studentListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).optional(),
  gradeLevelId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUS_FILTER_VALUES).optional(),
});

export type StudentListParams = z.infer<typeof studentListParamsSchema>;

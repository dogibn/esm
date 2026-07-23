import { z } from "zod";

export const TX_STATUS_VALUES = ["unmatched", "matched", "discarded"] as const;
export type TxStatusValue = (typeof TX_STATUS_VALUES)[number];

export const transactionListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).optional(),
  status: z.enum(TX_STATUS_VALUES).optional(),
});

export type TransactionListParams = z.infer<typeof transactionListParamsSchema>;

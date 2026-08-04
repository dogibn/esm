import { z } from "zod";

// The operation kinds the History view can filter by. Mirrors the
// operations_kind_check CHECK constraint and features/history/record.ts.
export const OPERATION_KIND_VALUES = [
  "confirm_match",
  "discard_transaction",
  "restore_transaction",
  "create_enrollment",
  "add_discount",
  "undo",
] as const;
export type OperationKindValue = (typeof OPERATION_KIND_VALUES)[number];

// Read filters for GET /api/history. Role scoping (admin sees all, accountant
// sees only their own) is NOT a query param — it is enforced server-side from
// the session (docs/history_and_reversibility.md § Who can see and undo what).
export const historyListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  kind: z.enum(OPERATION_KIND_VALUES).optional(),
  // Inclusive date bounds on the operation timestamp (YYYY-MM-DD, UTC day).
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type HistoryListParams = z.infer<typeof historyListParamsSchema>;

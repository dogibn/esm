import type { db } from "@/db/index";
import { operations, type Operation } from "@/db/schema";

// The set of operation kinds the log understands. Kept in sync with the
// CHECK constraint in db/schema.ts.
export type OperationKind =
  | "confirm_match"
  | "discard_transaction"
  | "restore_transaction"
  | "create_enrollment"
  | "add_discount"
  | "undo";

// A drizzle transaction handle (or the base client). recordOperation is always
// called inside the same transaction as the mutation it records, so the two
// commit or roll back together. Type-only import of `db` keeps this module free
// of the env-validating runtime import.
type DbClient =
  | typeof db
  | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export type RecordOperationInput = {
  actorUserId: string;
  kind: OperationKind;
  summary: string;
  bankTransactionId?: number | null;
  undoableUntil?: Date | null;
  details?: unknown;
};

/**
 * Append one row to the operations log. The single writer for the log — every
 * user-initiated mutation goes through here so nothing bypasses the audit
 * trail. Returns the inserted row (its `id` is the handle for undo).
 */
export async function recordOperation(
  client: DbClient,
  input: RecordOperationInput,
): Promise<Operation> {
  const [op] = await client
    .insert(operations)
    .values({
      actorUserId: input.actorUserId,
      kind: input.kind,
      summary: input.summary,
      bankTransactionId: input.bankTransactionId ?? null,
      undoableUntil: input.undoableUntil ?? null,
      details: input.details ?? null,
    })
    .returning();
  return op!;
}

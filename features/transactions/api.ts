import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/db/index";
import {
  bankTransactions,
  charges,
  operations,
  payments,
  students,
  type User,
} from "@/db/schema";
import { isUndoable } from "@/features/history";

import type { TransactionListParams } from "./schemas";
import type {
  TransactionListResponse,
  TransactionPaymentInfo,
  TransactionRow,
} from "./types";
import type { TxStatusValue } from "./schemas";

/**
 * Paginated bank-transaction history, newest first. The operational
 * counterpart of the tracking view (user_flows.md flow 3): what came in from
 * the bank, what it paid, and which rows still need matching.
 *
 * `user` accepted for future per-user scoping; not used yet.
 */
export async function listTransactions(
  user: User,
  params: TransactionListParams,
): Promise<TransactionListResponse> {
  const filters: SQL[] = [];
  if (params.status) {
    filters.push(eq(bankTransactions.status, params.status));
  }
  if (params.search) {
    const pattern = `%${params.search}%`;
    const searchClause = or(
      ilike(bankTransactions.senderName, pattern),
      ilike(bankTransactions.memo, pattern),
      ilike(bankTransactions.transactionId, pattern),
      ilike(bankTransactions.senderAccount, pattern),
    );
    if (searchClause) filters.push(searchClause);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [[totalRow], [unmatchedRow], pageRows] = await Promise.all([
    db.select({ value: count() }).from(bankTransactions).where(where),
    db
      .select({ value: count() })
      .from(bankTransactions)
      .where(eq(bankTransactions.status, "unmatched")),
    db
      .select({
        id: bankTransactions.id,
        transactionId: bankTransactions.transactionId,
        senderName: bankTransactions.senderName,
        senderAccount: bankTransactions.senderAccount,
        memo: bankTransactions.memo,
        amount: bankTransactions.amount,
        transactionAt: bankTransactions.transactionAt,
        status: bankTransactions.status,
      })
      .from(bankTransactions)
      .where(where)
      .orderBy(desc(bankTransactions.transactionAt), desc(bankTransactions.id))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
  ]);

  // One batch query for the page's payment details — no N+1.
  const matchedIds = pageRows.filter((r) => r.status === "matched").map((r) => r.id);
  const paymentRows =
    matchedIds.length > 0
      ? await db
          .select({
            bankTransactionId: payments.bankTransactionId,
            amount: payments.amount,
            feeName: charges.feeName,
            studentFirstName: students.firstName,
            studentLastName: students.lastName,
          })
          .from(payments)
          .innerJoin(charges, eq(charges.id, payments.chargeId))
          .innerJoin(students, eq(students.id, charges.studentId))
          .where(
            and(
              inArray(payments.bankTransactionId, matchedIds),
              isNull(payments.voidedAt),
            ),
          )
      : [];

  const paymentsByTx = new Map<number, TransactionPaymentInfo[]>();
  for (const p of paymentRows) {
    let arr = paymentsByTx.get(p.bankTransactionId);
    if (!arr) {
      arr = [];
      paymentsByTx.set(p.bankTransactionId, arr);
    }
    arr.push({
      feeName: p.feeName,
      studentFirstName: p.studentFirstName,
      studentLastName: p.studentLastName,
      amount: p.amount,
    });
  }

  // The active (not-yet-undone) confirm/discard operation per row on this page,
  // used to offer an Undo/Restore action. At most one such op per transaction.
  const pageIds = pageRows.map((r) => r.id);
  const opRows =
    pageIds.length > 0
      ? await db
          .select({
            id: operations.id,
            bankTransactionId: operations.bankTransactionId,
            actorUserId: operations.actorUserId,
            undoableUntil: operations.undoableUntil,
            undoneAt: operations.undoneAt,
          })
          .from(operations)
          .where(
            and(
              inArray(operations.bankTransactionId, pageIds),
              inArray(operations.kind, ["confirm_match", "discard_transaction"]),
              isNull(operations.undoneAt),
            ),
          )
      : [];
  const opByTx = new Map<number, (typeof opRows)[number]>();
  for (const o of opRows) {
    if (o.bankTransactionId !== null) opByTx.set(o.bankTransactionId, o);
  }

  const now = new Date();
  const rows: TransactionRow[] = pageRows.map((r) => {
    const op = opByTx.get(r.id);
    // Admins may undo anyone's action; accountants only their own.
    const mayUndo =
      op !== undefined &&
      isUndoable(op, now) &&
      (op.actorUserId === user.id || user.role === "admin");
    return {
      ...r,
      status: r.status as TxStatusValue,
      payments: paymentsByTx.get(r.id) ?? [],
      undoOperationId: mayUndo ? op.id : null,
    };
  });

  return {
    rows,
    page: params.page,
    pageSize: params.pageSize,
    total: totalRow?.value ?? 0,
    unmatchedTotal: unmatchedRow?.value ?? 0,
  };
}

import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";

import { db } from "@/db/index";
import {
  bankTransactions,
  charges,
  payments,
  students,
  type User,
} from "@/db/schema";

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
  _user: User,
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
          .where(inArray(payments.bankTransactionId, matchedIds))
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

  const rows: TransactionRow[] = pageRows.map((r) => ({
    ...r,
    status: r.status as TxStatusValue,
    payments: paymentsByTx.get(r.id) ?? [],
  }));

  return {
    rows,
    page: params.page,
    pageSize: params.pageSize,
    total: totalRow?.value ?? 0,
    unmatchedTotal: unmatchedRow?.value ?? 0,
  };
}

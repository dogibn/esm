import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/index";
import {
  bankTransactions,
  charges,
  gradeLevels,
  payments,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";

import { buildMatchingContext, match } from "./matching";
import { loadMatchingContextInput } from "./matching/load-context";
import type { BankTransactionInput } from "./matching";
import {
  filterNewTransactions,
  parseBankWorkbook,
} from "./parsing/bank-file";
import type { AllocationFormValues } from "./schemas";
import type {
  ConfirmResult,
  ParsedBankRow,
  ProposalListItem,
  ProposalListResponse,
  ReviewClass,
  ReviewOpenCharge,
  ReviewStudent,
  UploadResult,
} from "./types";

/**
 * Parse a bank file buffer, dedupe against existing transaction_ids, insert
 * the new rows as unmatched. The transaction_id UNIQUE constraint is the
 * idempotency mechanism — re-uploading the same file inserts zero new rows.
 *
 * Belt-and-suspenders dedupe: we pre-filter by querying existing IDs in a
 * single batch (so the response can accurately report skippedDuplicates) AND
 * use ON CONFLICT DO NOTHING on the insert (so a concurrent upload between
 * the pre-filter SELECT and the INSERT can't violate the UNIQUE constraint).
 *
 * Matching is intentionally NOT called from here. Persisted rows sit with
 * status='unmatched' until the separate matching step runs.
 */
export async function uploadBankTransactions(
  buffer: ArrayBuffer | Buffer,
): Promise<UploadResult> {
  const parsed = parseBankWorkbook(buffer);

  // Workbook-level failure (no sheets / read error / missing required col):
  // turn into a 400 with the parser's own message.
  const workbookError = parsed.errors.find((e) => e.rowIndex === -1);
  if (workbookError) {
    throw new HttpError(400, workbookError.reason);
  }

  const newRows = await dedupeAndInsert(parsed.rows);

  return {
    parsedCount: parsed.rows.length,
    insertedCount: newRows.length,
    skippedDuplicates: parsed.rows.length - newRows.length,
    skippedOutgoing: parsed.skippedOutgoing,
    inserted: newRows,
    parseErrors: parsed.errors,
  };
}

async function dedupeAndInsert(
  parsed: ParsedBankRow[],
): Promise<ParsedBankRow[]> {
  if (parsed.length === 0) return [];

  const ids = parsed.map((r) => r.transactionId);
  const existing = await db
    .select({ transactionId: bankTransactions.transactionId })
    .from(bankTransactions)
    .where(inArray(bankTransactions.transactionId, ids));
  const existingIds = new Set(existing.map((e) => e.transactionId));

  const toInsert = filterNewTransactions(parsed, existingIds);
  if (toInsert.length === 0) return [];

  // ON CONFLICT DO NOTHING guards against a concurrent upload inserting the
  // same transaction_id between the SELECT above and this INSERT. RETURNING
  // gives us the rows that actually landed, which is the authoritative
  // "inserted" count.
  const inserted = await db
    .insert(bankTransactions)
    .values(
      toInsert.map((r) => ({
        transactionId: r.transactionId,
        senderName: r.senderName,
        senderAccount: r.senderAccount,
        memo: r.memo,
        amount: r.amount,
        transactionAt: r.transactionAt,
        status: "unmatched" as const,
      })),
    )
    .onConflictDoNothing({ target: bankTransactions.transactionId })
    .returning({ transactionId: bankTransactions.transactionId });

  const insertedSet = new Set(inserted.map((i) => i.transactionId));
  return toInsert.filter((r) => insertedSet.has(r.transactionId));
}

/**
 * Read-only proposals endpoint. Loads every unmatched bank_transaction,
 * builds the matching context ONCE via the shared loader, and runs match()
 * per row. Recomputed on every call — MatchProposal / MatchResult are
 * ephemeral (domain_model.md), not persisted, not a table.
 *
 * `user` accepted for future per-user scoping; not used yet.
 *
 * Throws HttpError; doesn't catch.
 */
export async function listProposals(
  _user: User,
): Promise<ProposalListResponse> {
  let contextResult;
  try {
    contextResult = await loadMatchingContextInput();
  } catch (e) {
    throw new HttpError(500, (e as Error).message);
  }
  const { period, input } = contextResult;

  const unmatchedRows = await db
    .select({
      id: bankTransactions.id,
      transactionId: bankTransactions.transactionId,
      senderName: bankTransactions.senderName,
      senderAccount: bankTransactions.senderAccount,
      memo: bankTransactions.memo,
      amount: bankTransactions.amount,
      transactionAt: bankTransactions.transactionAt,
    })
    .from(bankTransactions)
    .where(eq(bankTransactions.status, "unmatched"))
    .orderBy(asc(bankTransactions.transactionAt));

  const context = buildMatchingContext(input);

  const proposals: ProposalListItem[] = unmatchedRows.map((row) => {
    const matchInput: BankTransactionInput = {
      memo: row.memo,
      amount: BigInt(row.amount),
      senderAccount: row.senderAccount,
      senderAccountName: row.senderName,
      // The parser skips outgoing rows at upload time, so anything in
      // bank_transactions is incoming. Setting explicitly for clarity.
      isOutgoing: false,
    };
    const result = match(matchInput, context);
    return {
      bankTransactionId: row.id,
      transactionPreview: {
        transactionId: row.transactionId,
        senderName: row.senderName,
        senderAccount: row.senderAccount,
        memo: row.memo,
        amount: row.amount,
        transactionAt: row.transactionAt,
      },
      result,
    };
  });

  // Build the review-form context from the same load-context output the
  // matcher consumed — no second source of charges/students.
  const enrollmentByStudent = new Map<
    number,
    { gradeName: string; gradeLevelCode: string }
  >();
  for (const e of input.enrollments) {
    enrollmentByStudent.set(e.studentId, {
      gradeName: e.gradeName,
      gradeLevelCode: e.gradeLevelCode,
    });
  }
  const reviewStudents: ReviewStudent[] = input.students.map((s) => {
    const enr = enrollmentByStudent.get(s.id);
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      gradeName: enr?.gradeName ?? null,
      gradeLevelCode: enr?.gradeLevelCode ?? null,
    };
  });

  const reviewOpenCharges: ReviewOpenCharge[] = input.openCharges.map((c) => ({
    id: c.id,
    studentId: c.studentId,
    feeName: c.feeName,
    grossAmount: Number(c.grossAmount),
    outstandingBalance: Number(c.outstandingBalance),
  }));

  const classSeen = new Set<string>();
  const reviewClasses: ReviewClass[] = [];
  for (const e of input.enrollments) {
    const key = `${e.gradeLevelCode}|${e.gradeName}`;
    if (classSeen.has(key)) continue;
    classSeen.add(key);
    reviewClasses.push({
      gradeName: e.gradeName,
      gradeLevelCode: e.gradeLevelCode,
    });
  }
  // Level order comes from grade_levels.sort_order ("2" < "10"; codes are
  // text, so comparing them directly would sort lexicographically). Letters
  // within a level sort alphabetically.
  const levelRows = await db
    .select({ code: gradeLevels.code, sortOrder: gradeLevels.sortOrder })
    .from(gradeLevels);
  const sortOrderByCode = new Map(levelRows.map((l) => [l.code, l.sortOrder]));
  reviewClasses.sort((a, b) => {
    const sa = sortOrderByCode.get(a.gradeLevelCode) ?? Number.MAX_SAFE_INTEGER;
    const sb = sortOrderByCode.get(b.gradeLevelCode) ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.gradeName.localeCompare(b.gradeName);
  });

  return {
    proposals,
    meta: {
      yearName: period.yearName,
      termName: period.termName,
      totalUnmatched: unmatchedRows.length,
    },
    context: {
      students: reviewStudents,
      openCharges: reviewOpenCharges,
      classes: reviewClasses,
    },
  };
}

/**
 * Confirm an allocation: create Payment rows and flip the bank_transaction to
 * 'matched', atomically. The full transaction amount must be allocated — there
 * is no credit-balance concept, so an unallocated remainder would silently
 * vanish. Over-paying an individual charge is allowed (its balance just goes
 * negative); under- or over-allocating the *transaction* is not.
 *
 * The status guard inside the DB transaction (UPDATE ... WHERE status =
 * 'unmatched' RETURNING) makes double-submits a 409, not duplicate payments.
 */
export async function confirmAllocation(
  user: User,
  input: AllocationFormValues,
): Promise<ConfirmResult> {
  const [tx] = await db
    .select({
      id: bankTransactions.id,
      amount: bankTransactions.amount,
      status: bankTransactions.status,
    })
    .from(bankTransactions)
    .where(eq(bankTransactions.id, input.bankTransactionId))
    .limit(1);
  if (!tx) throw new HttpError(404, "Bank transaction not found");
  if (tx.status !== "unmatched") {
    throw new HttpError(409, "This transaction has already been matched");
  }

  const chargeIds = input.lines.map((l) => l.chargeId);
  if (new Set(chargeIds).size !== chargeIds.length) {
    throw new HttpError(422, "The same charge appears on more than one line");
  }

  const chargeRows = await db
    .select({ id: charges.id, studentId: charges.studentId })
    .from(charges)
    .where(inArray(charges.id, chargeIds));
  const chargeById = new Map(chargeRows.map((c) => [c.id, c]));
  for (const line of input.lines) {
    const charge = chargeById.get(line.chargeId);
    if (!charge) throw new HttpError(422, `Charge ${line.chargeId} not found`);
    if (charge.studentId !== line.studentId) {
      throw new HttpError(
        422,
        "A selected charge does not belong to the selected student",
      );
    }
  }

  const allocated = input.lines.reduce((s, l) => s + l.amount, 0);
  if (allocated !== tx.amount) {
    throw new HttpError(
      422,
      `Allocation total (${allocated.toLocaleString("en-US")} MNT) must equal the transaction amount (${tx.amount.toLocaleString("en-US")} MNT)`,
    );
  }

  return db.transaction(async (dbTx) => {
    const claimed = await dbTx
      .update(bankTransactions)
      .set({ status: "matched" })
      .where(
        and(
          eq(bankTransactions.id, input.bankTransactionId),
          eq(bankTransactions.status, "unmatched"),
        ),
      )
      .returning({ id: bankTransactions.id });
    if (claimed.length === 0) {
      throw new HttpError(409, "This transaction has already been matched");
    }

    await dbTx.insert(payments).values(
      input.lines.map((l) => ({
        bankTransactionId: input.bankTransactionId,
        chargeId: l.chargeId,
        amount: l.amount,
        recordedBy: user.id,
      })),
    );

    return {
      bankTransactionId: input.bankTransactionId,
      paymentsCreated: input.lines.length,
      totalAllocated: allocated,
    };
  });
}

/**
 * Delete a non-student bank row (bank fee, refund, unrelated transfer).
 * Matched transactions are protected — both here and by the payments FK
 * (ON DELETE RESTRICT). Recovery path if deleted by mistake: re-upload the
 * bank file (transaction_id dedup re-inserts it).
 */
export async function deleteUnmatchedTransaction(id: number): Promise<void> {
  const deleted = await db
    .delete(bankTransactions)
    .where(
      and(eq(bankTransactions.id, id), eq(bankTransactions.status, "unmatched")),
    )
    .returning({ id: bankTransactions.id });
  if (deleted.length > 0) return;

  const [existing] = await db
    .select({ id: bankTransactions.id })
    .from(bankTransactions)
    .where(eq(bankTransactions.id, id))
    .limit(1);
  throw existing
    ? new HttpError(409, "Matched transactions cannot be deleted")
    : new HttpError(404, "Bank transaction not found");
}

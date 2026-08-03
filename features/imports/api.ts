import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/index";
import {
  bankTransactions,
  charges,
  gradeLevels,
  operations,
  payments,
  type User,
} from "@/db/schema";
import { HttpError } from "@/lib/errors";

import { isUndoable, recordOperation, undoableUntil } from "@/features/history";

import { insertCharge } from "@/features/students";

import { buildMatchingContext, match, NEW_CHARGE_PLACEHOLDER_ID } from "./matching";
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
  UndoResult,
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
 * `input.createCharges` lets a confirm bring a charge into existence and pay it
 * in the same breath — the bus case, where the school has a rate but no Charge
 * rows. Lines refer to such a charge by NEW_CHARGE_PLACEHOLDER_ID and are
 * rewritten to the real id once it is inserted. Creation, payment and status
 * flip share one DB transaction and one operations-log row, so undo reverses
 * the whole thing rather than leaving an orphan charge behind.
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

  const newCharges = input.createCharges ?? [];
  const existingIds = input.lines
    .map((l) => l.chargeId)
    .filter((id) => id !== NEW_CHARGE_PLACEHOLDER_ID);
  if (new Set(existingIds).size !== existingIds.length) {
    throw new HttpError(422, "The same charge appears on more than one line");
  }
  // A placeholder line resolves by student, so two of them for one student would
  // both land on the same new charge — the duplicate check above can't see that.
  const placeholderStudents = input.lines
    .filter((l) => l.chargeId === NEW_CHARGE_PLACEHOLDER_ID)
    .map((l) => l.studentId);
  if (new Set(placeholderStudents).size !== placeholderStudents.length) {
    throw new HttpError(422, "The same new fee appears on more than one line");
  }

  if (existingIds.length > 0) {
    const chargeRows = await db
      .select({ id: charges.id, studentId: charges.studentId })
      .from(charges)
      .where(inArray(charges.id, existingIds));
    const chargeById = new Map(chargeRows.map((c) => [c.id, c]));
    for (const line of input.lines) {
      if (line.chargeId === NEW_CHARGE_PLACEHOLDER_ID) continue;
      const charge = chargeById.get(line.chargeId);
      if (!charge) throw new HttpError(422, `Charge ${line.chargeId} not found`);
      if (charge.studentId !== line.studentId) {
        throw new HttpError(
          422,
          "A selected charge does not belong to the selected student",
        );
      }
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

    // Create the missing charges first so the payment lines can point at them.
    // insertCharge enforces the same rules as the student page (no tuition, no
    // duplicate fee in a period), and throwing rolls the whole confirm back.
    const newChargeIdByStudent = new Map<number, number>();
    for (const c of newCharges) {
      const { chargeId } = await insertCharge(dbTx, c.studentId, {
        feeName: c.feeName,
        amount: c.amount,
        scope: c.scope,
        ...(c.academicTermId !== null ? { academicTermId: c.academicTermId } : {}),
        notes: `Created from bank transaction #${input.bankTransactionId}`,
      });
      newChargeIdByStudent.set(c.studentId, chargeId);
    }

    const resolvedLines = input.lines.map((l) => {
      if (l.chargeId !== NEW_CHARGE_PLACEHOLDER_ID) return l;
      const chargeId = newChargeIdByStudent.get(l.studentId);
      if (chargeId === undefined) {
        throw new HttpError(422, "A line refers to a new charge that was not created");
      }
      return { ...l, chargeId };
    });

    // Record the confirm as an undoable operation, then stamp its id onto every
    // payment it creates. Undo voids exactly this operation's payments and
    // deletes the charges listed here.
    const createdChargeIds = [...newChargeIdByStudent.values()];
    const feeSummary =
      createdChargeIds.length > 0
        ? ` · created ${newCharges.map((c) => c.feeName).join(", ")}`
        : "";
    const op = await recordOperation(dbTx, {
      actorUserId: user.id,
      kind: "confirm_match",
      bankTransactionId: input.bankTransactionId,
      undoableUntil: undoableUntil(new Date()),
      summary: `Matched transaction #${input.bankTransactionId} · ${resolvedLines.length} payment(s) · ${allocated.toLocaleString("en-US")} MNT${feeSummary}`,
      details: { lines: resolvedLines, createdChargeIds },
    });

    await dbTx.insert(payments).values(
      resolvedLines.map((l) => ({
        bankTransactionId: input.bankTransactionId,
        chargeId: l.chargeId,
        amount: l.amount,
        recordedBy: user.id,
        operationId: op.id,
      })),
    );

    return {
      bankTransactionId: input.bankTransactionId,
      paymentsCreated: resolvedLines.length,
      totalAllocated: allocated,
      chargesCreated: createdChargeIds.length,
    };
  });
}

/**
 * Discard a non-student bank row (bank fee, refund, unrelated transfer). This
 * is a SOFT delete: the row is kept with status 'discarded' so the action is
 * reversible (undo the discard operation) and re-uploads still dedup on
 * transaction_id. Only unmatched rows can be discarded.
 */
export async function discardUnmatchedTransaction(
  user: User,
  id: number,
): Promise<void> {
  await db.transaction(async (dbTx) => {
    const claimed = await dbTx
      .update(bankTransactions)
      .set({
        status: "discarded",
        discardedAt: new Date(),
        discardedByUserId: user.id,
      })
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.status, "unmatched"),
        ),
      )
      .returning({ id: bankTransactions.id });

    if (claimed.length === 0) {
      const [existing] = await dbTx
        .select({ id: bankTransactions.id })
        .from(bankTransactions)
        .where(eq(bankTransactions.id, id))
        .limit(1);
      throw existing
        ? new HttpError(409, "Only unmatched transactions can be discarded")
        : new HttpError(404, "Bank transaction not found");
    }

    await recordOperation(dbTx, {
      actorUserId: user.id,
      kind: "discard_transaction",
      bankTransactionId: id,
      undoableUntil: undoableUntil(new Date()),
      summary: `Discarded transaction #${id} (not a student payment)`,
    });
  });
}

/**
 * The charge ids a `confirm_match` operation created, read back out of its
 * details JSON. Written by confirmAllocation; anything else (an older row from
 * before charges could be created, a hand-edited value) yields an empty list
 * rather than throwing — undo must still work on historic operations.
 */
export function confirmCreatedChargeIds(details: unknown): number[] {
  if (!details || typeof details !== "object") return [];
  const raw = (details as { createdChargeIds?: unknown }).createdChargeIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is number => typeof v === "number" && Number.isInteger(v));
}

/**
 * Undo a previously-recorded operation, if the actor is allowed (its owner, or
 * any admin) and it is still inside its window and not already undone. Inverts
 * the operation by kind and writes a companion `undo` operation. See
 * docs/history_and_reversibility.md.
 */
export async function undoOperation(
  user: User,
  operationId: number,
): Promise<UndoResult> {
  const [op] = await db
    .select()
    .from(operations)
    .where(eq(operations.id, operationId))
    .limit(1);
  if (!op) throw new HttpError(404, "Operation not found");

  if (op.actorUserId !== user.id && user.role !== "admin") {
    throw new HttpError(403, "You can only undo your own actions");
  }
  if (op.undoableUntil === null) {
    throw new HttpError(400, "This action cannot be undone");
  }
  if (op.undoneAt !== null) {
    throw new HttpError(409, "This action has already been undone");
  }
  if (!isUndoable(op, new Date())) {
    throw new HttpError(400, "The undo window for this action has passed");
  }

  return db.transaction(async (dbTx) => {
    if (op.kind === "confirm_match") {
      if (op.bankTransactionId === null) {
        throw new HttpError(500, "Confirm operation is missing its transaction link");
      }
      // Void exactly this operation's live payments, then un-match the row.
      await dbTx
        .update(payments)
        .set({ voidedAt: new Date(), voidedByUserId: user.id })
        .where(and(eq(payments.operationId, op.id), isNull(payments.voidedAt)));
      await dbTx
        .update(bankTransactions)
        .set({ status: "unmatched" })
        .where(
          and(
            eq(bankTransactions.id, op.bankTransactionId),
            eq(bankTransactions.status, "matched"),
          ),
        );
      // A confirm that created charges owns them: undoing it must not leave a
      // fee on a student's ledger that nobody asked for. Charges that picked up
      // a payment from some *other* operation in the meantime are left alone —
      // deleting them would take that payment's target with them.
      const createdChargeIds = confirmCreatedChargeIds(op.details);
      if (createdChargeIds.length > 0) {
        const stillReferenced = await dbTx
          .select({ chargeId: payments.chargeId })
          .from(payments)
          .where(
            and(
              inArray(payments.chargeId, createdChargeIds),
              isNull(payments.voidedAt),
            ),
          );
        const keep = new Set(stillReferenced.map((p) => p.chargeId));
        const deletable = createdChargeIds.filter((id) => !keep.has(id));
        if (deletable.length > 0) {
          await dbTx.delete(charges).where(inArray(charges.id, deletable));
        }
      }
    } else if (op.kind === "discard_transaction") {
      if (op.bankTransactionId === null) {
        throw new HttpError(500, "Discard operation is missing its transaction link");
      }
      await dbTx
        .update(bankTransactions)
        .set({ status: "unmatched", discardedAt: null, discardedByUserId: null })
        .where(
          and(
            eq(bankTransactions.id, op.bankTransactionId),
            eq(bankTransactions.status, "discarded"),
          ),
        );
    } else {
      throw new HttpError(400, "This kind of action cannot be undone");
    }

    const undoOp = await recordOperation(dbTx, {
      actorUserId: user.id,
      kind: "undo",
      bankTransactionId: op.bankTransactionId,
      undoableUntil: null, // an undo is not itself undoable (no redo in v2)
      summary: `Reverted operation #${op.id} (${op.kind})`,
      details: { undoneOperationId: op.id },
    });

    await dbTx
      .update(operations)
      .set({
        undoneAt: new Date(),
        undoneByUserId: user.id,
        undoOperationId: undoOp.id,
      })
      .where(eq(operations.id, op.id));

    return {
      operationId: op.id,
      kind: op.kind,
      undoOperationId: undoOp.id,
      bankTransactionId: op.bankTransactionId,
    };
  });
}

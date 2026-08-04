import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";

import { db } from "@/db/index";
import { operations, users, type User } from "@/db/schema";

import { isUndoable } from "./window";
import type { HistoryListParams } from "./schemas";
import type { HistoryListResponse, HistoryRow } from "./types";
import type { OperationKindValue } from "./schemas";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Paginated activity log, newest first. The read side of the operations log
 * (docs/history_and_reversibility.md, Phase 3).
 *
 * Visibility is role-based and enforced HERE, from the session — never trusted
 * from the client: an admin sees every user's operations; an accountant is
 * scoped to their own. The same rule governs whether an Undo action is offered
 * per row (owner or admin, and still in window).
 */
export async function listHistory(
  user: User,
  params: HistoryListParams,
): Promise<HistoryListResponse> {
  const scopedToSelf = user.role !== "admin";

  const filters: SQL[] = [];
  // Server-side role scoping. An accountant can only ever read their own rows.
  if (scopedToSelf) {
    filters.push(eq(operations.actorUserId, user.id));
  }
  if (params.kind) {
    filters.push(eq(operations.kind, params.kind));
  }
  if (params.from) {
    filters.push(gte(operations.createdAt, new Date(`${params.from}T00:00:00.000Z`)));
  }
  if (params.to) {
    // Inclusive of the `to` day: everything strictly before the next UTC day.
    const next = new Date(new Date(`${params.to}T00:00:00.000Z`).getTime() + MS_PER_DAY);
    filters.push(lt(operations.createdAt, next));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [[totalRow], pageRows] = await Promise.all([
    db.select({ value: count() }).from(operations).where(where),
    db
      .select({
        id: operations.id,
        kind: operations.kind,
        summary: operations.summary,
        actorEmail: users.email,
        actorUserId: operations.actorUserId,
        createdAt: operations.createdAt,
        undoableUntil: operations.undoableUntil,
        undoneAt: operations.undoneAt,
        bankTransactionId: operations.bankTransactionId,
      })
      .from(operations)
      .innerJoin(users, eq(users.id, operations.actorUserId))
      .where(where)
      .orderBy(desc(operations.createdAt), desc(operations.id))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
  ]);

  const now = new Date();
  const rows: HistoryRow[] = pageRows.map((r) => {
    const mayUndo =
      isUndoable(r, now) && (r.actorUserId === user.id || user.role === "admin");
    return {
      id: r.id,
      kind: r.kind as OperationKindValue,
      summary: r.summary,
      actorEmail: r.actorEmail,
      createdAt: r.createdAt,
      undoableUntil: r.undoableUntil,
      undoneAt: r.undoneAt,
      bankTransactionId: r.bankTransactionId,
      undoOperationId: mayUndo ? r.id : null,
    };
  });

  return {
    rows,
    page: params.page,
    pageSize: params.pageSize,
    total: totalRow?.value ?? 0,
    scopedToSelf,
  };
}

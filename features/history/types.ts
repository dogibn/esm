import type { OperationKindValue } from "./schemas";

// One row in the History view: an operations-log entry with its actor resolved
// to an email and a computed "can the current viewer undo this right now?".
export type HistoryRow = {
  id: number;
  kind: OperationKindValue;
  summary: string;
  actorEmail: string;
  createdAt: Date;
  undoableUntil: Date | null;
  undoneAt: Date | null;
  bankTransactionId: number | null;
  // Non-null only when the operation is still undoable AND the current user is
  // allowed to undo it (its owner, or an admin). The UI shows an Undo action iff
  // this is set. Same gate as the transactions view.
  undoOperationId: number | null;
};

export type HistoryListResponse = {
  rows: HistoryRow[];
  page: number;
  pageSize: number;
  total: number;
  // Whether the viewer is scoped to their own operations (accountant) or sees
  // everyone's (admin) — the UI reflects this, it does not decide it.
  scopedToSelf: boolean;
};

export type HistoryRowWire = Omit<
  HistoryRow,
  "createdAt" | "undoableUntil" | "undoneAt"
> & {
  createdAt: string; // ISO 8601
  undoableUntil: string | null;
  undoneAt: string | null;
};

export type HistoryListResponseWire = Omit<HistoryListResponse, "rows"> & {
  rows: HistoryRowWire[];
};

export function historyListResponseToWire(
  r: HistoryListResponse,
): HistoryListResponseWire {
  return {
    ...r,
    rows: r.rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      undoableUntil: row.undoableUntil ? row.undoableUntil.toISOString() : null,
      undoneAt: row.undoneAt ? row.undoneAt.toISOString() : null,
    })),
  };
}

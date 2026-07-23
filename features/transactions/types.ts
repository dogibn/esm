import type { TxStatusValue } from "./schemas";

// What a matched transaction paid, for display: "tuition — Baatar Adiya".
export type TransactionPaymentInfo = {
  feeName: string;
  studentFirstName: string;
  studentLastName: string;
  amount: number;
};

// Service-side row (Date kept as Date). The HTTP boundary serializes via
// TransactionRowWire below.
export type TransactionRow = {
  id: number;
  transactionId: string;
  senderName: string | null;
  senderAccount: string | null;
  memo: string | null;
  amount: number;
  transactionAt: Date;
  status: TxStatusValue;
  payments: TransactionPaymentInfo[];
  // The operation to undo for this row (confirm for matched, discard for
  // discarded), set only when the current user may undo it and it is still in
  // window. null otherwise — the UI shows the Undo/Restore action iff non-null.
  undoOperationId: number | null;
};

export type TransactionListResponse = {
  rows: TransactionRow[];
  page: number;
  pageSize: number;
  total: number;
  unmatchedTotal: number;
};

export type TransactionRowWire = Omit<TransactionRow, "transactionAt"> & {
  transactionAt: string; // ISO 8601
};

export type TransactionListResponseWire = Omit<TransactionListResponse, "rows"> & {
  rows: TransactionRowWire[];
};

export function transactionListResponseToWire(
  r: TransactionListResponse,
): TransactionListResponseWire {
  return {
    ...r,
    rows: r.rows.map((row) => ({
      ...row,
      transactionAt: row.transactionAt.toISOString(),
    })),
  };
}

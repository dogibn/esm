export const strings = {
  title: "Transaction history",
  description:
    "Everything imported from the bank, newest first. Unmatched rows still need review on the Imports page.",
  unmatchedSummary: (n: number) =>
    n === 0
      ? "No unmatched transactions."
      : n === 1
        ? "1 unmatched transaction needs review."
        : `${n} unmatched transactions need review.`,
  reviewLink: "Review on Imports page",
  search: {
    placeholder: "Search sender, memo, account, or transaction ID…",
  },
  filters: {
    statusLabel: "Status",
    allStatuses: "All",
  },
  status: {
    matched: "Matched",
    unmatched: "Unmatched",
  } as Record<"matched" | "unmatched", string>,
  columns: {
    date: "Date",
    sender: "Sender",
    memo: "Memo",
    amount: "Amount (MNT)",
    status: "Status",
    paidFor: "Paid for",
  },
  paymentLine: (feeName: string, student: string, amount: string) =>
    `${feeName} — ${student} (${amount} MNT)`,
  loading: "Loading…",
  error: "Failed to load transactions.",
  empty: "No transactions found.",
  emptyFiltered: "No transactions match the current filters.",
  pagination: {
    rowCount: (shown: number, total: number) =>
      `Showing ${shown} of ${total} transactions`,
    pageIndicator: (page: number, totalPages: number) =>
      `Page ${page} of ${totalPages}`,
    prev: "Previous",
    next: "Next",
  },
};

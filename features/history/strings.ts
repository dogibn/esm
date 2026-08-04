import type { OperationKindValue } from "./schemas";

export const strings = {
  title: "History",
  description:
    "Every recorded action, newest first. Reversible ones can be undone here while inside their window.",
  scope: {
    self: "Showing your own actions.",
    all: "Showing all users' actions.",
  },
  filters: {
    kindLabel: "Action",
    allKinds: "All",
    from: "From",
    to: "To",
    clear: "Clear filters",
  },
  // Human labels for each operation kind.
  kinds: {
    confirm_match: "Matched",
    discard_transaction: "Discarded",
    restore_transaction: "Restored",
    create_enrollment: "New contract",
    add_discount: "Discount added",
    undo: "Undo",
  } as Record<OperationKindValue, string>,
  columns: {
    when: "When",
    action: "Action",
    summary: "Details",
    actor: "By",
    status: "",
    undo: "",
  },
  statusUndone: "Undone",
  statusExpired: "Window passed",
  actions: {
    undo: "Undo",
    pending: "…",
    error: "Could not undo. It may be past its window or already undone.",
  },
  loading: "Loading…",
  error: "Failed to load history.",
  empty: "No recorded actions yet.",
  emptyFiltered: "No actions match the current filters.",
  pagination: {
    rowCount: (shown: number, total: number) =>
      `Showing ${shown} of ${total} actions`,
    pageIndicator: (page: number, totalPages: number) =>
      `Page ${page} of ${totalPages}`,
    prev: "Previous",
    next: "Next",
  },
};

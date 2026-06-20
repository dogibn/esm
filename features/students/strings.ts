export const strings = {
  title: "Students",
  search: {
    placeholder: "Search by name, ID, or contact…",
    clear: "Clear search",
  },
  filters: {
    gradeLevelLabel: "Grade level",
    gradeLabel: "Class",
    statusLabel: "Status",
    allGradeLevels: "All grade levels",
    allGrades: "All classes",
    allStatuses: "All statuses",
    clearAll: "Clear filters",
    activeCount: (n: number) => (n === 1 ? "1 filter active" : `${n} filters active`),
  },
  columns: {
    surname: "Surname",
    firstName: "First name",
    studentCode: "ID",
    class: "Class",
    tuition: "Tuition",
    bus: "Bus",
    registration: "Registration",
    clubs: "Clubs",
    total: "Total",
  },
  status: {
    paid: "Paid",
    partial: "Partial",
    unpaid: "Unpaid",
    none: "—",
  },
  empty: "No students.",
  emptyFiltered: "No students match the current filters.",
  loading: "Loading…",
  error: "Failed to load students.",
  pagination: {
    prev: "Previous",
    next: "Next",
    pageIndicator: (page: number, totalPages: number) =>
      `Page ${page} of ${totalPages}`,
    rowCount: (shown: number, total: number) =>
      `Showing ${shown} of ${total}`,
  },
};

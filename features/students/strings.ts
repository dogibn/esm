export const strings = {
  title: "Student Payment Tracker",
  subtitle: "Balances by fee for the current academic year and term.",
  summary: {
    totalDue: "Total amount due",
    totalCollected: "Total collected",
    students: (n: number) => (n === 1 ? "1 student" : `${n} students`),
    collectionRate: (pct: string) => `${pct}% collection rate`,
  },
  recordCount: (n: number) => (n === 1 ? "1 record" : `${n} records`),
  search: {
    placeholder: "Search by name, ID, or contact…",
    clear: "Clear search",
  },
  filters: {
    label: "Filters:",
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
  detail: {
    back: "Back to students",
    studentId: (code: string) => `Student ID: ${code}`,
    categoryNew: "New student",
    categoryReturning: "Returning student",
    tabs: {
      fees: "Fees overview",
      history: "Payment history",
    },
    personal: {
      title: "Personal information",
      class: "Class",
      teacher: "Teacher",
      parentEmail: "Parent email",
      parentPhone: "Parent phone",
      contract: "Tuition contract",
      empty: "—",
    },
    tuition: {
      title: "Tuition breakdown",
      base: "Base tuition",
      net: "Net tuition",
      noCharge: "No tuition charge for this year.",
    },
    annual: {
      title: "One-time & annual fees",
      empty: "No annual charges for this year.",
    },
    term: {
      title: "Term-based fees",
      feeType: "Fee",
      current: "Current",
      total: "Total",
      empty: "No term-based charges for this year.",
      notEnrolled: "—",
    },
    columns: {
      fee: "Fee",
      category: "Category",
      amount: "Amount",
      status: "Status",
      paid: "Paid",
      balance: "Balance",
      date: "Date",
      reference: "Reference",
      sender: "Sender",
      memo: "Memo",
    },
    totals: {
      label: "Total",
      charged: "Charged",
      paid: "Paid",
      balance: "Balance",
    },
    history: {
      empty: "No payments recorded yet.",
      subtitle: (name: string) => `Recorded payments for ${name}.`,
    },
    // Human labels for the raw fee_name values. Falls back to a prettified
    // version of the stored name (club fees carry their own display names).
    feeLabel: (feeName: string): string => {
      const known: Record<string, string> = {
        tuition: "Tuition",
        registration: "Registration",
        bus_fee: "Bus fee",
        bus: "Bus fee",
      };
      return (
        known[feeName] ??
        feeName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      );
    },
  },
};

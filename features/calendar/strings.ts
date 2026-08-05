export const strings = {
  page: {
    title: "Academic calendar",
    description:
      "Academic years and their terms. The current year and term scope every other view in the app.",
    adminHint:
      "Academic years and their terms. Only an admin can change them.",
  },
  empty: "No academic years yet.",
  noTerms: "No terms yet.",
  current: "Current",
  currentYearHint: (term: string) => `Current term: ${term}`,
  dateRange: (start: string, end: string) => `${start} – ${end}`,
  columns: {
    term: "Term",
    starts: "Starts",
    ends: "Ends",
  },
  usage: {
    // What already points at a row — shown so it is obvious why a year or term
    // can't be removed.
    year: (u: { terms: number; grades: number; enrollments: number; charges: number }) =>
      [
        plural(u.terms, "term", "terms"),
        plural(u.grades, "class", "classes"),
        plural(u.enrollments, "enrolment", "enrolments"),
        plural(u.charges, "charge", "charges"),
      ]
        .filter((part) => part !== null)
        .join(" · "),
    term: (u: { charges: number; clubEnrollments: number; feeStructures: number }) =>
      [
        plural(u.charges, "charge", "charges"),
        plural(u.clubEnrollments, "club enrolment", "club enrolments"),
        plural(u.feeStructures, "club fee", "club fees"),
      ]
        .filter((part) => part !== null)
        .join(" · "),
    unused: "Not used yet",
  },
  actions: {
    addYear: "Add year",
    addTerm: "Add term",
    edit: "Edit",
    editYear: (name: string) => `Edit ${name}`,
    editTerm: (name: string) => `Edit ${name}`,
    setCurrent: "Set as current",
    setCurrentYear: (name: string) => `Make ${name} the current year`,
    setCurrentTerm: (name: string) => `Make ${name} the current term`,
    delete: "Delete",
    deleteYear: (name: string) => `Delete ${name}`,
    deleteTerm: (name: string) => `Delete ${name}`,
  },
  form: {
    addYearTitle: "Add academic year",
    editYearTitle: "Edit academic year",
    addTermTitle: "Add term",
    editTermTitle: "Edit term",
    yearName: "Name",
    yearNamePlaceholder: "e.g. 2026-2027",
    termName: "Name",
    termNamePlaceholder: "e.g. Term 1",
    startDate: "Starts",
    endDate: "Ends",
    inYear: (name: string) => `In ${name}`,
    yearHint:
      "A year's dates can't overlap another year. Its terms have to fall inside them.",
    termHint: "Terms in the same year can't overlap.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    error: "Could not save. Please try again.",
  },
  setCurrent: {
    yearTitle: "Change the current academic year?",
    yearBody: (year: string) =>
      `Every view in the app — the tracker, imports, and new charges — will be scoped to ${year}.`,
    yearTermNote: (term: string) =>
      `${term} becomes the current term, so the year and term always agree.`,
    termTitle: "Change the current term?",
    termBody: (term: string) =>
      `Term-scoped fees — bus and clubs — will be read and created against ${term}.`,
    confirm: "Set as current",
    confirming: "Setting…",
    cancel: "Cancel",
    error: "Could not change the current selection. Please try again.",
  },
  remove: {
    yearTitle: "Delete this academic year?",
    termTitle: "Delete this term?",
    body: (name: string) => `${name} will be removed. This can't be undone.`,
    blockedHint: "In use — delete is unavailable.",
    confirm: "Delete",
    deleting: "Deleting…",
    cancel: "Cancel",
    error: "Could not delete. Please try again.",
  },
  toasts: {
    yearCreated: "Academic year added.",
    yearUpdated: "Academic year updated.",
    yearDeleted: "Academic year deleted.",
    termCreated: "Term added.",
    termUpdated: "Term updated.",
    termDeleted: "Term deleted.",
    currentYearSet: (year: string, term: string) =>
      `${year} is now current, on ${term}.`,
    currentTermSet: (term: string) => `${term} is now the current term.`,
  },
};

function plural(n: number, one: string, many: string): string | null {
  if (n === 0) return null;
  return `${n} ${n === 1 ? one : many}`;
}

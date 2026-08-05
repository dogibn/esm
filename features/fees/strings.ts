export const strings = {
  page: {
    title: "Fee rates",
    description:
      "What the school charges, and what it charged before. A new rate never edits the old one — it supersedes it.",
    adminHint: "What the school charges, and what it charged before. Only an admin can publish a new rate.",
  },
  tabs: {
    label: "Fee sections",
    tuition: "Tuition",
    clubs: "Clubs",
    others: "Others",
  },
  schoolFees: {
    title: "School-wide fees",
    description: "Tuition, registration, and bus. The rate in force plus its history.",
    empty: "No school-wide fees are loaded yet.",
  },
  tuition: {
    empty: "No tuition rate is loaded yet.",
  },
  others: {
    title: "Other fees",
    description:
      "Every school-wide fee apart from tuition — registration, bus, and anything else the import loads. Expand a fee for its per-grade amounts and earlier rates.",
    empty: "No other school-wide fees are loaded yet.",
    columns: {
      name: "Fee",
      amount: "Amount",
      from: "Applies from",
    },
    perGrade: "Per grade level",
    noAmount: "—",
    expand: (fee: string) => `Show details for ${fee}`,
  },
  current: "In force",
  from: (date: string) => `From ${date}`,
  replacedOn: (date: string) => `Replaced ${date}`,
  noCurrent: "No rate in force.",
  unknownShape: "This rate is stored in a shape the app doesn't recognise.",
  history: {
    title: "Earlier rates",
    empty: "No earlier rates.",
    toggleShow: "Show history",
    toggleHide: "Hide history",
  },
  columns: {
    level: "Grade level",
    amount: "Amount",
    from: "From",
    until: "Replaced",
    club: "Club",
    teacher: "Teacher",
    schedule: "Schedule",
  },
  clubs: {
    title: "Club fees",
    description:
      "Priced per term and loaded by the term-start import from esmlh.edu.mn. Read-only here — editing them would be overwritten by the next import.",
    empty: "No club fees loaded yet.",
    termLabel: (term: string, year: string) => `${term} · ${year}`,
    current: "Current term",
    count: (n: number) => (n === 1 ? "1 club" : `${n} clubs`),
  },
  publish: {
    action: "Publish new rate",
    actionFor: (fee: string) => `Publish a new ${fee} rate`,
    title: (fee: string) => `New ${fee} rate`,
    effectiveFrom: "Applies from",
    amount: "Amount (₮)",
    perLevel: "Amount per grade level (₮)",
    // The two things an admin must understand before doing this.
    supersedeNote:
      "The current rate is kept and marked as replaced — nothing is overwritten.",
    chargesNote:
      "Existing charges keep the amount they were created with. A new rate only reaches charges created after it.",
    immediateNote:
      "The new rate applies as soon as it's published, so the date can't be in the future.",
    copyCurrent: "Start from the current rate",
    save: "Publish",
    saving: "Publishing…",
    cancel: "Cancel",
    error: "Could not publish. Please try again.",
  },
  toasts: {
    published: (fee: string) => `New ${fee} rate published.`,
  },
};

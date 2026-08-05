export const strings = {
  button: {
    label: "New contract",
    newStudent: "New student",
    newStudentHint: "Add someone new to ESM",
    existingStudent: "Returning student",
    existingStudentHint: "Enrol an existing student",
  },
  page: {
    title: "New tuition contract",
    description:
      "Enrol a student for the current academic year and record their tuition contract.",
    back: "Back to students",
    forYear: (name: string) => `Academic year ${name}`,
  },
  mode: {
    label: "Who is this contract for?",
    new: "New student",
    existing: "Returning student",
  },
  personal: {
    title: "Personal information",
    description:
      "For a new student, fill these in. For a returning student, pick them below and edit if needed.",
    pickLabel: "Find existing student",
    pickPlaceholder: "Search by name or ID…",
    pickNoMatch: "No students match.",
    pickNotSelected: "Select a student",
    alreadyEnrolled:
      "This student is already enrolled for the current year. Enrolling again is blocked.",
    studentId: "Student ID",
    studentIdHint: "School-assigned ID (esmlh.edu.mn). Must be unique.",
    firstName: "First name",
    lastName: "Surname",
    parentEmail: "Parent email",
    parentPhone: "Parent phone",
    optional: "Optional",
  },
  contract: {
    title: "Contract & tuition",
    description:
      "The class sets the base tuition; adjust it and add discounts as needed.",
    class: "Class",
    classPlaceholder: "Choose a class",
    category: "Student status",
    categoryNew: "New to ESM (adds registration fee)",
    categoryOld: "Returning (no registration fee)",
    contractId: "Tuition contract ID",
    contractIdHint: "Reference to the signed paper contract. Optional.",
    studentCode: "Student code",
    studentCodeHint: "Code from the tuition document. Optional.",
    baseTuition: "Base tuition (MNT)",
    baseTuitionHint: "Prefilled from the class's grade level. Editable.",
    registration: "Registration fee (MNT)",
    registrationHint: "Charged once for new students. Set to 0 to skip.",
  },
  discounts: {
    title: "Discounts",
    description:
      "Tuition discounts from the catalog. They apply top to bottom, each onto the running total.",
    choose: "Choose a discount",
    customValueMnt: "Amount (₮)",
    customValuePercent: "Percent (%)",
    notes: "Note",
    notesPlaceholder: "Why this discount applies (optional)",
    amountLabel: "Discount amount",
    // Placeholder until the row resolves to an amount (no discount chosen, or
    // a custom discount with no value yet).
    amountPending: "—",
    add: "Add discount",
    remove: "Remove",
    moveUp: "Move up",
    moveDown: "Move down",
    empty: "No discounts.",
    noCatalog: "No discounts in the catalog yet. An admin can add them.",
    sibling: "Sibling",
    // Short enough for the inline sibling column in the discount row.
    siblingPlaceholder: "Link sibling",
    siblingSearch: "Search by name or ID…",
    siblingNoMatch: "No students match.",
    siblingClear: "No sibling linked",
    // How a discount reads: "10%" or "300,000₮".
    expressed: (unit: "mnt" | "percent", value: number): string =>
      unit === "percent"
        ? `${value}%`
        : `${value.toLocaleString("en-US")}₮`,
  },
  summary: {
    title: "Summary",
    baseTuition: "Base tuition",
    discountTotal: "Discounts",
    netTuition: "Net tuition",
    registration: "Registration",
    grandTotal: "Total charges",
  },
  actions: {
    cancel: "Cancel",
    submit: "Create contract",
    submitting: "Creating…",
  },
  errors: {
    noCurrentYear: "No current academic year is set.",
    classNotInYear: "That class does not belong to the current academic year.",
    duplicateStudentId: (id: string) =>
      `A student with ID "${id}" already exists. Use the returning-student option instead.`,
    studentNotFound: "The selected student could not be found.",
    alreadyEnrolled:
      "This student is already enrolled for the current academic year.",
    generic: "Could not create the contract. Please try again.",
  },
};

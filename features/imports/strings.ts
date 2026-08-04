export const strings = {
  pageTitle: "Bank Imports",
  pageDescription:
    "Upload bank statements, then review and confirm proposed payment matches.",
  title: "Bank transaction import",
  description:
    "Upload a bank Excel/CSV export. Parsed rows are stored as unmatched bank transactions. Matching is a separate step.",
  dropzone: {
    label: "Drop a bank file here or click to choose",
    hint: "Accepts .xlsx, .xls, .csv (max 25 MB)",
    chooseFile: "Choose file",
    fileChosen: (name: string) => `Selected: ${name}`,
    upload: "Upload",
    uploading: "Uploading…",
    cancel: "Choose a different file",
  },
  result: {
    heading: "Upload summary",
    parsedCount: (n: number) => `${n} parsed`,
    insertedCount: (n: number) => `${n} inserted`,
    skippedDuplicates: (n: number) => `${n} duplicate(s) skipped`,
    skippedOutgoing: (n: number) => `${n} outgoing row(s) skipped`,
    parseErrors: (n: number) => `${n} parse error(s)`,
    insertedHeading: "Inserted rows",
    parseErrorsHeading: "Parse errors",
    noInserted: "No new rows were inserted.",
    noParseErrors: "No parse errors.",
    parseErrorRow: (rowIndex: number, reason: string) =>
      rowIndex < 0 ? reason : `Row ${rowIndex + 1}: ${reason}`,
  },
  columns: {
    transactionId: "Transaction ID",
    senderName: "Sender name",
    senderAccount: "Sender account",
    memo: "Memo",
    amount: "Amount (MNT)",
    transactionAt: "Date",
  },
  errors: {
    noFile: "Please choose a file first.",
    uploadFailed: "Upload failed.",
  },

  toasts: {
    paymentRecorded: "Payment recorded.",
    transactionDiscarded: "Transaction discarded.",
    imported: (n: number) =>
      n === 1 ? "1 transaction imported." : `${n} transactions imported.`,
  },

  review: {
    title: "Review unmatched transactions",
    refresh: "Refresh",
    loading: "Loading proposals…",
    error: "Failed to load proposals.",
    empty: "No unmatched transactions to review.",
    meta: (yearName: string, termName: string, total: number) =>
      `${yearName} · ${termName} · ${total} unmatched`,
    confirmedTally: (n: number) =>
      n === 1 ? "1 transaction confirmed" : `${n} transactions confirmed`,
    deletedTally: (n: number) =>
      n === 1 ? "1 row discarded" : `${n} rows discarded`,
    skippedTally: (n: number) =>
      n === 1
        ? "1 skipped (stays unmatched)"
        : `${n} skipped (stay unmatched)`,
    kind: {
      matched: "Auto-matched",
      matched_multi: "Multi-student",
      low_confidence: "Low confidence",
      unmatched: "No match",
    } as Record<"matched" | "matched_multi" | "low_confidence" | "unmatched", string>,
    showingCount: (shown: number, total: number) =>
      `Showing ${shown} of ${total}`,
    showMore: (n: number) => `Show ${n} more`,
  },

  triage: {
    tabs: {
      all: "All",
      attention: "Needs attention",
      confident: "Confident",
      missingCharge: "Missing fee",
      notStudent: "Not payments",
    },
    tabCount: (n: number) => `${n}`,
    attentionHeading: "Needs attention",
    attentionHint: "Review and confirm each of these individually.",
    confidentHeading: "Confident matches",
    confidentHint: "Pre-selected. Uncheck any that look wrong, then confirm.",
    missingChargeHeading: "Fee not on the ledger",
    missingChargeHint:
      "The student is identified and the amount matches the school's rate, but they have no such fee. Confirming adds the fee and records the payment against it.",
    noMissingCharge: "Nothing waiting on a new fee.",
    notStudentHeading: "Doesn't look like a student payment",
    notStudentHint:
      "Tournament fees from other schools, utility bills, refunds. Discarding keeps the row (as discarded) and can be undone.",
    noNotStudent: "Nothing here.",
    discardSelected: (n: number) =>
      n === 1 ? "Discard 1" : `Discard ${n}`,
    addFeeAndConfirm: "Add fee + confirm",
    addFeeAndConfirmSelected: (n: number) =>
      n === 1 ? "Add fee + confirm 1" : `Add fee + confirm ${n}`,
    selectAll: "Select all",
    clear: "Clear",
    selectedCount: (n: number) =>
      n === 1 ? "1 selected" : `${n} selected`,
    confirmSelected: (n: number) => `Confirm ${n} selected`,
    confirmingProgress: (done: number, total: number) =>
      `Confirming ${done} of ${total}…`,
    bulkDone: (ok: number, failed: number) =>
      failed === 0
        ? `${ok} confirmed.`
        : `${ok} confirmed, ${failed} failed — those rows are kept.`,
    noConfident: "No confident matches.",
    noAttention: "Nothing needs attention.",
    expand: "Show details",
    collapse: "Hide details",
    balanced: "Balanced",
    noMemo: "(no memo)",
    proposedFor: "→",
    splitStudents: (n: number) => `Split · ${n} students`,
    noProposal: "No proposed match",
    detailsLabel: "Bank details",
    reason: {
      unmatched: "No match",
      low_confidence: "Low confidence",
      multi_student: "Split payment",
      multiple_candidates: "Multiple candidates",
      flagged: "Needs a check",
      missing_charge: "Fee not on the ledger",
      not_student: "Not a student payment",
      unbalanced: "Amount doesn't balance",
    } as Record<
      | "unmatched"
      | "low_confidence"
      | "multi_student"
      | "multiple_candidates"
      | "flagged"
      | "missing_charge"
      | "not_student"
      | "unbalanced",
      string
    >,
    controls: {
      addFeeOption: (feeName: string, amount: string) =>
        `+ Add ${feeName} · ${amount}`,
      classAll: "All classes",
      classLabel: "Class",
      studentValue: "Student",
      studentPlaceholder: "Search student…",
      studentNone: "Pick student",
      studentNoMatch: "No students in this class",
      chargePlaceholder: "Charge",
      noOpenCharges: "No open charges for this student",
    },
    split: {
      acrossCharges: (n: number) =>
        n === 1 ? "Split · 1" : `Split · ${n}`,
      enable: "Split",
      disable: "Single charge",
      addCharge: "Add charge",
      remove: "Remove",
      allocated: (allocated: number, total: number) =>
        `Allocated ${allocated.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} MNT`,
    },
    info: {
      transaction: "Transaction details",
      sender: "Sender",
      account: "Account",
      reference: "Reference",
      date: "Date",
      matchedOn: "Matched on",
      noSignals: "No matching signals — fill this in manually.",
      alternatives: "Other candidate students",
      apply: (name: string) => `Use ${name}`,
      warnings: "Warnings",
      reason: "Why there's no confident match",
    },
    confirm: "Confirm",
    confirmPending: "…",
    skip: "Skip",
    discard: "Not a payment",
  },

  form: {
    classFilter: "Class",
    classFilterAll: "All classes",
    student: "Student",
    studentPlaceholder: "Search student by name…",
    studentNotSelected: "Select a student",
    studentNoMatch: "No students match",
    charge: "Charge",
    chargePlaceholder: "Select a charge",
    chargeNotSelected: "Select a charge",
    chargeNoOpen: "No open charges for this student",
    amount: "Amount (MNT)",
    addLine: "Add another allocation line",
    removeLine: "Remove this line",
    lineHeading: (i: number) => `Line ${i + 1}`,
    confirm: "Confirm",
    confirmPending: "Confirming…",
    delete: "Delete",
    deletePending: "Deleting…",
    deleteDialogTitle: "Discard this bank row?",
    deleteDialogBody:
      "Use this for rows that are not student payments (bank fees, refunds, unrelated transfers). The row is kept as 'discarded' and can be restored from Transaction history within the undo window.",
    deleteDialogConfirm: "Discard row",
    deleteDialogCancel: "Cancel",
    skip: "Skip",
    suggestions: "Other candidates:",
    applySuggestion: (name: string) => `Use ${name}`,
    sumOfLines: (n: number) => `Allocated: ${n.toLocaleString("en-US")} MNT`,
    txAmount: (n: number) => `Transaction: ${n.toLocaleString("en-US")} MNT`,
    diff: (n: number) => {
      const abs = Math.abs(n).toLocaleString("en-US");
      if (n === 0) return "Balanced";
      return n > 0 ? `Over by ${abs} MNT` : `Short by ${abs} MNT`;
    },
  },

  signals: {
    rollup: {
      memo_grade: "Memo: grade",
      memo_name: "Memo: name",
      account: "Account number",
      amount: "Amount",
    } as Record<"memo_grade" | "memo_name" | "account" | "amount", string>,
    granular: {
      memo_grade_class: "memo grade (class)",
      memo_grade_wildcard: "memo grade (wildcard)",
      memo_grade_level: "memo grade (level)",
      memo_name_full: "memo name (full)",
      memo_name_partial: "memo name (partial)",
      memo_name_initial: "memo name (initial form)",
      memo_name_fuzzy: "memo name (fuzzy)",
      sender_account: "sender account",
      fee_hint_explicit: "memo fee hint",
      fee_hint_from_amount: "amount → fee hint",
      fee_inferred_from_amount: "amount → fee inferred",
    } as Record<string, string>,
  },

  flags: {
    no_open_charges: "No open charges for this student.",
    overpayment: "Allocation exceeds the transaction amount.",
    partial_payment: "Allocation is a partial payment.",
    ambiguous_target: "Multiple candidate charges — pick one explicitly.",
    multiple_valid_combos: "Multiple charge combinations matched the amount — confirm intent.",
    multiple_tuition_charges: "More than one tuition charge — pick the correct one.",
    fee_inferred_from_amount: "Fee was inferred from the amount; verify before confirming.",
    manual_review: "Manual review required.",
  } as Record<string, string>,

  unmatched: {
    reason: {
      no_candidates: "No candidate students found.",
      filtered: "Candidate filtered out.",
      not_student: "Doesn't look like a student payment.",
      no_open_charges: "Candidate has no open charges.",
    },
  },
};

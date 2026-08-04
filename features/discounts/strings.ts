export const strings = {
  page: {
    title: "Discount catalog",
    description:
      "Reusable tuition discounts. Applied to a student, they compound top-to-bottom onto the base tuition.",
    adminHint: "Only admins can add or edit discounts; everyone can view them.",
  },
  add: "Add discount",
  empty: "No discounts yet.",
  columns: {
    name: "Name",
    unit: "Type",
    value: "Value",
    note: "Note",
    status: "Status",
    actions: "",
  },
  unit: {
    mnt: "Flat (MNT)",
    percent: "Percent",
  },
  custom: "Custom (set on apply)",
  active: "Active",
  inactive: "Retired",
  edit: "Edit",
  form: {
    addTitle: "New discount",
    editTitle: "Edit discount",
    name: "Name",
    namePlaceholder: "e.g. Early-bird, Scholarship",
    unit: "Type",
    unitMnt: "Flat amount (MNT)",
    unitPercent: "Percent (%)",
    value: "Value",
    valueHint: "Leave blank for a custom amount entered when applied.",
    valueMntPlaceholder: "e.g. 300000",
    valuePercentPlaceholder: "e.g. 10",
    note: "Note",
    notePlaceholder: "Optional",
    active: "Active (offered when applying discounts)",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    error: "Could not save. Please try again.",
  },
  toasts: {
    created: "Discount added.",
    updated: "Discount saved.",
  },
  // How a catalog value reads in a cell / picker option.
  valueLabel: (unit: "mnt" | "percent", value: number | null): string => {
    if (value === null) return "Custom";
    return unit === "percent"
      ? `${value}%`
      : `${value.toLocaleString("en-US")}₮`;
  },
};

export const strings = {
  page: {
    title: "Classes & levels",
    description:
      "Grade levels are stable across years; classes are set up per year. Both are normally loaded by the year-start import — edits here are corrections.",
    adminHint:
      "Grade levels and the classes of each academic year. Only an admin can change them.",
  },
  tabs: {
    label: "Classes sections",
    classes: "Classes",
    levels: "Grade levels",
  },
  yearPicker: {
    label: "Academic year",
    current: "Current",
  },
  levels: {
    title: "Grade levels",
    description:
      "The level, not the class, decides a student's tuition rate. Codes are matched by tuition and can't be renamed.",
    empty: "No grade levels yet.",
    columns: {
      code: "Code",
      order: "Order",
      usage: "In use",
      tuition: "Tuition",
    },
    priced: "Priced",
    notPriced: "No rate",
    add: "Add level",
    usage: (u: { grades: number; enrollments: number }) =>
      [
        plural(u.grades, "class", "classes"),
        plural(u.enrollments, "student", "students"),
      ]
        .filter((p) => p !== null)
        .join(" · "),
    unused: "Not used yet",
  },
  classes: {
    title: (year: string) => `Classes — ${year}`,
    description:
      "One row per class section in this year, with the teacher shown on the tracker.",
    empty: "No classes in this year yet.",
    columns: {
      name: "Class",
      level: "Level",
      teacher: "Teacher",
      contact: "Contact",
      students: "Students",
    },
    add: "Add class",
    noTeacher: "—",
    students: (n: number) => (n === 1 ? "1 student" : `${n} students`),
  },
  form: {
    addLevelTitle: "Add grade level",
    editLevelTitle: "Edit grade level",
    addClassTitle: "Add class",
    editClassTitle: "Edit class",
    code: "Code",
    codePlaceholder: "e.g. 5+",
    codeLockedHint:
      "The code can't change: tuition is priced per level code, so renaming it would detach the level from its rate.",
    codeNewHint: "Tuition is priced against this code. Match how the school writes it.",
    sortOrder: "Display order",
    sortOrderHint: "Lower sorts first — this is what makes 2 come before 10.",
    className: "Class name",
    classNamePlaceholder: "e.g. 5+A",
    classNameHint:
      "The year-start import matches classes by name; renaming one here can make the next import create a second class.",
    level: "Grade level",
    levelLockedHint:
      "This class has students, so its level is fixed — the level sets their tuition rate.",
    teacherName: "Teacher",
    teacherNamePlaceholder: "Full name",
    teacherEmail: "Teacher email",
    teacherPhone: "Teacher phone",
    inYear: (name: string) => `In ${name}`,
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    error: "Could not save. Please try again.",
  },
  actions: {
    edit: "Edit",
    editLevel: (code: string) => `Edit grade level ${code}`,
    editClass: (name: string) => `Edit ${name}`,
    delete: "Delete",
    deleteLevel: (code: string) => `Delete grade level ${code}`,
    deleteClass: (name: string) => `Delete ${name}`,
  },
  remove: {
    levelTitle: "Delete this grade level?",
    classTitle: "Delete this class?",
    body: (name: string) => `${name} will be removed. This can't be undone.`,
    blockedHint: "In use — delete is unavailable.",
    confirm: "Delete",
    deleting: "Deleting…",
    cancel: "Cancel",
    error: "Could not delete. Please try again.",
  },
  toasts: {
    levelCreated: "Grade level added.",
    levelUpdated: "Grade level updated.",
    levelDeleted: "Grade level deleted.",
    classCreated: "Class added.",
    classUpdated: "Class updated.",
    classDeleted: "Class deleted.",
  },
};

function plural(n: number, one: string, many: string): string | null {
  if (n === 0) return null;
  return `${n} ${n === 1 ? one : many}`;
}

import type { Metadata } from "next";

import { CalendarView, listAcademicCalendar, strings } from "@/features/calendar";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.page.title };

// Readable by every accountant — which year and term the app is scoped to is
// context everyone needs. Only admins see the controls, and the mutation routes
// enforce requireAdmin regardless.
export default async function CalendarPage() {
  const user = await requireUserForLayout();
  const calendar = await listAcademicCalendar();
  return <CalendarView calendar={calendar} canEdit={user.role === "admin"} />;
}

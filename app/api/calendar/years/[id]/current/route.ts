import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { calendarIdParamSchema, setCurrentAcademicYear } from "@/features/calendar";

// Its own endpoint rather than a field on the year: making a year current is a
// deliberate act with app-wide consequences, not an edit to a row.
export const POST = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const yearId = calendarIdParamSchema.parse((await params).id);
  return Response.json(await setCurrentAcademicYear(user, yearId));
});

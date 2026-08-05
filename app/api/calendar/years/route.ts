import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { academicYearInputSchema, createAcademicYear } from "@/features/calendar";

// Reading the calendar happens through the page's server component; only the
// writes need routes, and every one of them is admin-only.
export const POST = withErrorHandler(async (req) => {
  const { user } = await requireAdmin(req);
  const input = academicYearInputSchema.parse(await req.json());
  const created = await createAcademicYear(user, input);
  return Response.json(created, { status: 201 });
});

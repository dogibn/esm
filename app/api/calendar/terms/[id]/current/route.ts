import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { calendarIdParamSchema, setCurrentAcademicTerm } from "@/features/calendar";

export const POST = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const termId = calendarIdParamSchema.parse((await params).id);
  return Response.json(await setCurrentAcademicTerm(user, termId));
});

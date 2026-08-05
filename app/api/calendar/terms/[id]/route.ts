import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import {
  academicTermUpdateSchema,
  calendarIdParamSchema,
  deleteAcademicTerm,
  updateAcademicTerm,
} from "@/features/calendar";

// No year field on update: a term keeps the year it was created in (see
// features/calendar/schemas.ts).
export const PUT = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const termId = calendarIdParamSchema.parse((await params).id);
  const input = academicTermUpdateSchema.parse(await req.json());
  return Response.json(await updateAcademicTerm(user, termId, input));
});

export const DELETE = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const termId = calendarIdParamSchema.parse((await params).id);
  return Response.json(await deleteAcademicTerm(user, termId));
});

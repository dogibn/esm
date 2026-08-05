import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import {
  academicYearInputSchema,
  calendarIdParamSchema,
  deleteAcademicYear,
  updateAcademicYear,
} from "@/features/calendar";

export const PUT = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const yearId = calendarIdParamSchema.parse((await params).id);
  const input = academicYearInputSchema.parse(await req.json());
  return Response.json(await updateAcademicYear(user, yearId, input));
});

export const DELETE = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const yearId = calendarIdParamSchema.parse((await params).id);
  return Response.json(await deleteAcademicYear(user, yearId));
});

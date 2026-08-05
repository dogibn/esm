import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { academicTermCreateSchema, createAcademicTerm } from "@/features/calendar";

export const POST = withErrorHandler(async (req) => {
  const { user } = await requireAdmin(req);
  const input = academicTermCreateSchema.parse(await req.json());
  const created = await createAcademicTerm(user, input);
  return Response.json(created, { status: 201 });
});

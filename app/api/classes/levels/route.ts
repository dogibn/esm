import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { createGradeLevel, gradeLevelCreateSchema } from "@/features/classes";

export const POST = withErrorHandler(async (req) => {
  const { user } = await requireAdmin(req);
  const input = gradeLevelCreateSchema.parse(await req.json());
  const created = await createGradeLevel(user, input);
  return Response.json(created, { status: 201 });
});

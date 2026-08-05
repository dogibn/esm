import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import {
  classIdParamSchema,
  deleteGradeLevel,
  gradeLevelUpdateSchema,
  updateGradeLevel,
} from "@/features/classes";

// Only the display order is editable — `code` is the tuition lookup key and is
// fixed at creation (features/classes/schemas.ts).
export const PUT = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const levelId = classIdParamSchema.parse((await params).id);
  const input = gradeLevelUpdateSchema.parse(await req.json());
  return Response.json(await updateGradeLevel(user, levelId, input));
});

export const DELETE = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const levelId = classIdParamSchema.parse((await params).id);
  return Response.json(await deleteGradeLevel(user, levelId));
});

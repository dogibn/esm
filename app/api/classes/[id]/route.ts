import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import {
  classIdParamSchema,
  classUpdateSchema,
  deleteClass,
  updateClass,
} from "@/features/classes";

// No year field on update: a class keeps the year it was created in (see
// features/classes/schemas.ts).
export const PUT = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const classId = classIdParamSchema.parse((await params).id);
  const input = classUpdateSchema.parse(await req.json());
  return Response.json(await updateClass(user, classId, input));
});

export const DELETE = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const classId = classIdParamSchema.parse((await params).id);
  return Response.json(await deleteClass(user, classId));
});

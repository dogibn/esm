import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import {
  studentIdParamSchema,
  tuitionUpdateSchema,
  updateTuition,
} from "@/features/students";

export const PUT = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const { id } = await params;
  const studentId = studentIdParamSchema.parse(id);
  const input = tuitionUpdateSchema.parse(await req.json());
  const result = await updateTuition(user, studentId, input);
  return Response.json(result);
});

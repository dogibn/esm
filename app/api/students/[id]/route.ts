import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import {
  studentIdParamSchema,
  studentUpdateSchema,
  updateStudent,
} from "@/features/students";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const { id } = await params;
  const studentId = studentIdParamSchema.parse(id);
  const input = studentUpdateSchema.parse(await req.json());
  const updated = await updateStudent(user, studentId, input);
  return Response.json(updated);
});

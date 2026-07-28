import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import {
  chargeCreateSchema,
  createCharge,
  studentIdParamSchema,
} from "@/features/students";

export const POST = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const { id } = await params;
  const studentId = studentIdParamSchema.parse(id);
  const input = chargeCreateSchema.parse(await req.json());
  const result = await createCharge(user, studentId, input);
  return Response.json(result, { status: 201 });
});

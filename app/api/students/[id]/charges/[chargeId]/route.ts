import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import {
  chargeUpdateSchema,
  deleteCharge,
  studentIdParamSchema,
  updateCharge,
} from "@/features/students";

type Ctx = { params: Promise<{ id: string; chargeId: string }> };

export const PATCH = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { params } = ctx as Ctx;
  const { id, chargeId } = await params;
  const studentId = studentIdParamSchema.parse(id);
  const charge = studentIdParamSchema.parse(chargeId);
  const input = chargeUpdateSchema.parse(await req.json());
  const result = await updateCharge(user, studentId, charge, input);
  return Response.json(result);
});

export const DELETE = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { params } = ctx as Ctx;
  const { id, chargeId } = await params;
  const studentId = studentIdParamSchema.parse(id);
  const charge = studentIdParamSchema.parse(chargeId);
  const result = await deleteCharge(user, studentId, charge);
  return Response.json(result);
});

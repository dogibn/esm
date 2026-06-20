import { z } from "zod";

import { HttpError, withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { allocationFormSchema, confirmAllocation } from "@/features/imports";

const idSchema = z.coerce.number().int().positive();

export const POST = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const bankTransactionId = idSchema.parse(id);

  const body = allocationFormSchema.parse(await req.json());
  if (body.bankTransactionId !== bankTransactionId) {
    throw new HttpError(400, "Path id and payload bankTransactionId disagree");
  }

  const result = await confirmAllocation(user, body);
  return Response.json(result);
});

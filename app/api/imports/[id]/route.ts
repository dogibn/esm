import { z } from "zod";

import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { deleteUnmatchedTransaction } from "@/features/imports";

const idSchema = z.coerce.number().int().positive();

export const DELETE = withErrorHandler(async (req, ctx) => {
  await requireUser(req);
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const bankTransactionId = idSchema.parse(id);

  await deleteUnmatchedTransaction(bankTransactionId);
  return Response.json({ deleted: true });
});

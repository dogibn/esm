import { z } from "zod";

import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { discardUnmatchedTransaction } from "@/features/imports";

const idSchema = z.coerce.number().int().positive();

// Kept as DELETE for the review UI, but this is now a soft discard: the row is
// retained with status 'discarded' and the action is reversible.
export const DELETE = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const bankTransactionId = idSchema.parse(id);

  await discardUnmatchedTransaction(user, bankTransactionId);
  return Response.json({ discarded: true });
});

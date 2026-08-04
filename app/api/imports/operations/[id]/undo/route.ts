import { z } from "zod";

import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { undoOperation } from "@/features/imports";

const idSchema = z.coerce.number().int().positive();

// Reverse a recorded operation (confirm, discard, or new-contract creation).
// Authorization, window, and already-undone checks live in the service. Admins
// may undo anyone's action; accountants only their own.
export const POST = withErrorHandler(async (req, ctx) => {
  const { user } = await requireUser(req);
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const operationId = idSchema.parse(id);

  const result = await undoOperation(user, operationId);
  return Response.json(result);
});

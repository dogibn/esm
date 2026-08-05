import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { updateUser, updateUserSchema, userIdParamSchema } from "@/features/users";

// Role change, revoke, and restore are all the same partial update. There is
// no DELETE: revoking sets is_active = false so the operations log keeps a
// readable actor (see features/users/api.ts).
export const PATCH = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const { id } = await params;
  const userId = userIdParamSchema.parse(id);
  const input = updateUserSchema.parse(await req.json());
  const updated = await updateUser(user, userId, input);
  return Response.json(updated);
});

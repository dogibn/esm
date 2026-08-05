import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { createUser, createUserSchema, listUsers } from "@/features/users";

// Admin-only on both verbs: the allowlist is the access-control surface
// itself, so who holds a role is not something an accountant reads either.
export const GET = withErrorHandler(async (req) => {
  await requireAdmin(req);
  return Response.json(await listUsers());
});

export const POST = withErrorHandler(async (req) => {
  const { user } = await requireAdmin(req);
  const input = createUserSchema.parse(await req.json());
  const created = await createUser(user, input);
  return Response.json(created, { status: 201 });
});

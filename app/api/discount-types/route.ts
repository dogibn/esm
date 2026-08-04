import { withErrorHandler } from "@/lib/errors";
import { requireAdmin, requireUser } from "@/lib/auth";
import {
  createDiscountType,
  discountTypeInputSchema,
  listDiscountTypes,
} from "@/features/discounts";

// Any accountant can read the catalog.
export const GET = withErrorHandler(async (req) => {
  await requireUser(req);
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";
  const types = await listDiscountTypes({ activeOnly });
  return Response.json(types);
});

// Only admins curate it.
export const POST = withErrorHandler(async (req) => {
  const { user } = await requireAdmin(req);
  const input = discountTypeInputSchema.parse(await req.json());
  const created = await createDiscountType(user, input);
  return Response.json(created, { status: 201 });
});

import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import {
  discountTypeIdParamSchema,
  discountTypeInputSchema,
  updateDiscountType,
} from "@/features/discounts";

export const PUT = withErrorHandler(async (req, ctx) => {
  const { user } = await requireAdmin(req);
  const { params } = ctx as { params: Promise<{ id: string }> };
  const { id } = await params;
  const typeId = discountTypeIdParamSchema.parse(id);
  const input = discountTypeInputSchema.parse(await req.json());
  const updated = await updateDiscountType(user, typeId, input);
  return Response.json(updated);
});

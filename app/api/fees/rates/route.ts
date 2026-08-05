import { withErrorHandler } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { feeRatePublishSchema, publishFeeRate } from "@/features/fees";

// The one write this feature has: supersede the rate in force and insert a new
// one. There is no PUT and no DELETE — a rate is never edited or removed, so
// the validity chain stays the record of what the school charged and when
// (domain_model.md § FeeStructure).
export const POST = withErrorHandler(async (req) => {
  const { user } = await requireAdmin(req);
  const input = feeRatePublishSchema.parse(await req.json());
  const created = await publishFeeRate(user, input);
  return Response.json(created, { status: 201 });
});

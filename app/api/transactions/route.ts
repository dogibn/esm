import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import {
  listTransactions,
  transactionListParamsSchema,
  transactionListResponseToWire,
} from "@/features/transactions";

export const GET = withErrorHandler(async (req) => {
  const { user } = await requireUser(req);
  const url = new URL(req.url);
  const params = transactionListParamsSchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const data = await listTransactions(user, params);
  return Response.json(transactionListResponseToWire(data));
});

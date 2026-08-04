import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import {
  historyListParamsSchema,
  historyListResponseToWire,
  listHistory,
} from "@/features/history";

// Read the activity log. Role scoping (admin sees all, accountant sees only
// their own) is enforced inside listHistory from the session, not by any query
// param, so a crafted request can't widen an accountant's visibility.
export const GET = withErrorHandler(async (req) => {
  const { user } = await requireUser(req);
  const url = new URL(req.url);
  const params = historyListParamsSchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const data = await listHistory(user, params);
  return Response.json(historyListResponseToWire(data));
});

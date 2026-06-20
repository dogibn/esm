import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import {
  listProposals,
  proposalListResponseToWire,
} from "@/features/imports";

export const GET = withErrorHandler(async (req) => {
  const { user } = await requireUser(req);
  const data = await listProposals(user);
  return Response.json(proposalListResponseToWire(data));
});

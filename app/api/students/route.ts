import { withErrorHandler } from '@/lib/errors';
import { requireUser } from '@/lib/auth';

export const GET = withErrorHandler(async (req) => {
  const { applyAuthCookies } = await requireUser(req);
  const headers = new Headers();
  applyAuthCookies(headers);
  return Response.json([], { headers });
});

import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { listStudents, studentListParamsSchema } from "@/features/students";

export const GET = withErrorHandler(async (req) => {
  const { user } = await requireUser(req);
  const url = new URL(req.url);
  const params = studentListParamsSchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const data = await listStudents(user, params);
  return Response.json(data);
});

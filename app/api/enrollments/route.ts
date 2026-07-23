import { withErrorHandler } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { createEnrollment, createEnrollmentSchema } from "@/features/enrollments";

export const POST = withErrorHandler(async (req) => {
  const { user } = await requireUser(req);
  const input = createEnrollmentSchema.parse(await req.json());
  const result = await createEnrollment(user, input);
  return Response.json(result, { status: 201 });
});

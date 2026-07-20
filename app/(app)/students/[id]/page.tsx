import { notFound } from "next/navigation";

import {
  StudentDetailView,
  getStudentDetail,
  studentIdParamSchema,
} from "@/features/students";
import { HttpError } from "@/lib/errors";
import { requireUserForLayout } from "@/lib/auth";

type Params = Promise<{ id: string }>;

export default async function StudentDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireUserForLayout();
  const { id } = await params;

  const parsed = studentIdParamSchema.safeParse(id);
  if (!parsed.success) notFound();

  let detail;
  try {
    detail = await getStudentDetail(parsed.data);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <StudentDetailView detail={detail} />
    </section>
  );
}

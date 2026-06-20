import {
  StudentsView,
  listFilterOptions,
  listStudents,
  strings,
  studentListParamsSchema,
} from "@/features/students";
import { requireUserForLayout } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUserForLayout();
  const raw = await searchParams;
  const params = studentListParamsSchema.parse({
    page: raw.page,
    pageSize: raw.pageSize,
  });
  const [initialData, filterOptions] = await Promise.all([
    listStudents(user, params),
    listFilterOptions(),
  ]);

  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{strings.title}</h1>
      <StudentsView options={filterOptions} initialData={initialData} />
    </section>
  );
}

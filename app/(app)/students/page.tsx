import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  StudentsView,
  listFilterOptions,
  listStudents,
  strings,
  studentListParamsSchema,
} from "@/features/students";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.title };

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
    <PageContainer>
      <PageHeader title={strings.title} description={strings.subtitle} />
      <StudentsView options={filterOptions} initialData={initialData} />
    </PageContainer>
  );
}

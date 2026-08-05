import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { NewContractButton } from "@/features/enrollments";
import {
  StudentsView,
  feeScopeSchema,
  groupBySchema,
  listFilterOptions,
  listStudents,
  pageSizeFor,
  resolveGroupBy,
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
  // Grouping paginates by class, so the page size depends on it. An explicit
  // ?pageSize= still wins. A `?groupBy=` outside the scope that offers it is
  // dropped here too, or the table would open grouped with no toggle to unset.
  const fee = feeScopeSchema.parse(raw.fee);
  const groupBy = resolveGroupBy(fee, groupBySchema.parse(raw.groupBy));
  const params = studentListParamsSchema.parse({
    page: raw.page,
    pageSize: raw.pageSize ?? String(pageSizeFor(groupBy)),
    fee,
    groupBy,
  });
  const [initialData, filterOptions] = await Promise.all([
    listStudents(user, params),
    listFilterOptions(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={strings.title}
        description={strings.subtitle}
        actions={<NewContractButton />}
      />
      <StudentsView
        options={filterOptions}
        initialData={initialData}
        initialFee={params.fee}
        initialGroupBy={params.groupBy}
      />
    </PageContainer>
  );
}

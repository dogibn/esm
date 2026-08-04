import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  HistoryView,
  historyListParamsSchema,
  historyListResponseToWire,
  listHistory,
  strings,
} from "@/features/history";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.title };

export default async function HistoryPage() {
  const user = await requireUserForLayout();
  const params = historyListParamsSchema.parse({});
  const initialData = await listHistory(user, params);

  return (
    <PageContainer>
      <PageHeader title={strings.title} description={strings.description} />
      <HistoryView initialData={historyListResponseToWire(initialData)} />
    </PageContainer>
  );
}

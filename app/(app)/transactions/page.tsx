import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  TransactionsView,
  listTransactions,
  strings,
  transactionListParamsSchema,
  transactionListResponseToWire,
} from "@/features/transactions";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.title };

export default async function TransactionsPage() {
  const user = await requireUserForLayout();
  const params = transactionListParamsSchema.parse({});
  const initialData = await listTransactions(user, params);

  return (
    <PageContainer>
      <PageHeader title={strings.title} description={strings.description} />
      <TransactionsView initialData={transactionListResponseToWire(initialData)} />
    </PageContainer>
  );
}

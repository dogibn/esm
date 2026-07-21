import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  ImportsView,
  listProposals,
  proposalListResponseToWire,
  strings,
} from "@/features/imports";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.pageTitle };

export default async function ImportsPage() {
  const user = await requireUserForLayout();
  const initialProposals = proposalListResponseToWire(await listProposals(user));

  return (
    <PageContainer>
      <PageHeader title={strings.pageTitle} description={strings.pageDescription} />
      <ImportsView initialProposals={initialProposals} />
    </PageContainer>
  );
}

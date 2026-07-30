import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  EnrollmentForm,
  getEnrollmentFormContext,
  strings,
} from "@/features/enrollments";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.page.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewEnrollmentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUserForLayout();
  const raw = await searchParams;
  const mode = raw.mode === "existing" ? "existing" : "new";
  const context = await getEnrollmentFormContext();

  return (
    <PageContainer>
      <Link
        href="/students"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {strings.page.back}
      </Link>
      <PageHeader
        title={strings.page.title}
        description={`${strings.page.description} ${strings.page.forYear(
          context.academicYear.name,
        )}.`}
      />
      <EnrollmentForm context={context} initialMode={mode} />
    </PageContainer>
  );
}

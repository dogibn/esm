"use client";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-header";
import { strings } from "@/app/strings";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContainer className="items-center py-20 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="text-xl font-semibold">{strings.errors.title}</h1>
        <p className="text-sm text-muted-foreground">
          {strings.errors.description}
        </p>
        <Button onClick={reset}>{strings.errors.retry}</Button>
      </div>
    </PageContainer>
  );
}

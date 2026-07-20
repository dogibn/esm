import { Card, CardContent, CardHeader } from "@/components/ui/card";

import type { StudentDetailHeader } from "../../detail";
import { strings } from "../../strings";

import { SectionHeading } from "./SectionHeading";

function Field({ label, value }: { label: string; value: string | null }) {
  const hasValue = value !== null && value.trim().length > 0;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm break-words">
        {hasValue ? value : strings.detail.personal.empty}
      </dd>
    </div>
  );
}

export function PersonalInfoCard({ header }: { header: StudentDetailHeader }) {
  const s = strings.detail.personal;
  return (
    <Card size="sm">
      <CardHeader>
        <SectionHeading title={s.title} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          {strings.detail.studentId(header.code)}
        </p>
        <dl className="flex flex-col gap-3">
          <Field label={s.class} value={header.gradeName} />
          <Field label={s.teacher} value={header.teacherName} />
          <Field label={s.parentEmail} value={header.parentEmail} />
          <Field label={s.parentPhone} value={header.parentPhone} />
          <Field label={s.contract} value={header.tuitionContractId} />
        </dl>
      </CardContent>
    </Card>
  );
}

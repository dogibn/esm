import { Card, CardContent, CardHeader } from "@/components/ui/card";

import type { TuitionBreakdown } from "../../detail";
import { formatMnt } from "../../format";
import { strings } from "../../strings";

import { SectionHeading } from "./SectionHeading";

export function TuitionBreakdownCard({
  tuition,
}: {
  tuition: TuitionBreakdown | null;
}) {
  const s = strings.detail.tuition;
  return (
    <Card size="sm">
      <CardHeader>
        <SectionHeading title={s.title} />
      </CardHeader>
      <CardContent>
        {tuition === null ? (
          <p className="text-sm text-muted-foreground">{s.noCharge}</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>{s.base}</span>
              <span className="font-medium tabular-nums">
                {formatMnt(tuition.gross)}
              </span>
            </div>
            {tuition.discounts.map((d, i) => (
              <div
                key={`${d.name}-${i}`}
                className="flex items-center justify-between gap-2 text-muted-foreground"
              >
                <span className="break-words">{d.name}</span>
                <span className="tabular-nums">−{formatMnt(d.amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between gap-2 border-t pt-2">
              <span className="font-semibold">{s.net}</span>
              <span className="font-semibold tabular-nums">
                {formatMnt(tuition.net)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

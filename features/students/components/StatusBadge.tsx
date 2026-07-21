import { Badge } from "@/components/ui/badge";

import { strings } from "../strings";
import type { FeeStatus } from "../types";

// The one place fee status maps to a badge variant. Reused by the tracking
// table and the student detail page so the vocabulary stays identical.
function statusVariant(
  status: FeeStatus,
): "success" | "warning" | "destructive" | null {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
      return "warning";
    case "unpaid":
      return "destructive";
    case "none":
      return null;
  }
}

export function StatusBadge({ status }: { status: FeeStatus }) {
  const variant = statusVariant(status);
  if (variant === null) {
    return <span className="text-muted-foreground">{strings.status.none}</span>;
  }
  return (
    <Badge variant={variant}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {strings.status[status]}
    </Badge>
  );
}

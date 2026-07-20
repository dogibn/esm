import { Badge } from "@/components/ui/badge";

import { strings } from "../strings";
import type { FeeStatus } from "../types";

// The one place fee status maps to a badge variant. Reused by the tracking
// table and the student detail page so the vocabulary stays identical.
function statusVariant(
  status: FeeStatus,
): "secondary" | "outline" | "destructive" | null {
  switch (status) {
    case "paid":
      return "secondary";
    case "partial":
      return "outline";
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
  return <Badge variant={variant}>{strings.status[status]}</Badge>;
}

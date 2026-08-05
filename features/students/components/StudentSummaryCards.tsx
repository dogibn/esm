import { Banknote, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";

import { formatMnt } from "../format";
import { strings } from "../strings";
import type { StudentListSummary } from "../types";

export function StudentSummaryCards({ summary }: { summary: StudentListSummary }) {
  const s = strings.summary;
  // Both cards are scoped to the selected fee, so the rate answers "of what is
  // due for this fee, how much has come in".
  const rate =
    summary.totalDue > 0
      ? ((summary.totalCollected / summary.totalDue) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatCard
        accent="primary"
        icon={<Banknote />}
        label={s.totalDue}
        value={formatMnt(summary.totalOutstanding)}
        sub={s.students(summary.students)}
      />
      <StatCard
        accent="success"
        icon={<TrendingUp />}
        label={s.totalCollected}
        value={formatMnt(summary.totalCollected)}
        sub={s.collectionRate(rate)}
      />
    </div>
  );
}

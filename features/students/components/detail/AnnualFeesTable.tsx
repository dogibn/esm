import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { FeeLine } from "../../detail";
import { formatMnt } from "../../format";
import { strings } from "../../strings";

import { StatusBadge } from "../StatusBadge";

export function AnnualFeesTable({ fees }: { fees: FeeLine[] }) {
  const c = strings.detail.columns;
  if (fees.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {strings.detail.annual.empty}
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{c.fee}</TableHead>
          <TableHead className="text-right">{c.amount}</TableHead>
          <TableHead className="text-right">{c.paid}</TableHead>
          <TableHead className="text-right">{c.balance}</TableHead>
          <TableHead>{c.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fees.map((f) => (
          <TableRow key={f.chargeId}>
            <TableCell className="font-medium">
              {strings.detail.feeLabel(f.feeName)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMnt(f.net)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {f.paid > 0 ? (
                <span className="font-medium text-success">{formatMnt(f.paid)}</span>
              ) : (
                formatMnt(f.paid)
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {f.balance > 0 ? (
                <span className="font-medium text-destructive">
                  {formatMnt(f.balance)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {strings.detail.personal.empty}
                </span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={f.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

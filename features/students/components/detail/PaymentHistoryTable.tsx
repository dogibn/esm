import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { PaymentHistoryRow } from "../../detail";
import { formatDate, formatMnt } from "../../format";
import { strings } from "../../strings";

export function PaymentHistoryTable({
  rows,
  studentName,
}: {
  rows: PaymentHistoryRow[];
  studentName: string;
}) {
  const c = strings.detail.columns;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {strings.detail.history.empty}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {strings.detail.history.subtitle(studentName)}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{c.date}</TableHead>
            <TableHead>{c.fee}</TableHead>
            <TableHead className="text-right">{c.amount}</TableHead>
            <TableHead>{c.sender}</TableHead>
            <TableHead>{c.reference}</TableHead>
            <TableHead>{c.memo}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.paymentId}>
              <TableCell>{formatDate(r.transactionAt)}</TableCell>
              <TableCell>{strings.detail.feeLabel(r.feeName)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMnt(r.amount)}
              </TableCell>
              <TableCell>
                {r.senderName ?? strings.detail.personal.empty}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {r.reference}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                {r.memo ?? strings.detail.personal.empty}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

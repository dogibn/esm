"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { TermColumn, TermFeeRow } from "../../detail";
import { formatMnt } from "../../format";
import { strings } from "../../strings";

import { StatusBadge } from "../StatusBadge";
import type { ChargeEditTarget } from "./ChargeFormDialog";

export function TermFeesTable({
  terms,
  rows,
  onEdit,
}: {
  terms: TermColumn[];
  rows: TermFeeRow[];
  onEdit: (target: ChargeEditTarget) => void;
}) {
  const s = strings.detail.term;
  if (rows.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">{s.empty}</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{s.feeType}</TableHead>
          {terms.map((t) => (
            <TableHead
              key={t.id}
              className={cn("text-center", t.isCurrent && "bg-primary/10 text-primary")}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>{t.name}</span>
                {t.isCurrent ? (
                  <Badge variant="info">{s.current}</Badge>
                ) : null}
              </div>
            </TableHead>
          ))}
          <TableHead className="text-right">{s.total}</TableHead>
          <TableHead className="text-right">
            {strings.detail.columns.balance}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.feeName}>
            <TableCell className="font-medium">
              {strings.detail.feeLabel(r.feeName)}
            </TableCell>
            {terms.map((term, i) => {
              const cell = r.cells[i] ?? { hasCharge: false as const };
              return (
                <TableCell
                  key={term.id}
                  className={cn("text-center", term.isCurrent && "bg-primary/5")}
                >
                  {cell.hasCharge ? (
                    <button
                      type="button"
                      className="mx-auto flex flex-col items-center gap-1 rounded-md px-2 py-1 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={strings.detail.charge.editAria(
                        `${strings.detail.feeLabel(r.feeName)} · ${term.name}`,
                      )}
                      onClick={() =>
                        onEdit({
                          chargeId: cell.chargeId,
                          feeName: strings.detail.feeLabel(r.feeName),
                          scopeLabel: term.name,
                          amount: cell.charged,
                          notes: cell.notes,
                          paid: cell.paid,
                        })
                      }
                    >
                      <StatusBadge status={cell.status} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatMnt(cell.charged)}
                      </span>
                    </button>
                  ) : (
                    <span className="text-muted-foreground">{s.notEnrolled}</span>
                  )}
                </TableCell>
              );
            })}
            <TableCell className="text-right tabular-nums">
              {formatMnt(r.charged)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.balance > 0 ? (
                <span className="font-medium text-destructive">
                  {formatMnt(r.balance)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {strings.detail.personal.empty}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

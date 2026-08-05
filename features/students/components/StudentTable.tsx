"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDate, formatMnt } from "../format";
import type { FeeScopeValue } from "../schemas";
import { strings } from "../strings";
import type { StudentListResponse, StudentRow } from "../types";
import { StatusBadge } from "./StatusBadge";

type Props = {
  data: StudentListResponse;
  fee: FeeScopeValue;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onPageChange: (page: number) => void;
};

// Paid, with a hairline bar showing how far it covers what's due. Full → the
// success tone, part-way → warning, nothing paid → the bare track.
function PaidCell({ row }: { row: StudentRow }) {
  const tone =
    row.paid <= 0 ? "primary" : row.balance <= 0 ? "success" : "warning";
  return (
    <div className="flex min-w-24 flex-col gap-1.5">
      <span className="font-medium tabular-nums">{formatMnt(row.paid)}</span>
      <Progress
        size="xs"
        tone={tone}
        value={row.paid}
        max={row.due}
        aria-label={strings.paidProgress(formatMnt(row.paid), formatMnt(row.due))}
      />
    </div>
  );
}

const columnHelper = createColumnHelper<StudentRow>();

// Headers differ between the per-fee scopes and the all-fees rollup; the shape
// of the table does not.
function buildColumns(fee: FeeScopeValue) {
  const isRollup = fee === "all";
  return [
    columnHelper.accessor("studentCode", {
      id: "id",
      header: strings.columns.id,
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("lastName", {
      id: "student",
      header: strings.columns.student,
      cell: (info) => {
        const row = info.row.original;
        // Surname-first per Mongolian convention: surname lighter, given name
        // emphasized. The whole row is the click target (see TableRow below);
        // this stays a real link so keyboard and screen-reader users have one too.
        return (
          <Link
            href={`/students/${row.studentId}`}
            className="rounded-sm underline-offset-4 outline-none group-hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-muted-foreground">{row.lastName}</span>{" "}
            <span className="font-semibold text-foreground group-hover:text-primary">
              {row.firstName}
            </span>
          </Link>
        );
      },
    }),
    columnHelper.accessor("gradeName", {
      id: "class",
      header: strings.columns.class,
      cell: (info) => <span>{info.getValue()}</span>,
    }),
    columnHelper.accessor("due", {
      id: "due",
      header: isRollup ? strings.columns.totalDue : strings.columns.due,
      cell: (info) => (
        <span className="font-semibold tabular-nums">{formatMnt(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor("paid", {
      id: "paid",
      header: isRollup ? strings.columns.totalPaid : strings.columns.paid,
      cell: (info) => <PaidCell row={info.row.original} />,
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: strings.columns.status,
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor("lastPaymentAt", {
      id: "lastPayment",
      header: strings.columns.lastPayment,
      cell: (info) => {
        const at = info.getValue();
        return at === null ? (
          <span className="text-muted-foreground">{strings.noPayment}</span>
        ) : (
          <span className="tabular-nums">{formatDate(at)}</span>
        );
      },
    }),
  ];
}

export function StudentTable({
  data,
  fee,
  loading,
  error,
  emptyMessage,
  onPageChange,
}: Props) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const columns = useMemo(() => buildColumns(fee), [fee]);

  const table = useReactTable({
    data: data.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const shown = data.rows.length;
  const canPrev = data.page > 1 && !loading;
  const canNext = data.page < totalPages && !loading;

  return (
    <div className="flex flex-col gap-3">
      <div
        aria-busy={loading}
        className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        <Table variant="card">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {loading ? strings.loading : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="group cursor-pointer"
                  onClick={() => {
                    // Let the accountant copy a cell's text without navigating.
                    if (window.getSelection()?.toString()) return;
                    router.push(`/students/${row.original.studentId}`);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{strings.pagination.rowCount(shown, data.total)}</span>
        <div className="flex items-center gap-2">
          <span>{strings.pagination.pageIndicator(data.page, totalPages)}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!canPrev}
            onClick={() => onPageChange(data.page - 1)}
          >
            {strings.pagination.prev}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNext}
            onClick={() => onPageChange(data.page + 1)}
          >
            {strings.pagination.next}
          </Button>
        </div>
      </div>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
    </div>
  );
}

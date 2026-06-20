"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { strings } from "../strings";
import type {
  ClubsFeeCell,
  FeeCell,
  FeeStatus,
  StudentListResponse,
  StudentRow,
} from "../types";

type Props = {
  data: StudentListResponse;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onPageChange: (page: number) => void;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatAmount(n: number): string {
  return numberFormatter.format(n);
}

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

function StatusBadge({ status }: { status: FeeStatus }) {
  const variant = statusVariant(status);
  if (variant === null) {
    return <span className="text-muted-foreground">{strings.status.none}</span>;
  }
  return <Badge variant={variant}>{strings.status[status]}</Badge>;
}

function FeeCellView({ cell }: { cell: FeeCell }) {
  if (!cell.hasCharge) {
    return <span className="text-muted-foreground">{strings.status.none}</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium tabular-nums">{formatAmount(cell.balance)}</span>
      <StatusBadge status={cell.status} />
    </div>
  );
}

function ClubsCellView({ cell }: { cell: ClubsFeeCell }) {
  if (!cell.hasCharge) {
    return <span className="text-muted-foreground">{strings.status.none}</span>;
  }
  const tooltip = cell.items
    .map((it) => `${it.feeName}: ${formatAmount(it.balance)}`)
    .join("\n");
  const names = cell.items.map((it) => it.feeName).join(", ");
  return (
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <span className="font-medium tabular-nums">{formatAmount(cell.balance)}</span>
      <StatusBadge status={cell.status} />
      <span className="max-w-[16rem] truncate text-xs text-muted-foreground">
        {names}
      </span>
    </div>
  );
}

const columnHelper = createColumnHelper<StudentRow>();

const columns = [
  columnHelper.accessor("lastName", {
    id: "surname",
    header: strings.columns.surname,
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{row.lastName}</span>
          <span className="text-xs text-muted-foreground">{row.studentCode}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("firstName", {
    id: "firstName",
    header: strings.columns.firstName,
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor("gradeName", {
    id: "class",
    header: strings.columns.class,
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor("tuition", {
    header: strings.columns.tuition,
    cell: (info) => <FeeCellView cell={info.getValue()} />,
  }),
  columnHelper.accessor("bus", {
    header: strings.columns.bus,
    cell: (info) => <FeeCellView cell={info.getValue()} />,
  }),
  columnHelper.accessor("registration", {
    header: strings.columns.registration,
    cell: (info) => <FeeCellView cell={info.getValue()} />,
  }),
  columnHelper.accessor("clubs", {
    header: strings.columns.clubs,
    cell: (info) => <ClubsCellView cell={info.getValue()} />,
  }),
  columnHelper.accessor("totalBalance", {
    header: strings.columns.total,
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold tabular-nums">
            {formatAmount(row.totalBalance)}
          </span>
          <StatusBadge status={row.overallStatus} />
        </div>
      );
    },
  }),
];

export function StudentTable({
  data,
  loading,
  error,
  emptyMessage,
  onPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

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
      <Table>
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
                className="text-center text-muted-foreground"
              >
                {loading ? strings.loading : emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
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

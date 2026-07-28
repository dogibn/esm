"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatAmount } from "../format";
import { strings } from "../strings";
import type {
  ClubsFeeCell,
  FeeCell,
  StudentListResponse,
  StudentRow,
} from "../types";
import { StatusBadge } from "./StatusBadge";

type Props = {
  data: StudentListResponse;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onPageChange: (page: number) => void;
};

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
  const router = useRouter();
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

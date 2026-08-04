"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { TX_STATUS_VALUES, type TxStatusValue } from "../schemas";
import { strings } from "../strings";
import type { TransactionListResponseWire, TransactionRowWire } from "../types";

const ALL = "__all__";
const DEBOUNCE_MS = 300;

function statusBadgeVariant(
  status: TxStatusValue,
): "success" | "destructive" | "secondary" {
  if (status === "matched") return "success";
  if (status === "discarded") return "secondary";
  return "destructive";
}

const numberFormatter = new Intl.NumberFormat("en-US");
function fmtAmount(n: number): string {
  return numberFormatter.format(n);
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ulaanbaatar",
  }).format(new Date(iso));
}

type FilterState = {
  search: string;
  status: TxStatusValue | null;
};

const emptyFilterState: FilterState = { search: "", status: null };

function paramsFrom(
  state: FilterState,
  page: number,
  pageSize: number,
): URLSearchParams {
  const p = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const search = state.search.trim();
  if (search.length > 0) p.set("search", search);
  if (state.status !== null) p.set("status", state.status);
  return p;
}

type Props = {
  initialData: TransactionListResponseWire;
};

export function TransactionsView({ initialData }: Props) {
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [data, setData] = useState<TransactionListResponseWire>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialFilterEffect = useRef(true);

  const fetchData = async (nextFilters: FilterState, nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = paramsFrom(nextFilters, nextPage, initialData.pageSize);
      const res = await fetch(`/api/transactions?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TransactionListResponseWire;
      setData(json);
    } catch {
      setError(strings.error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce any filter change. Reset to page 1 on each new filter set.
  useEffect(() => {
    if (skipInitialFilterEffect.current) {
      skipInitialFilterEffect.current = false;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void fetchData(filters, 1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const onUndo = async (operationId: number) => {
    setUndoingId(operationId);
    setActionError(null);
    try {
      const res = await fetch(`/api/imports/operations/${operationId}/undo`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh the current page so the row's status/action updates.
      await fetchData(filters, data.page);
    } catch {
      setActionError(strings.actions.error);
    } finally {
      setUndoingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasFilters = filters.search.trim().length > 0 || filters.status !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span
          className={
            data.unmatchedTotal > 0 ? "text-foreground" : "text-muted-foreground"
          }
        >
          {strings.unmatchedSummary(data.unmatchedTotal)}
        </span>
        {data.unmatchedTotal > 0 ? (
          <Link href="/imports" className="text-primary underline-offset-4 hover:underline">
            {strings.reviewLink}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder={strings.search.placeholder}
          className="w-full max-w-md"
          aria-label={strings.search.placeholder}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{strings.filters.statusLabel}</span>
          <Select
            items={{
              [ALL]: strings.filters.allStatuses,
              ...Object.fromEntries(
                TX_STATUS_VALUES.map((s) => [s, strings.status[s]]),
              ),
            }}
            value={filters.status ?? ALL}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                status:
                  v === null || v === ALL ? null : (v as TxStatusValue),
              }))
            }
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder={strings.filters.allStatuses} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{strings.filters.allStatuses}</SelectItem>
              {TX_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {strings.status[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div
        aria-busy={loading}
        className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
      <Table variant="card">
        <TableHeader>
          <TableRow>
            <TableHead>{strings.columns.date}</TableHead>
            <TableHead>{strings.columns.sender}</TableHead>
            <TableHead>{strings.columns.memo}</TableHead>
            <TableHead className="text-right">{strings.columns.amount}</TableHead>
            <TableHead>{strings.columns.status}</TableHead>
            <TableHead>{strings.columns.paidFor}</TableHead>
            <TableHead className="text-right">{strings.columns.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {loading
                  ? strings.loading
                  : hasFilters
                    ? strings.emptyFiltered
                    : strings.empty}
              </TableCell>
            </TableRow>
          ) : (
            data.rows.map((row) => (
              <TransactionRowView
                key={row.id}
                row={row}
                onUndo={onUndo}
                undoing={undoingId === row.undoOperationId}
              />
            ))
          )}
        </TableBody>
      </Table>
      </div>
      {actionError ? (
        <div className="text-sm text-destructive">{actionError}</div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{strings.pagination.rowCount(data.rows.length, data.total)}</span>
        <div className="flex items-center gap-2">
          <span>{strings.pagination.pageIndicator(data.page, totalPages)}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1 || loading}
            onClick={() => void fetchData(filters, data.page - 1)}
          >
            {strings.pagination.prev}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= totalPages || loading}
            onClick={() => void fetchData(filters, data.page + 1)}
          >
            {strings.pagination.next}
          </Button>
        </div>
      </div>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
    </div>
  );
}

function TransactionRowView({
  row,
  onUndo,
  undoing,
}: {
  row: TransactionRowWire;
  onUndo: (operationId: number) => void;
  undoing: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {fmtDate(row.transactionAt)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{row.senderName ?? "—"}</span>
          {row.senderAccount ? (
            <span className="font-mono text-xs text-muted-foreground">
              {row.senderAccount}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="max-w-[20rem] truncate text-muted-foreground" title={row.memo ?? ""}>
        {row.memo ?? "—"}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {fmtAmount(row.amount)}
      </TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(row.status)}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {strings.status[row.status]}
        </Badge>
      </TableCell>
      <TableCell>
        {row.payments.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="flex flex-col gap-0.5 text-xs">
            {row.payments.map((p, i) => (
              <li key={i}>
                {strings.paymentLine(
                  p.feeName,
                  `${p.studentLastName} ${p.studentFirstName}`,
                  fmtAmount(p.amount),
                )}
              </li>
            ))}
          </ul>
        )}
      </TableCell>
      <TableCell className="text-right">
        {row.undoOperationId !== null ? (
          <Button
            variant="outline"
            size="sm"
            disabled={undoing}
            onClick={() => onUndo(row.undoOperationId!)}
          >
            {undoing
              ? strings.actions.pending
              : row.status === "discarded"
                ? strings.actions.restore
                : strings.actions.undo}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

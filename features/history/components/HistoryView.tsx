"use client";

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

import { OPERATION_KIND_VALUES, type OperationKindValue } from "../schemas";
import { strings } from "../strings";
import type { HistoryListResponseWire, HistoryRowWire } from "../types";

const ALL = "__all__";

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

function kindBadgeVariant(
  kind: OperationKindValue,
): "success" | "destructive" | "secondary" | "outline" {
  switch (kind) {
    case "confirm_match":
    case "create_enrollment":
      return "success";
    case "discard_transaction":
      return "secondary";
    case "undo":
      return "outline";
    default:
      return "outline";
  }
}

type FilterState = {
  kind: OperationKindValue | null;
  from: string;
  to: string;
};

const emptyFilterState: FilterState = { kind: null, from: "", to: "" };

function paramsFrom(
  state: FilterState,
  page: number,
  pageSize: number,
): URLSearchParams {
  const p = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (state.kind !== null) p.set("kind", state.kind);
  if (state.from.trim().length > 0) p.set("from", state.from);
  if (state.to.trim().length > 0) p.set("to", state.to);
  return p;
}

type Props = {
  initialData: HistoryListResponseWire;
};

export function HistoryView({ initialData }: Props) {
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [data, setData] = useState<HistoryListResponseWire>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const skipInitialFilterEffect = useRef(true);

  const fetchData = async (nextFilters: FilterState, nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = paramsFrom(nextFilters, nextPage, initialData.pageSize);
      const res = await fetch(`/api/history?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as HistoryListResponseWire;
      setData(json);
    } catch {
      setError(strings.error);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch from page 1 whenever a filter changes. No debounce: the filters
  // are a dropdown and two date pickers, not free text.
  useEffect(() => {
    if (skipInitialFilterEffect.current) {
      skipInitialFilterEffect.current = false;
      return;
    }
    void fetchData(filters, 1);
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
      await fetchData(filters, data.page);
    } catch {
      setActionError(strings.actions.error);
    } finally {
      setUndoingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasFilters =
    filters.kind !== null ||
    filters.from.trim().length > 0 ||
    filters.to.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        {data.scopedToSelf ? strings.scope.self : strings.scope.all}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{strings.filters.kindLabel}</span>
          <Select
            items={{
              [ALL]: strings.filters.allKinds,
              ...Object.fromEntries(
                OPERATION_KIND_VALUES.map((k) => [k, strings.kinds[k]]),
              ),
            }}
            value={filters.kind ?? ALL}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                kind: v === null || v === ALL ? null : (v as OperationKindValue),
              }))
            }
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder={strings.filters.allKinds} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{strings.filters.allKinds}</SelectItem>
              {OPERATION_KIND_VALUES.map((k) => (
                <SelectItem key={k} value={k}>
                  {strings.kinds[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{strings.filters.from}</span>
          <Input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="w-auto"
            aria-label={strings.filters.from}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{strings.filters.to}</span>
          <Input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="w-auto"
            aria-label={strings.filters.to}
          />
        </label>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(emptyFilterState)}
          >
            {strings.filters.clear}
          </Button>
        ) : null}
      </div>

      <div
        aria-busy={loading}
        className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>{strings.columns.when}</TableHead>
              <TableHead>{strings.columns.action}</TableHead>
              <TableHead>{strings.columns.summary}</TableHead>
              <TableHead>{strings.columns.actor}</TableHead>
              <TableHead>{strings.columns.status}</TableHead>
              <TableHead className="text-right">{strings.columns.undo}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {loading
                    ? strings.loading
                    : hasFilters
                      ? strings.emptyFiltered
                      : strings.empty}
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <HistoryRowView
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

function HistoryRowView({
  row,
  onUndo,
  undoing,
}: {
  row: HistoryRowWire;
  onUndo: (operationId: number) => void;
  undoing: boolean;
}) {
  const undone = row.undoneAt !== null;
  // An undoable-kind row that's neither undone nor still offered means its
  // window has passed (for this viewer / at this time).
  const expired =
    !undone && row.undoOperationId === null && row.undoableUntil !== null;

  return (
    <TableRow className={undone ? "opacity-60" : undefined}>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {fmtDate(row.createdAt)}
      </TableCell>
      <TableCell>
        <Badge variant={kindBadgeVariant(row.kind)}>{strings.kinds[row.kind]}</Badge>
      </TableCell>
      <TableCell className="max-w-[28rem] text-muted-foreground">
        {row.summary}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {row.actorEmail}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {undone ? (
          <span className="text-muted-foreground">{strings.statusUndone}</span>
        ) : expired ? (
          <span className="text-muted-foreground">{strings.statusExpired}</span>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        {row.undoOperationId !== null ? (
          <Button
            variant="outline"
            size="sm"
            disabled={undoing}
            onClick={() => onUndo(row.undoOperationId!)}
          >
            {undoing ? strings.actions.pending : strings.actions.undo}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

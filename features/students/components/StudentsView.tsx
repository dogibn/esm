"use client";

import { useEffect, useRef, useState } from "react";

import type { FeeScopeValue } from "../schemas";
import { strings } from "../strings";
import type { FilterOptions, StudentListResponse } from "../types";

import { FeeScopeTabs } from "./FeeScopeTabs";
import {
  StudentFilters,
  countActiveFilters,
  emptyFilterState,
  type FilterState,
} from "./StudentFilters";
import { StudentSummaryCards } from "./StudentSummaryCards";
import { StudentTable } from "./StudentTable";

type Props = {
  options: FilterOptions;
  initialData: StudentListResponse;
  initialFee: FeeScopeValue;
};

const DEBOUNCE_MS = 300;

function paramsFrom(
  state: FilterState,
  fee: FeeScopeValue,
  page: number,
  pageSize: number,
): URLSearchParams {
  const p = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    fee,
  });
  const search = state.search.trim();
  if (search.length > 0) p.set("search", search);
  if (state.gradeLevelId !== null) p.set("gradeLevelId", String(state.gradeLevelId));
  if (state.gradeId !== null) p.set("gradeId", String(state.gradeId));
  if (state.status !== null) p.set("status", state.status);
  return p;
}

export function StudentsView({ options, initialData, initialFee }: Props) {
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [fee, setFee] = useState<FeeScopeValue>(initialFee);
  const [page, setPage] = useState(initialData.page);
  const [data, setData] = useState<StudentListResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialFilterEffect = useRef(true);

  const fetchData = async (
    nextFilters: FilterState,
    nextFee: FeeScopeValue,
    nextPage: number,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = paramsFrom(nextFilters, nextFee, nextPage, initialData.pageSize);
      const res = await fetch(`/api/students?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StudentListResponse;
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
      setPage(1);
      void fetchData(filters, fee, 1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const onFeeChange = (next: FeeScopeValue) => {
    if (next === fee) return;
    setFee(next);
    setPage(1);
    // Shallow URL update: the scope stays linkable and survives a refresh
    // without re-running the server component, which would discard the
    // client-held filters. Next.js syncs history.replaceState into its router.
    const url = new URL(window.location.href);
    url.searchParams.set("fee", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    void fetchData(filters, next, 1);
  };

  const onPageChange = (next: number) => {
    setPage(next);
    void fetchData(filters, fee, next);
  };

  const hasActiveFilters = countActiveFilters(filters) > 0;
  const emptyMessage = hasActiveFilters
    ? strings.emptyFiltered
    : fee === "all"
      ? strings.empty
      : strings.emptyFee;

  return (
    <div className="flex flex-col gap-5">
      <StudentSummaryCards summary={data.summary} />
      <div className="flex flex-col gap-4">
        <FeeScopeTabs value={fee} onChange={onFeeChange} />
        <StudentFilters
          options={options}
          state={filters}
          onChange={setFilters}
          recordCount={data.total}
        />
        <StudentTable
          data={data}
          fee={data.fee}
          loading={loading}
          error={error}
          emptyMessage={emptyMessage}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}

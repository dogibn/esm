"use client";

import { useEffect, useRef, useState } from "react";

import {
  GROUPABLE_FEE_SCOPE,
  pageSizeFor,
  resolveGroupBy,
  type FeeScopeValue,
  type GroupByValue,
} from "../schemas";
import { strings } from "../strings";
import type { FilterOptions, StudentListResponse } from "../types";

import { FeeScopeTabs } from "./FeeScopeTabs";
import { GroupByToggle } from "./GroupByToggle";
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
  initialGroupBy: GroupByValue;
};

const DEBOUNCE_MS = 300;

function paramsFrom(
  state: FilterState,
  fee: FeeScopeValue,
  groupBy: GroupByValue,
  page: number,
): URLSearchParams {
  const p = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSizeFor(groupBy)),
    fee,
  });
  if (groupBy !== "none") p.set("groupBy", groupBy);
  const search = state.search.trim();
  if (search.length > 0) p.set("search", search);
  if (state.gradeLevelId !== null) p.set("gradeLevelId", String(state.gradeLevelId));
  if (state.gradeId !== null) p.set("gradeId", String(state.gradeId));
  if (state.status !== null) p.set("status", state.status);
  return p;
}

export function StudentsView({
  options,
  initialData,
  initialFee,
  initialGroupBy,
}: Props) {
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [fee, setFee] = useState<FeeScopeValue>(initialFee);
  const [groupBy, setGroupBy] = useState<GroupByValue>(initialGroupBy);
  const [page, setPage] = useState(initialData.page);
  const [data, setData] = useState<StudentListResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialFilterEffect = useRef(true);

  const fetchData = async (
    nextFilters: FilterState,
    nextFee: FeeScopeValue,
    nextGroupBy: GroupByValue,
    nextPage: number,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = paramsFrom(nextFilters, nextFee, nextGroupBy, nextPage);
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
      void fetchData(filters, fee, groupBy, 1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Shallow URL update: the view stays linkable and survives a refresh without
  // re-running the server component, which would discard the client-held
  // filters. Next.js syncs history.replaceState into its router.
  const syncUrl = (nextFee: FeeScopeValue, nextGroupBy: GroupByValue) => {
    const url = new URL(window.location.href);
    url.searchParams.set("fee", nextFee);
    if (nextGroupBy === "none") url.searchParams.delete("groupBy");
    else url.searchParams.set("groupBy", nextGroupBy);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const onFeeChange = (next: FeeScopeValue) => {
    if (next === fee) return;
    // Grouping doesn't survive leaving the scope that offers it — the toggle
    // would vanish while the table stayed grouped.
    const nextGroupBy = resolveGroupBy(next, groupBy);
    setFee(next);
    setGroupBy(nextGroupBy);
    setPage(1);
    syncUrl(next, nextGroupBy);
    void fetchData(filters, next, nextGroupBy, 1);
  };

  const onGroupByChange = (next: GroupByValue) => {
    if (next === groupBy) return;
    setGroupBy(next);
    // The page size changes with the mode (classes, not students), so page 1
    // is the only page that means the same thing on both sides.
    setPage(1);
    syncUrl(fee, next);
    void fetchData(filters, fee, next, 1);
  };

  const onPageChange = (next: number) => {
    setPage(next);
    void fetchData(filters, fee, groupBy, next);
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FeeScopeTabs value={fee} onChange={onFeeChange} />
          {fee === GROUPABLE_FEE_SCOPE ? (
            <GroupByToggle value={groupBy} onChange={onGroupByChange} />
          ) : null}
        </div>
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

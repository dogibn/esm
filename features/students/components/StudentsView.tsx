"use client";

import { useEffect, useRef, useState } from "react";

import { strings } from "../strings";
import type { FilterOptions, StudentListResponse } from "../types";

import {
  StudentFilters,
  countActiveFilters,
  emptyFilterState,
  type FilterState,
} from "./StudentFilters";
import { StudentTable } from "./StudentTable";

type Props = {
  options: FilterOptions;
  initialData: StudentListResponse;
};

const DEBOUNCE_MS = 300;

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
  if (state.gradeLevelId !== null) p.set("gradeLevelId", String(state.gradeLevelId));
  if (state.gradeId !== null) p.set("gradeId", String(state.gradeId));
  if (state.status !== null) p.set("status", state.status);
  return p;
}

export function StudentsView({ options, initialData }: Props) {
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [page, setPage] = useState(initialData.page);
  const [data, setData] = useState<StudentListResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialFilterEffect = useRef(true);

  const fetchData = async (nextFilters: FilterState, nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = paramsFrom(nextFilters, nextPage, initialData.pageSize);
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
      void fetchData(filters, 1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const onPageChange = (next: number) => {
    setPage(next);
    void fetchData(filters, next);
  };

  const hasActiveFilters = countActiveFilters(filters) > 0;
  const emptyMessage = hasActiveFilters ? strings.emptyFiltered : strings.empty;

  return (
    <div className="flex flex-col gap-4">
      <StudentFilters options={options} state={filters} onChange={setFilters} />
      <StudentTable
        data={data}
        loading={loading}
        error={error}
        emptyMessage={emptyMessage}
        onPageChange={onPageChange}
      />
    </div>
  );
}

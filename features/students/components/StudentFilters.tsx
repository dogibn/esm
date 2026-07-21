"use client";

import { ListFilter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { STATUS_FILTER_VALUES, type StatusFilterValue } from "../schemas";
import { strings } from "../strings";
import type { FilterOptions } from "../types";

const ALL = "__all__";

export type FilterState = {
  search: string;
  gradeLevelId: number | null;
  gradeId: number | null;
  status: StatusFilterValue | null;
};

export const emptyFilterState: FilterState = {
  search: "",
  gradeLevelId: null,
  gradeId: null,
  status: null,
};

export function countActiveFilters(state: FilterState): number {
  let n = 0;
  if (state.search.trim().length > 0) n++;
  if (state.gradeLevelId !== null) n++;
  if (state.gradeId !== null) n++;
  if (state.status !== null) n++;
  return n;
}

type Props = {
  options: FilterOptions;
  state: FilterState;
  onChange: (next: FilterState) => void;
  recordCount: number;
};

function toIdOrNull(v: string | null): number | null {
  if (v === null || v === ALL) return null;
  return Number(v);
}

function toStatusOrNull(v: string | null): StatusFilterValue | null {
  if (v === null || v === ALL) return null;
  return STATUS_FILTER_VALUES.includes(v as StatusFilterValue)
    ? (v as StatusFilterValue)
    : null;
}

export function StudentFilters({ options, state, onChange, recordCount }: Props) {
  const active = countActiveFilters(state);

  // Narrow the class list to the selected grade level (if any).
  const visibleGrades =
    state.gradeLevelId === null
      ? options.grades
      : options.grades.filter((g) => g.gradeLevelId === state.gradeLevelId);

  const update = (patch: Partial<FilterState>) => onChange({ ...state, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-xs">
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <ListFilter aria-hidden className="size-4" />
        {strings.filters.label}
      </span>

      <Select
        items={{
          [ALL]: strings.filters.allStatuses,
          ...Object.fromEntries(STATUS_FILTER_VALUES.map((s) => [s, strings.status[s]])),
        }}
        value={state.status === null ? ALL : state.status}
        onValueChange={(v) => update({ status: toStatusOrNull(v) })}
      >
        <SelectTrigger size="sm" aria-label={strings.filters.statusLabel}>
          <SelectValue placeholder={strings.filters.allStatuses} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{strings.filters.allStatuses}</SelectItem>
          {STATUS_FILTER_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {strings.status[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{
          [ALL]: strings.filters.allGradeLevels,
          ...Object.fromEntries(
            options.gradeLevels.map((lvl) => [String(lvl.id), lvl.code]),
          ),
        }}
        value={state.gradeLevelId === null ? ALL : String(state.gradeLevelId)}
        onValueChange={(v) => {
          const nextId = toIdOrNull(v);
          // Clear class if it no longer belongs to the new level.
          const clearGradeId =
            nextId !== null &&
            state.gradeId !== null &&
            !options.grades.some(
              (g) => g.id === state.gradeId && g.gradeLevelId === nextId,
            );
          update({
            gradeLevelId: nextId,
            gradeId: clearGradeId ? null : state.gradeId,
          });
        }}
      >
        <SelectTrigger size="sm" aria-label={strings.filters.gradeLevelLabel}>
          <SelectValue placeholder={strings.filters.allGradeLevels} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{strings.filters.allGradeLevels}</SelectItem>
          {options.gradeLevels.map((lvl) => (
            <SelectItem key={lvl.id} value={String(lvl.id)}>
              {lvl.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{
          [ALL]: strings.filters.allGrades,
          ...Object.fromEntries(visibleGrades.map((g) => [String(g.id), g.name])),
        }}
        value={state.gradeId === null ? ALL : String(state.gradeId)}
        onValueChange={(v) => update({ gradeId: toIdOrNull(v) })}
      >
        <SelectTrigger size="sm" aria-label={strings.filters.gradeLabel}>
          <SelectValue placeholder={strings.filters.allGrades} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{strings.filters.allGrades}</SelectItem>
          {visibleGrades.map((g) => (
            <SelectItem key={g.id} value={String(g.id)}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilterState)}>
          {strings.filters.clearAll}
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={state.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder={strings.search.placeholder}
            className="w-56 pl-8 lg:w-64"
            aria-label={strings.search.placeholder}
          />
        </div>
        <span className="text-sm whitespace-nowrap text-muted-foreground">
          {strings.recordCount(recordCount)}
        </span>
      </div>
    </div>
  );
}

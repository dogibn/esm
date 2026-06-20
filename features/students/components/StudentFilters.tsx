"use client";

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

export function StudentFilters({ options, state, onChange }: Props) {
  const active = countActiveFilters(state);

  // Narrow the class list to the selected grade level (if any).
  const visibleGrades =
    state.gradeLevelId === null
      ? options.grades
      : options.grades.filter((g) => g.gradeLevelId === state.gradeLevelId);

  const update = (patch: Partial<FilterState>) => onChange({ ...state, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={state.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder={strings.search.placeholder}
          className="w-full max-w-xs"
          aria-label={strings.search.placeholder}
        />

        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{strings.filters.gradeLevelLabel}</span>
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
            <SelectTrigger size="sm">
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
        </label>

        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{strings.filters.gradeLabel}</span>
          <Select
            items={{
              [ALL]: strings.filters.allGrades,
              ...Object.fromEntries(visibleGrades.map((g) => [String(g.id), g.name])),
            }}
            value={state.gradeId === null ? ALL : String(state.gradeId)}
            onValueChange={(v) => update({ gradeId: toIdOrNull(v) })}
          >
            <SelectTrigger size="sm">
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
        </label>

        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{strings.filters.statusLabel}</span>
          <Select
            items={{
              [ALL]: strings.filters.allStatuses,
              ...Object.fromEntries(STATUS_FILTER_VALUES.map((s) => [s, strings.status[s]])),
            }}
            value={state.status === null ? ALL : state.status}
            onValueChange={(v) => update({ status: toStatusOrNull(v) })}
          >
            <SelectTrigger size="sm">
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
        </label>

        {active > 0 ? (
          <>
            <Badge variant="outline">{strings.filters.activeCount(active)}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(emptyFilterState)}
            >
              {strings.filters.clearAll}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

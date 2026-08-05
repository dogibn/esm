"use client";

import { Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { GroupByValue } from "../schemas";
import { strings } from "../strings";

type Props = {
  value: GroupByValue;
  onChange: (next: GroupByValue) => void;
};

/**
 * Group the tracking table by class, on or off. Presentation only — it narrows
 * nothing, so the summary cards and the record count never move when it is
 * flipped. `aria-pressed` is what makes it a toggle rather than an action.
 */
export function GroupByToggle({ value, onChange }: Props) {
  const on = value === "class";
  return (
    <Button
      type="button"
      variant={on ? "secondary" : "outline"}
      size="sm"
      aria-pressed={on}
      onClick={() => onChange(on ? "none" : "class")}
    >
      <Rows3 aria-hidden />
      {strings.group.label}
    </Button>
  );
}

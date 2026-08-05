"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FEE_SCOPE_VALUES, type FeeScopeValue } from "../schemas";
import { strings } from "../strings";

type Props = {
  value: FeeScopeValue;
  onChange: (next: FeeScopeValue) => void;
};

// Which fee the table is scoped to. The selection lives in the URL (?fee=…),
// so a view is linkable and survives a refresh — StudentsView owns that sync.
export function FeeScopeTabs({ value, onChange }: Props) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as FeeScopeValue)}>
      {/* The label lands on the tablist, not the wrapper. */}
      <TabsList variant="line" aria-label={strings.fee.label}>
        {FEE_SCOPE_VALUES.map((scope) => (
          <TabsTrigger key={scope} value={scope}>
            {strings.fee.tabs[scope]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

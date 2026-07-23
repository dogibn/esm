"use client";

import { useRouter } from "next/navigation";
import { PlusIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

import { strings } from "../strings";

// The start-page entry point: a "New contract" dropdown offering the two
// starting points. Each item routes to the single-page form with the mode
// preselected.
export function NewContractButton() {
  const router = useRouter();

  const go = (mode: "new" | "existing") =>
    router.push(`/enrollments/new?mode=${mode}`);

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="default" data-icon="inline-start">
            <PlusIcon />
            {strings.button.label}
            <ChevronDownIcon className="text-primary-foreground/80" />
          </Button>
        }
      />
      <MenuContent>
        <MenuItem onClick={() => go("new")}>
          <span className="font-medium">{strings.button.newStudent}</span>
          <span className="text-xs text-muted-foreground">
            {strings.button.newStudentHint}
          </span>
        </MenuItem>
        <MenuItem onClick={() => go("existing")}>
          <span className="font-medium">{strings.button.existingStudent}</span>
          <span className="text-xs text-muted-foreground">
            {strings.button.existingStudentHint}
          </span>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

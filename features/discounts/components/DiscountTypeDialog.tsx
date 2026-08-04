"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import type { DiscountTypeRow } from "../api";
import type { DiscountUnit } from "../calc";
import { strings } from "../strings";

const f = strings.form;

type Props = {
  open: boolean;
  target: DiscountTypeRow | null; // null → add mode
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function DiscountTypeDialog({ open, target, onOpenChange, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Remount per open/target so state derives fresh from props. */}
        <DiscountTypeForm
          key={`${open}:${target?.id ?? "add"}`}
          target={target}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function DiscountTypeForm({ target, onOpenChange, onSaved }: Omit<Props, "open">) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = target !== null;

  const [name, setName] = useState(target?.name ?? "");
  const [unit, setUnit] = useState<DiscountUnit>(target?.unit ?? "mnt");
  const [value, setValue] = useState(
    target?.value === null || target?.value === undefined ? "" : String(target.value),
  );
  const [note, setNote] = useState(target?.note ?? "");
  const [isActive, setIsActive] = useState(target?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = isEdit ? `/api/discount-types/${target.id}` : "/api/discount-types";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          unit,
          value: value.trim() === "" ? null : Number(value),
          note,
          isActive,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      onSaved();
      toast({
        message: isEdit ? strings.toasts.updated : strings.toasts.created,
        variant: "success",
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message || f.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? f.editTitle : f.addTitle}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {f.name}
          </span>
          <Input
            value={name}
            required
            placeholder={f.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {f.unit}
            </span>
            <Select
              items={{ mnt: f.unitMnt, percent: f.unitPercent }}
              value={unit}
              onValueChange={(v) => setUnit((v as DiscountUnit) ?? "mnt")}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mnt">{f.unitMnt}</SelectItem>
                <SelectItem value="percent">{f.unitPercent}</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {f.value}
            </span>
            <Input
              type="number"
              min={0}
              max={unit === "percent" ? 100 : undefined}
              step={unit === "percent" ? 0.5 : 1000}
              value={value}
              placeholder={
                unit === "percent" ? f.valuePercentPlaceholder : f.valueMntPlaceholder
              }
              onChange={(e) => setValue(e.target.value)}
              className="text-right tabular-nums"
            />
          </label>
        </div>
        <span className="text-xs text-muted-foreground">{f.valueHint}</span>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {f.note}
          </span>
          <Input
            value={note}
            placeholder={f.notePlaceholder}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <span>{f.active}</span>
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {f.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? f.saving : f.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

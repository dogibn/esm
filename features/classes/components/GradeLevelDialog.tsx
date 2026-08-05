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
import { useToast } from "@/components/ui/toast";

import { strings } from "../strings";
import type { GradeLevelRow } from "../types";

import { Field } from "./Field";

const f = strings.form;

type Props = {
  open: boolean;
  /** null → add mode. */
  target: GradeLevelRow | null;
  onOpenChange: (open: boolean) => void;
};

export function GradeLevelDialog({ open, target, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <GradeLevelForm
          key={`${open}:${target?.id ?? "add"}`}
          target={target}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function GradeLevelForm({ target, onOpenChange }: Omit<Props, "open">) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = target !== null;

  const [code, setCode] = useState(target?.code ?? "");
  const [sortOrder, setSortOrder] = useState(String(target?.sortOrder ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        isEdit ? `/api/classes/levels/${target.id}` : "/api/classes/levels",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          // An edit sends only the order — the code is fixed at creation.
          body: JSON.stringify(
            isEdit
              ? { sortOrder: Number(sortOrder) }
              : { code: code.trim(), sortOrder: Number(sortOrder) },
          ),
        },
      );
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      toast({
        message: isEdit
          ? strings.toasts.levelUpdated
          : strings.toasts.levelCreated,
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
        <DialogTitle>{isEdit ? f.editLevelTitle : f.addLevelTitle}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <Field label={f.code}>
          <Input
            value={code}
            required
            disabled={isEdit}
            maxLength={10}
            placeholder={f.codePlaceholder}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <span className="text-xs text-muted-foreground">
          {isEdit ? f.codeLockedHint : f.codeNewHint}
        </span>

        <Field label={f.sortOrder}>
          <Input
            type="number"
            value={sortOrder}
            required
            min={0}
            max={1000}
            step={1}
            onChange={(e) => setSortOrder(e.target.value)}
            className="text-right tabular-nums"
          />
        </Field>
        <span className="text-xs text-muted-foreground">{f.sortOrderHint}</span>

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

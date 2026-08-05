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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

import { strings } from "../strings";
import type { FeeLevelOption, SchoolFeeGroup } from "../types";

const p = strings.publish;

type Props = {
  open: boolean;
  fee: SchoolFeeGroup | null;
  levels: FeeLevelOption[];
  onOpenChange: (open: boolean) => void;
};

export function PublishRateDialog({ open, fee, levels, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {fee ? (
          <PublishRateForm
            key={`${open}:${fee.feeName}`}
            fee={fee}
            levels={levels}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function PublishRateForm({
  fee,
  levels,
  onOpenChange,
}: {
  fee: SchoolFeeGroup;
  levels: FeeLevelOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isByGrade = fee.shape === "by_grade";

  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState(
    fee.current?.amount !== null && fee.current?.amount !== undefined
      ? String(fee.current.amount)
      : "",
  );
  // Every level gets a row, pre-filled from the rate in force where it has one.
  const [perLevel, setPerLevel] = useState<Record<string, string>>(() => {
    const from = new Map(
      (fee.current?.byGrade ?? []).map((e) => [e.code, String(e.amount)]),
    );
    return Object.fromEntries(levels.map((l) => [l.code, from.get(l.code) ?? ""]));
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fees/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          feeName: fee.feeName,
          effectiveFrom,
          ...(isByGrade
            ? {
                byGrade: levels.map((l) => ({
                  code: l.code,
                  amount: Number(perLevel[l.code] ?? ""),
                })),
              }
            : { amount: Number(amount) }),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      toast({ message: strings.toasts.published(fee.label), variant: "success" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message || p.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{p.title(fee.label)}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <Field label={p.effectiveFrom}>
          <Input
            type="date"
            value={effectiveFrom}
            required
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <span className="text-xs text-muted-foreground">{p.immediateNote}</span>

        {isByGrade ? (
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{strings.columns.level}</TableHead>
                  <TableHead>{p.perLevel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.code}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        required
                        min={0}
                        step={1000}
                        value={perLevel[l.code] ?? ""}
                        onChange={(e) =>
                          setPerLevel((prev) => ({ ...prev, [l.code]: e.target.value }))
                        }
                        className="text-right tabular-nums"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Field label={p.amount}>
            <Input
              type="number"
              required
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-right tabular-nums"
            />
          </Field>
        )}

        <p className="text-xs text-muted-foreground">{p.supersedeNote}</p>
        <p className="text-xs text-muted-foreground">{p.chargesNote}</p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {p.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? p.saving : p.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

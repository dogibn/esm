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

import { formatMnt } from "../../format";
import { strings } from "../../strings";
import type { ChargeScopeValue } from "../../schemas";

const c = strings.detail.charge;

export type ChargeEditTarget = {
  chargeId: number;
  feeName: string;
  scopeLabel: string;
  amount: number;
  notes: string | null;
  paid: number;
};

type TermOption = { id: number; name: string; isCurrent: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  terms: TermOption[];
  /** null → add mode; a target → edit mode. */
  target: ChargeEditTarget | null;
  /** Default scope when adding. */
  defaultScope?: ChargeScopeValue;
  onSaved: () => void;
};

function toAmount(v: string): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ChargeFormDialog({
  open,
  onOpenChange,
  studentId,
  terms,
  target,
  defaultScope = "term",
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/*
          Keying on the open state + target remounts the form each time the
          dialog opens (or its target changes), so it starts from fresh initial
          state derived from props — no reset effect needed.
        */}
        <ChargeForm
          key={`${open}:${target?.chargeId ?? "add"}`}
          onOpenChange={onOpenChange}
          studentId={studentId}
          terms={terms}
          target={target}
          defaultScope={defaultScope}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function ChargeForm({
  onOpenChange,
  studentId,
  terms,
  target,
  defaultScope,
  onSaved,
}: Omit<Props, "open">) {
  const router = useRouter();
  const isEdit = target !== null;

  const [feeName, setFeeName] = useState(target?.feeName ?? "");
  const [scope, setScope] = useState<ChargeScopeValue>(defaultScope ?? "term");
  const [termId, setTermId] = useState<number | null>(
    target ? null : (terms.find((t) => t.isCurrent)?.id ?? terms[0]?.id ?? null),
  );
  const [amount, setAmount] = useState(target ? String(target.amount) : "0");
  const [notes, setNotes] = useState(target?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/students/${studentId}/charges/${target!.chargeId}`
        : `/api/students/${studentId}/charges`;
      const body = isEdit
        ? { amount: toAmount(amount), notes }
        : {
            feeName: feeName.trim(),
            scope,
            academicTermId: scope === "term" ? termId : undefined,
            amount: toAmount(amount),
            notes,
          };
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      onSaved();
      router.refresh();
    } catch (err) {
      setError((err as Error).message || c.error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!target) return;
    if (!window.confirm(c.removeConfirm)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/charges/${target.chargeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      onSaved();
      router.refresh();
    } catch (err) {
      setError((err as Error).message || c.error);
    } finally {
      setBusy(false);
    }
  };

  const canDelete = isEdit && target!.paid === 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? c.editTitle : c.addTitle}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {c.feeName}
            </span>
            {isEdit ? (
              <span className="font-medium">{target!.feeName}</span>
            ) : (
              <Input
                value={feeName}
                required
                placeholder={c.feeNamePlaceholder}
                onChange={(e) => setFeeName(e.target.value)}
              />
            )}
          </label>

          {isEdit ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {c.scope}
              </span>
              <span>{target!.scopeLabel}</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {c.scope}
                </span>
                <Select
                  items={{ annual: c.scopeAnnual, term: c.scopeTerm }}
                  value={scope}
                  onValueChange={(v) => setScope((v as ChargeScopeValue) ?? "term")}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">{c.scopeAnnual}</SelectItem>
                    <SelectItem value="term">{c.scopeTerm}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {scope === "term" ? (
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {c.term}
                  </span>
                  <Select
                    items={Object.fromEntries(terms.map((t) => [String(t.id), t.name]))}
                    value={termId === null ? "" : String(termId)}
                    onValueChange={(v) => setTermId(v ? Number(v) : null)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {terms.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {c.amount}
            </span>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-right tabular-nums"
            />
            {isEdit && target!.paid > 0 ? (
              <span className="text-xs text-muted-foreground">
                {c.paidFloor(formatMnt(target!.paid))}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {c.notes}
            </span>
            <Input
              value={notes}
              placeholder={c.notesPlaceholder}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {isEdit && !canDelete ? (
            <p className="text-xs text-muted-foreground">{c.removeBlocked}</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="items-center sm:justify-between">
            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={remove}
              >
                {busy ? c.removing : c.remove}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                {c.cancel}
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? c.saving : c.save}
              </Button>
            </div>
          </DialogFooter>
        </form>
    </>
  );
}
